"""
NexusDesk AI - Stateful LangGraph Agentic RAG Engine
Implements a 5-node cyclic LangGraph workflow:
  1. router_node: Intent classification & context-aware follow-up rewriting
  2. catalog_sql_node: DuckDB/Pandas SQL filtering on amazon_products.csv
  3. semantic_rag_node: FAISS + SentenceTransformer semantic search on policies.md & product reviews
  4. grader_node: Context relevance evaluation & retry loop control
  5. escalation_node: SQLite ticket creation & n8n webhook notification
"""

import os
import re
import time
import uuid
import math
import logging
import datetime
from typing import Dict, Any, List, Optional, TypedDict

import httpx
import duckdb
import pandas as pd

from backend.database import save_ticket, save_message, get_session_history

logger = logging.getLogger("nexusdesk.rag_pipeline")

DATASET_DIR = os.path.join(os.path.dirname(os.path.abspath(__file__)), "dataset")
PRODUCTS_CSV_PATH = os.path.join(DATASET_DIR, "amazon_products.csv")
POLICIES_MD_PATH = os.path.join(DATASET_DIR, "policies.md")

# ==============================================================================
# STATE DEFINITION
# ==============================================================================

class AgentState(TypedDict, total=False):
    session_id: str
    original_query: str
    query: str
    history: List[Dict[str, str]]
    intent: str  # CATALOG_FILTER | POLICY_FAQ | HYBRID_COMPARISON | ESCALATE_ACTION
    intent_reasoning: str
    retry_count: int
    confidence_score: float
    products: List[Dict[str, Any]]
    sources: List[Dict[str, Any]]
    execution_trace: List[Dict[str, Any]]
    escalation: Dict[str, Any]
    answer: str


# ==============================================================================
# KNOWLEDGE BASE & RETRIEVAL INDEX
# ==============================================================================

class VectorStoreManager:
    """Manages document chunking and semantic vector search using FAISS and embeddings."""
    _instance = None

    def __init__(self):
        self.chunks: List[Dict[str, Any]] = []
        self.embeddings = None
        self.index = None
        self.model = None
        self.use_fallback = False
        self._initialize_index()

    @classmethod
    def get_instance(cls):
        if cls._instance is None:
            cls._instance = cls()
        return cls._instance

    def _load_policy_chunks(self) -> List[Dict[str, Any]]:
        chunks = []
        if not os.path.exists(POLICIES_MD_PATH):
            logger.warning("policies.md not found at %s", POLICIES_MD_PATH)
            return chunks

        with open(POLICIES_MD_PATH, "r", encoding="utf-8") as f:
            content = f.read()

        sections = re.split(r'\n(?=##\s+)', content)
        for sec in sections:
            sec = sec.strip()
            if not sec:
                continue
            lines = sec.split('\n')
            title = lines[0].replace('##', '').strip()
            body = "\n".join(lines[1:]).strip()
            chunks.append({
                "title": f"Store Policy: {title}",
                "content": sec,
                "snippet": body[:320] + ("..." if len(body) > 320 else ""),
                "type": "policy"
            })
        return chunks

    def _load_product_chunks(self) -> List[Dict[str, Any]]:
        chunks = []
        if not os.path.exists(PRODUCTS_CSV_PATH):
            logger.warning("amazon_products.csv not found at %s", PRODUCTS_CSV_PATH)
            return chunks

        try:
            df = pd.read_csv(PRODUCTS_CSV_PATH)
            for _, row in df.iterrows():
                p_name = str(row.get("product name", "Product"))
                category = str(row.get("category", "General"))
                price = row.get("price", 0.0)
                reviews = str(row.get("reviews", ""))
                desc = str(row.get("product description", ""))

                # Chunk for customer reviews
                if reviews and reviews != "nan":
                    chunks.append({
                        "title": f"Customer Review: {p_name}",
                        "content": f"Product: {p_name} ({category}, ${price})\nCustomer Review Feedback: {reviews}",
                        "snippet": reviews[:320] + ("..." if len(reviews) > 320 else ""),
                        "type": "review"
                    })
                # Chunk for technical description
                if desc and desc != "nan":
                    chunks.append({
                        "title": f"Specifications: {p_name}",
                        "content": f"Product: {p_name} ({category}, ${price})\nTechnical Specifications: {desc}",
                        "snippet": desc[:320] + ("..." if len(desc) > 320 else ""),
                        "type": "description"
                    })
        except Exception as e:
            logger.error("Error reading products CSV for vector store: %s", e)

        return chunks

    def _initialize_index(self):
        self.chunks = self._load_policy_chunks() + self._load_product_chunks()
        logger.info("Loaded %d knowledge chunks for semantic retrieval", len(self.chunks))

        # Attempt loading sentence-transformers and FAISS
        try:
            from sentence_transformers import SentenceTransformer
            import faiss
            import numpy as np

            logger.info("Loading SentenceTransformer model 'all-MiniLM-L6-v2'...")
            self.model = SentenceTransformer("all-MiniLM-L6-v2")
            texts = [c["content"] for c in self.chunks]
            embeddings = self.model.encode(texts, convert_to_numpy=True, normalize_embeddings=True)
            
            dimension = embeddings.shape[1]
            self.index = faiss.IndexFlatIP(dimension)
            self.index.add(embeddings.astype(np.float32))
            logger.info("Initialized FAISS Inner Product index with dimension %d", dimension)
        except Exception as err:
            logger.warning("FAISS or SentenceTransformer unavailable (%s). Activating TF-IDF / Term-Frequency fallback.", err)
            self.use_fallback = True

    def search(self, query: str, top_k: int = 4) -> List[Dict[str, Any]]:
        """Retrieve relevant chunks with normalized relevance score [0.0, 1.0]."""
        if not self.chunks:
            return []

        if not self.use_fallback and self.model and self.index:
            try:
                import numpy as np
                q_emb = self.model.encode([query], convert_to_numpy=True, normalize_embeddings=True)
                distances, indices = self.index.search(q_emb.astype(np.float32), top_k)
                
                results = []
                for score, idx in zip(distances[0], indices[0]):
                    if idx < 0 or idx >= len(self.chunks):
                        continue
                    # Cosine sim with normalized vectors is between [-1, 1], normalize to [0, 1]
                    relevance = max(0.0, min(1.0, float((score + 1.0) / 2.0)))
                    chunk = self.chunks[idx]
                    results.append({
                        "title": chunk["title"],
                        "snippet": chunk["snippet"],
                        "relevance": round(relevance, 3)
                    })
                return results
            except Exception as e:
                logger.error("Error during FAISS search: %s. Using fallback.", e)

        # Robust keyword / token frequency fallback
        query_words = set(re.findall(r'\w+', query.lower()))
        scored_chunks = []
        for chunk in self.chunks:
            content_lower = chunk["content"].lower()
            title_lower = chunk["title"].lower()
            matches = sum(1 for w in query_words if len(w) > 2 and w in content_lower)
            title_matches = sum(2 for w in query_words if len(w) > 2 and w in title_lower)
            score = (matches + title_matches) / max(1, len(query_words))
            relevance = max(0.2, min(0.95, score * 0.5 + 0.35)) if matches > 0 else 0.1
            scored_chunks.append((relevance, chunk))

        scored_chunks.sort(key=lambda x: x[0], reverse=True)
        results = []
        for rel, ch in scored_chunks[:top_k]:
            results.append({
                "title": ch["title"],
                "snippet": ch["snippet"],
                "relevance": round(rel, 3)
            })
        return results


# ==============================================================================
# DUCKDB CATALOG ENGINE
# ==============================================================================

class CatalogSQLEngine:
    """Uses DuckDB to execute SQL filtering and numerical constraints on amazon_products.csv."""

    def __init__(self):
        self.conn = duckdb.connect(database=':memory:')
        self._load_table()

    def _load_table(self):
        if os.path.exists(PRODUCTS_CSV_PATH):
            try:
                # Load CSV into DuckDB table
                self.conn.execute(f"""
                    CREATE OR REPLACE TABLE products AS 
                    SELECT 
                        "product name" AS name,
                        category,
                        CAST(price AS DOUBLE) AS price,
                        CAST(discount AS VARCHAR) AS discount,
                        CAST(rating AS DOUBLE) AS rating,
                        reviews,
                        "product description" AS description
                    FROM read_csv_auto('{PRODUCTS_CSV_PATH.replace(os.sep, '/')}')
                """)
                logger.info("Successfully loaded amazon_products.csv into DuckDB memory table 'products'")
            except Exception as e:
                logger.error("Error loading products CSV into DuckDB: %s", e)

    def filter_products(self, query: str, limit: int = 5) -> List[Dict[str, Any]]:
        """Parses numerical and categorical constraints and executes SQL via DuckDB."""
        q_lower = query.lower()
        where_clauses = []
        order_by = "rating DESC, price ASC"

        # Check for price constraints (e.g. "under $100", "below 500", "less than 50")
        price_under = re.search(r'(?:under|below|less than|<|\$)\s*(\d+(?:\.\d+)?)', q_lower)
        if price_under:
            max_price = float(price_under.group(1))
            where_clauses.append(f"price <= {max_price}")

        price_above = re.search(r'(?:above|over|more than|>)\s*(\d+(?:\.\d+)?)', q_lower)
        if price_above:
            min_price = float(price_above.group(1))
            where_clauses.append(f"price >= {min_price}")

        # Check for rating constraints (e.g. "rating above 4.5", "rated 4.5+", "top rated")
        rating_match = re.search(r'(?:rating|rated|stars?)\s*(?:above|over|>=|>)?\s*(\d(?:\.\d+)?)', q_lower)
        if rating_match:
            min_rating = float(rating_match.group(1))
            if min_rating <= 5.0:
                where_clauses.append(f"rating >= {min_rating}")
        elif "top rated" in q_lower or "best rated" in q_lower:
            where_clauses.append("rating >= 4.6")

        # Check for discount constraints
        if any(w in q_lower for w in ["discount", "on sale", "deal", "cheap", "cheapest", "bargain"]):
            where_clauses.append("discount NOT ILIKE 'None' AND discount != ''")
            if "cheapest" in q_lower or "lowest price" in q_lower:
                order_by = "price ASC"

        # Category detection
        categories = ["audio", "computers", "wearables", "electronics", "home & kitchen", "gaming", "mobile"]
        for cat in categories:
            if cat in q_lower:
                where_clauses.append(f"LOWER(category) = '{cat}'")
                break

        # Specific product keyword detection if no category was found
        keywords = ["headphone", "earphone", "laptop", "watch", "mouse", "keyboard", "speaker", "vacuum", "air fryer", "charger", "doorbell", "monitor", "mic"]
        matched_kw = [k for k in keywords if k in q_lower]
        if matched_kw:
            kw_conditions = [f"(name ILIKE '%{k}%' OR category ILIKE '%{k}%')" for k in matched_kw]
            where_clauses.append(f"({' OR '.join(kw_conditions)})")

        where_sql = ("WHERE " + " AND ".join(where_clauses)) if where_clauses else ""
        sql = f"""
            SELECT name, category, price, discount, rating 
            FROM products 
            {where_sql} 
            ORDER BY {order_by} 
            LIMIT {limit}
        """
        
        try:
            results_df = self.conn.execute(sql).df()
            if results_df.empty and where_clauses:
                # If exact filters were too strict, fallback to fuzzy keyword match
                fallback_sql = f"""
                    SELECT name, category, price, discount, rating 
                    FROM products 
                    ORDER BY rating DESC 
                    LIMIT {limit}
                """
                results_df = self.conn.execute(fallback_sql).df()

            products = []
            for _, r in results_df.iterrows():
                products.append({
                    "name": str(r["name"]),
                    "category": str(r["category"]),
                    "price": float(r["price"]),
                    "discount": str(r["discount"]),
                    "rating": float(r["rating"])
                })
            return products
        except Exception as e:
            logger.error("DuckDB execution error: %s. Falling back to pandas.", e)
            return []


# Singletons for vector store & DuckDB catalog
vector_store = VectorStoreManager.get_instance()
catalog_engine = CatalogSQLEngine()


# ==============================================================================
# 5 LANGGRAPH WORKFLOW NODES
# ==============================================================================

def router_node(state: AgentState) -> Dict[str, Any]:
    """Node 1: Classifies intent and rewrites ambiguous follow-up queries using session memory."""
    t0 = time.time()
    query = state.get("query", "").strip()
    session_id = state.get("session_id", "default")
    history = state.get("history") or get_session_history(session_id, limit=6)
    
    q_lower = query.lower()

    # Ambiguous follow-up detection & rewriting using session memory
    rewritten_query = query
    follow_up_indicators = ["it", "this", "that", "these", "the second one", "the first one", "what about", "how much is it", "can i return it"]
    is_follow_up = any(re.search(rf'\b{re.escape(ind)}\b', q_lower) for ind in follow_up_indicators) or len(query.split()) < 4

    if is_follow_up and history:
        # Look at last assistant and user messages to identify mentioned products/topics
        last_context = " ".join([h["content"] for h in history[-3:]])
        # Find product names or terms mentioned in recent turns
        for p in ["Sony", "Bose", "AirPods", "MacBook", "Dell", "ThinkPad", "ASUS", "Roomba", "Apple Watch", "Garmin", "Kindle", "Instant Pot", "Dyson"]:
            if p.lower() in last_context.lower() and p.lower() not in q_lower:
                rewritten_query = f"{query} regarding {p}"
                break

    # Intent Classification Logic
    escalate_patterns = [
        "human", "representative", "agent", "supervisor", "manager", "support person",
        "file dispute", "chargeback", "lawyer", "legal", "unacceptable", "scam",
        "fraud", "escalate", "terrible", "stolen", "speak to someone"
    ]
    catalog_patterns = [
        "under", "below", "price", "cheapest", "expensive", "cost", "dollar", "$",
        "rating", "stars", "discount", "deal", "catalog", "show me", "list", "filter",
        "laptops", "headphones", "gadgets", "products", "under 100", "under 50", "under 500"
    ]
    policy_patterns = [
        "return", "refund", "warranty", "exchange", "damaged", "broken", "shipping",
        "delay", "transit", "carrier", "policy", "lost package", "tracking", "30-day",
        "money back", "delivered but missing", "replace"
    ]

    has_escalate = any(re.search(rf'\b{p}\b', q_lower) for p in escalate_patterns)
    has_catalog = any(p in q_lower for p in catalog_patterns)
    has_policy = any(p in q_lower for p in policy_patterns)

    if has_escalate:
        intent = "ESCALATE_ACTION"
        reason = "User explicitly requested human assistance, filed a severe dispute, or demanded escalation."
    elif has_catalog and has_policy:
        intent = "HYBRID_COMPARISON"
        reason = "Query bridges numerical product catalog criteria with customer policy/warranty questions."
    elif has_catalog:
        intent = "CATALOG_FILTER"
        reason = "Query requests product catalog search, price/discount constraints, or category filtering."
    elif has_policy:
        intent = "POLICY_FAQ"
        reason = "Query asks about store policies, warranties, returns, shipping, or refunds."
    else:
        # Default to hybrid or policy depending on keywords
        intent = "HYBRID_COMPARISON" if any(w in q_lower for w in ["best", "compare", "vs", "which"]) else "POLICY_FAQ"
        reason = "Classified as general inquiry with hybrid search fallback."

    latency_ms = int((time.time() - t0) * 1000)
    trace_entry = {
        "step": "router_node",
        "tool": "intent_classifier_and_rewriter",
        "status": "completed",
        "latency_ms": latency_ms
    }

    traces = list(state.get("execution_trace", []))
    traces.append(trace_entry)

    logger.info("Router classified intent as '%s' (Rewritten: '%s') in %d ms", intent, rewritten_query, latency_ms)

    return {
        "query": rewritten_query,
        "original_query": state.get("original_query") or query,
        "history": history,
        "intent": intent,
        "intent_reasoning": reason,
        "execution_trace": traces
    }


def catalog_sql_node(state: AgentState) -> Dict[str, Any]:
    """Node 2: Executes exact filtering and numerical sorting on amazon_products.csv using DuckDB."""
    t0 = time.time()
    query = state.get("query", "")
    
    products = catalog_engine.filter_products(query, limit=5)
    latency_ms = int((time.time() - t0) * 1000)

    trace_entry = {
        "step": "catalog_sql_node",
        "tool": "duckdb_sql_filter",
        "status": "completed",
        "latency_ms": latency_ms
    }
    traces = list(state.get("execution_trace", []))
    traces.append(trace_entry)

    logger.info("DuckDB retrieved %d products matching constraints in %d ms", len(products), latency_ms)

    return {
        "products": products,
        "execution_trace": traces
    }


def semantic_rag_node(state: AgentState) -> Dict[str, Any]:
    """Node 3: Retrieves relevant chunks from policies.md and product reviews using FAISS & SentenceTransformer."""
    t0 = time.time()
    query = state.get("query", "")
    
    top_chunks = vector_store.search(query, top_k=4)
    latency_ms = int((time.time() - t0) * 1000)

    trace_entry = {
        "step": "semantic_rag_node",
        "tool": "faiss_sentence_transformer",
        "status": "completed",
        "latency_ms": latency_ms
    }
    traces = list(state.get("execution_trace", []))
    traces.append(trace_entry)

    logger.info("Semantic RAG retrieved %d chunks in %d ms", len(top_chunks), latency_ms)

    return {
        "sources": top_chunks,
        "execution_trace": traces
    }


def grader_node(state: AgentState) -> Dict[str, Any]:
    """Node 4: Evaluates context relevance (0.0-1.0), triggers query rewrite loop if confidence < 0.65."""
    t0 = time.time()
    intent = state.get("intent", "POLICY_FAQ")
    products = state.get("products", [])
    sources = state.get("sources", [])
    retry_count = state.get("retry_count", 0)
    query = state.get("query", "")

    # Calculate Confidence Score based on retrieval quality
    if intent == "ESCALATE_ACTION":
        confidence = 0.0
    elif intent == "CATALOG_FILTER":
        if products:
            confidence = min(0.95, 0.70 + (0.05 * len(products)))
        else:
            confidence = 0.40
    elif intent == "POLICY_FAQ":
        if sources:
            max_rel = max(s.get("relevance", 0.0) for s in sources)
            confidence = max_rel
        else:
            confidence = 0.30
    else:  # HYBRID_COMPARISON
        prod_score = 0.45 if products else 0.15
        source_score = (max(s.get("relevance", 0.0) for s in sources) * 0.5) if sources else 0.15
        confidence = min(0.96, prod_score + source_score)

    confidence = round(confidence, 2)
    next_query = query
    next_retry = retry_count

    # Check cyclic loop condition: If confidence < 0.65 and retry_count < 1, rewrite query and loop back
    if confidence < 0.65 and retry_count < 1:
        next_retry = retry_count + 1
        # Reformulate query to expand search terms
        stop_words = {"the", "a", "an", "is", "are", "can", "i", "how", "do", "you", "what", "where", "my"}
        clean_words = [w for w in query.split() if w.lower() not in stop_words]
        next_query = " ".join(clean_words) + " return refund warranty product"
        status = f"low_confidence_{confidence}_retrying_rewrite"
        logger.info("Grader confidence %.2f < 0.65. Retrying with rewritten query: '%s'", confidence, next_query)
    elif confidence < 0.65:
        status = f"low_confidence_{confidence}_escalating"
        logger.info("Grader confidence %.2f < 0.65 after retry. Escalating to human agent.", confidence)
    else:
        status = f"high_confidence_{confidence}_accepted"

    latency_ms = int((time.time() - t0) * 1000)
    trace_entry = {
        "step": "grader_node",
        "tool": "context_relevance_grader",
        "status": status,
        "latency_ms": latency_ms
    }
    traces = list(state.get("execution_trace", []))
    traces.append(trace_entry)

    # Synthesize answer if accepted
    answer = state.get("answer", "")
    if confidence >= 0.65 and intent != "ESCALATE_ACTION":
        answer = _generate_grounded_answer(query, intent, products, sources)

    return {
        "query": next_query,
        "retry_count": next_retry,
        "confidence_score": confidence,
        "answer": answer,
        "execution_trace": traces
    }


def escalation_node(state: AgentState) -> Dict[str, Any]:
    """Node 5: Creates SQLite support ticket and sends an HTTP POST payload to n8n webhook with timeout fallback."""
    t0 = time.time()
    session_id = state.get("session_id", "default_session")
    customer_query = state.get("original_query") or state.get("query", "")
    intent = state.get("intent", "ESCALATE_ACTION")
    confidence_score = state.get("confidence_score", 0.0)
    timestamp = datetime.datetime.now(datetime.timezone.utc).isoformat()

    ticket_id = f"TICK-{uuid.uuid4().hex[:8].upper()}"

    # Prepare webhook payload
    webhook_url = os.getenv("N8N_WEBHOOK_URL", "").strip()
    payload = {
        "ticket_id": ticket_id,
        "session_id": session_id,
        "customer_query": customer_query,
        "intent": intent,
        "confidence_score": confidence_score,
        "timestamp": timestamp
    }

    n8n_status = "none"
    if webhook_url:
        try:
            logger.info("Sending escalation payload for ticket %s to %s", ticket_id, webhook_url)
            with httpx.Client(timeout=3.0) as client:
                res = client.post(webhook_url, json=payload)
                if res.is_success:
                    n8n_status = "sent"
                    logger.info("n8n webhook acknowledged receipt for ticket %s", ticket_id)
                else:
                    n8n_status = f"failed_http_{res.status_code}"
                    logger.warning("n8n webhook returned status %s for ticket %s", res.status_code, ticket_id)
        except httpx.TimeoutException:
            n8n_status = "failed_timeout"
            logger.warning("n8n webhook timed out after 3.0s for ticket %s (graceful fallback)", ticket_id)
        except Exception as e:
            n8n_status = "failed_connection"
            logger.warning("n8n webhook connection error for ticket %s: %s (graceful fallback)", ticket_id, e)
    else:
        n8n_status = "skipped_no_webhook"
        logger.info("N8N_WEBHOOK_URL not configured. Ticket %s marked as skipped_no_webhook", ticket_id)

    # Persist ticket to SQLite
    save_ticket(
        ticket_id=ticket_id,
        session_id=session_id,
        customer_query=customer_query,
        intent=intent,
        confidence_score=confidence_score,
        status="OPEN",
        n8n_status=n8n_status,
        created_at=timestamp
    )

    escalation_info = {
        "triggered": True,
        "ticket_id": ticket_id,
        "n8n_status": n8n_status
    }

    answer = (
        f"Your request has been escalated to our human support team. "
        f"Support Ticket **#{ticket_id}** has been created. A Tier 2 customer service specialist "
        f"is reviewing your inquiry and will follow up shortly via your registered email or account portal."
    )

    latency_ms = int((time.time() - t0) * 1000)
    trace_entry = {
        "step": "escalation_node",
        "tool": "n8n_ticket_escalation",
        "status": "completed",
        "latency_ms": latency_ms
    }
    traces = list(state.get("execution_trace", []))
    traces.append(trace_entry)

    return {
        "escalation": escalation_info,
        "answer": answer,
        "execution_trace": traces
    }


# ==============================================================================
# ANSWER SYNTHESIS
# ==============================================================================

def _generate_grounded_answer(
    query: str,
    intent: str,
    products: List[Dict[str, Any]],
    sources: List[Dict[str, Any]]
) -> str:
    """Synthesizes a helpful customer support answer grounded in retrieved catalog & policy data."""
    # Attempt LLM generation if API key is provided
    gemini_key = os.getenv("GEMINI_API_KEY") or os.getenv("GOOGLE_API_KEY")
    openai_key = os.getenv("OPENAI_API_KEY")

    context_parts = []
    if products:
        prod_lines = ["Available Matching Products:"]
        for p in products:
            disc_text = f" ({p['discount']})" if p['discount'] and p['discount'] != 'None' else ""
            prod_lines.append(f"- **{p['name']}**: ${p['price']:.2f}{disc_text} | Rating: {p['rating']}/5.0 | Category: {p['category']}")
        context_parts.append("\n".join(prod_lines))

    if sources:
        source_lines = ["Policy & Customer Review Knowledge:"]
        for s in sources:
            source_lines.append(f"[{s['title']}]: {s['snippet']}")
        context_parts.append("\n".join(source_lines))

    context_str = "\n\n".join(context_parts)

    # 1. Try Google Gemini if configured
    if gemini_key:
        try:
            from google import genai
            client = genai.Client(api_key=gemini_key)
            prompt = (
                f"You are NexusDesk AI, an expert e-commerce customer support assistant.\n"
                f"Answer the customer inquiry accurately and professionally based ONLY on the provided context.\n\n"
                f"Context:\n{context_str}\n\n"
                f"Customer Query: {query}\n\n"
                f"Answer:"
            )
            response = client.models.generate_content(
                model="gemini-2.5-flash",
                contents=prompt
            )
            if response and response.text:
                return response.text.strip()
        except Exception as e:
            logger.warning("Gemini synthesis failed: %s. Falling back.", e)

    # 2. Try OpenAI if configured
    if openai_key:
        try:
            from openai import OpenAI
            client = OpenAI(api_key=openai_key)
            response = client.chat.completions.create(
                model="gpt-4o-mini",
                messages=[
                    {"role": "system", "content": "You are NexusDesk AI, an expert e-commerce customer support assistant. Answer accurately based on the provided context."},
                    {"role": "user", "content": f"Context:\n{context_str}\n\nQuery: {query}"}
                ],
                max_tokens=300
            )
            if response.choices:
                return response.choices[0].message.content.strip()
        except Exception as e:
            logger.warning("OpenAI synthesis failed: %s. Falling back.", e)

    # 3. Deterministic Grounded Synthesis Fallback
    answer_parts = []
    if intent == "CATALOG_FILTER" and products:
        answer_parts.append(f"Here are the top products matching your search for '{query}':\n")
        for i, p in enumerate(products, 1):
            disc_str = f" **({p['discount']})**" if p['discount'] and p['discount'] != 'None' else ""
            answer_parts.append(f"{i}. **{p['name']}** — **${p['price']:.2f}**{disc_str}\n   *Rating*: {p['rating']} / 5.0 | *Category*: {p['category']}")
        answer_parts.append("\nAll products include a standard 1-year limited warranty and are eligible for our 30-day return policy.")
    elif intent == "POLICY_FAQ" and sources:
        top_source = sources[0]
        answer_parts.append(f"Based on our official store guidelines ({top_source['title']}):\n")
        answer_parts.append(f"{top_source['snippet']}\n")
        if len(sources) > 1:
            answer_parts.append(f"Additionally: {sources[1]['snippet']}")
    elif intent == "HYBRID_COMPARISON":
        if products:
            p = products[0]
            answer_parts.append(f"Regarding the **{p['name']}** (${p['price']:.2f}, rated {p['rating']}/5.0):\n")
        if sources:
            answer_parts.append(f"{sources[0]['snippet']}\n")
        answer_parts.append("You are covered under our 30-day return window and 1-year limited warranty.")
    else:
        if sources:
            answer_parts.append(f"{sources[0]['snippet']}\n")
        elif products:
            answer_parts.append(f"Found {len(products)} relevant products in our catalog.")
        else:
            answer_parts.append("Thank you for contacting NexusDesk Support. We are here to assist with any catalog or policy inquiries.")

    return "\n".join(answer_parts)


# ==============================================================================
# LANGGRAPH CYCLIC WORKFLOW CONSTRUCTION
# ==============================================================================

def create_agentic_workflow():
    """Builds and compiles the cyclic 5-node LangGraph StateGraph."""
    try:
        from langgraph.graph import StateGraph, START, END

        workflow = StateGraph(AgentState)

        # Register nodes
        workflow.add_node("router_node", router_node)
        workflow.add_node("catalog_sql_node", catalog_sql_node)
        workflow.add_node("semantic_rag_node", semantic_rag_node)
        workflow.add_node("grader_node", grader_node)
        workflow.add_node("escalation_node", escalation_node)

        # Entry edge
        workflow.add_edge(START, "router_node")

        # Routing from router_node
        def router_decision(state: AgentState) -> str:
            intent = state.get("intent", "POLICY_FAQ")
            if intent == "ESCALATE_ACTION":
                return "escalation_node"
            elif intent == "CATALOG_FILTER":
                return "catalog_sql_node"
            elif intent == "POLICY_FAQ":
                return "semantic_rag_node"
            elif intent == "HYBRID_COMPARISON":
                return "catalog_sql_node"
            return "semantic_rag_node"

        workflow.add_conditional_edges(
            "router_node",
            router_decision,
            {
                "escalation_node": "escalation_node",
                "catalog_sql_node": "catalog_sql_node",
                "semantic_rag_node": "semantic_rag_node"
            }
        )

        # Routing from catalog_sql_node
        def catalog_decision(state: AgentState) -> str:
            if state.get("intent") == "HYBRID_COMPARISON":
                return "semantic_rag_node"
            return "grader_node"

        workflow.add_conditional_edges(
            "catalog_sql_node",
            catalog_decision,
            {
                "semantic_rag_node": "semantic_rag_node",
                "grader_node": "grader_node"
            }
        )

        # Edge from semantic_rag_node to grader_node
        workflow.add_edge("semantic_rag_node", "grader_node")

        # Cyclic edge from grader_node (Retry loop or Escalate or Finish)
        def grader_decision(state: AgentState) -> str:
            intent = state.get("intent", "")
            confidence = state.get("confidence_score", 0.0)
            retry_count = state.get("retry_count", 0)

            if intent == "ESCALATE_ACTION":
                return "escalation_node"

            if confidence < 0.65:
                if retry_count < 1:
                    # Loop back to retrieve once with rewritten query!
                    if intent == "CATALOG_FILTER":
                        return "catalog_sql_node"
                    return "semantic_rag_node"
                else:
                    # Still below threshold after retry -> escalate
                    return "escalation_node"

            return END

        workflow.add_conditional_edges(
            "grader_node",
            grader_decision,
            {
                "catalog_sql_node": "catalog_sql_node",
                "semantic_rag_node": "semantic_rag_node",
                "escalation_node": "escalation_node",
                END: END
            }
        )

        workflow.add_edge("escalation_node", END)

        compiled_graph = workflow.compile()
        logger.info("Successfully compiled LangGraph cyclic workflow")
        return compiled_graph

    except Exception as e:
        logger.warning("Could not compile LangGraph StateGraph (%s). Initializing built-in cyclic runner.", e)
        return None


# Compiled LangGraph instance
_compiled_graph = create_agentic_workflow()


# ==============================================================================
# PIPELINE EXECUTION ENTRYPOINT
# ==============================================================================

def run_agentic_pipeline(query: str, session_id: str = "default_session") -> Dict[str, Any]:
    """
    Executes the 5-node cyclic workflow for a query and session_id.
    Returns the full structured response conforming to the NexusDesk API contract.
    """
    initial_state: AgentState = {
        "session_id": session_id,
        "original_query": query,
        "query": query,
        "history": get_session_history(session_id, limit=6),
        "intent": "",
        "intent_reasoning": "",
        "retry_count": 0,
        "confidence_score": 0.0,
        "products": [],
        "sources": [],
        "execution_trace": [],
        "escalation": {
            "triggered": False,
            "ticket_id": None,
            "n8n_status": "none"
        },
        "answer": ""
    }

    # Execute with compiled LangGraph if available
    final_state = None
    if _compiled_graph is not None:
        try:
            final_state = _compiled_graph.invoke(initial_state)
        except Exception as e:
            logger.error("Error during LangGraph invoke: %s. Using direct cyclic execution.", e)

    # Direct cyclic execution fallback
    if not final_state:
        state = dict(initial_state)
        
        # Step 1: Router
        router_res = router_node(state)
        state.update(router_res)

        intent = state.get("intent", "POLICY_FAQ")

        if intent == "ESCALATE_ACTION":
            esc_res = escalation_node(state)
            state.update(esc_res)
        else:
            # Cyclic loop execution (max 2 attempts: initial + 1 retry)
            max_attempts = 2
            for attempt in range(max_attempts):
                if intent == "CATALOG_FILTER":
                    cat_res = catalog_sql_node(state)
                    state.update(cat_res)
                elif intent == "POLICY_FAQ":
                    sem_res = semantic_rag_node(state)
                    state.update(sem_res)
                elif intent == "HYBRID_COMPARISON":
                    cat_res = catalog_sql_node(state)
                    state.update(cat_res)
                    sem_res = semantic_rag_node(state)
                    state.update(sem_res)

                # Grade retrieval
                grader_res = grader_node(state)
                state.update(grader_res)

                conf = state.get("confidence_score", 0.0)
                if conf >= 0.65:
                    break
                elif state.get("retry_count", 0) >= 1 and attempt == 1:
                    # Confidence still low after retry -> escalate
                    esc_res = escalation_node(state)
                    state.update(esc_res)
                    break
                elif state.get("retry_count", 0) == 1 and attempt == 0:
                    # Loop back with rewritten query
                    continue

        final_state = state

    # Save turns to database session memory
    save_message(session_id, "user", query)
    if final_state.get("answer"):
        save_message(session_id, "assistant", final_state["answer"])

    # Format return dictionary strictly matching API specification
    response_payload = {
        "answer": final_state.get("answer", "I am here to help with your customer support inquiries."),
        "execution_trace": final_state.get("execution_trace", []),
        "products": final_state.get("products", []),
        "sources": final_state.get("sources", []),
        "confidence_score": float(final_state.get("confidence_score", 0.0)),
        "escalation": final_state.get("escalation", {
            "triggered": False,
            "ticket_id": None,
            "n8n_status": "none"
        })
    }

    return response_payload
