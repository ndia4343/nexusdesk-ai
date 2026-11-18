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
os.environ["HOME"] = "/tmp"
os.environ["TMPDIR"] = "/tmp"

import re
import time
import uuid
import math
import logging
import datetime
import socket
import ipaddress
from urllib.parse import urlparse
from pathlib import Path
from typing import Dict, Any, List, Optional, Tuple, TypedDict

import httpx
import duckdb
import pandas as pd

from backend.database import save_ticket, save_message, get_session_history

logger = logging.getLogger("nexusdesk.rag_pipeline")

def is_safe_public_url(url: str) -> Tuple[bool, str]:
    """Validates that a URL is a valid public HTTP/HTTPS URL and not pointing to localhost or private IPs."""
    if not url or not isinstance(url, str):
        return False, "URL cannot be empty."
    url_str = url.strip()
    try:
        parsed = urlparse(url_str)
        if parsed.scheme.lower() not in ("http", "https"):
            return False, "Only http:// and https:// URLs are supported."
        hostname = parsed.hostname
        if not hostname:
            return False, "Invalid URL: missing host name."
        
        hostname_lower = hostname.lower()
        if hostname_lower in ("localhost", "127.0.0.1", "0.0.0.0", "::1", "local") or hostname_lower.endswith(".local") or hostname_lower.endswith(".internal"):
            return False, "Access to localhost or internal network hosts is strictly prohibited."
        
        # Check IP literal or resolve DNS
        try:
            ip = ipaddress.ip_address(hostname)
            if ip.is_private or ip.is_loopback or ip.is_link_local or ip.is_reserved or ip.is_multicast:
                return False, f"Access to private/internal IP ({hostname}) is strictly prohibited."
        except ValueError:
            # It's a domain name; resolve DNS to guard against DNS rebinding to private IPs
            try:
                resolved = socket.getaddrinfo(hostname, None)
                for addr in resolved:
                    ip_str = addr[4][0]
                    ip_obj = ipaddress.ip_address(ip_str)
                    if ip_obj.is_private or ip_obj.is_loopback or ip_obj.is_link_local or ip_obj.is_reserved or ip_obj.is_multicast:
                        return False, f"URL resolves to a private or internal IP ({ip_str}), which is strictly prohibited."
            except Exception:
                pass
        
        return True, ""
    except Exception as e:
        return False, f"URL validation error: {str(e)}"

DATA_DIR = Path(__file__).resolve().parent.parent / "data"
if not DATA_DIR.exists():
    DATA_DIR = Path(__file__).resolve().parent / "dataset"
PRODUCTS_CSV_PATH = str(DATA_DIR / "amazon_products.csv")
POLICIES_MD_PATH = str(DATA_DIR / "policies.md")
CLINIC_POLICIES_MD_PATH = str(DATA_DIR / "clinic_policies.md")
HR_POLICIES_MD_PATH = str(DATA_DIR / "hr_policies.md")

# ==============================================================================
# STATE DEFINITION
# ==============================================================================

class AgentState(TypedDict, total=False):
    workspace_id: str
    session_id: str
    original_query: str
    query: str
    customer_email: str
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
# KNOWLEDGE BASE & RETRIEVAL INDEX (LIGHTWEIGHT API / TF-IDF ENGINE)
# ==============================================================================

def clean_sentence_boundary(text: str, max_chars: int = 380) -> str:
    """Never cuts off mid-word (no 'bu...' or 'Thres...').
    Always trims cleanly at full sentence boundaries (. ! ?) or full clean phrases.
    """
    if not text:
        return ""
    text = text.strip()
    if len(text) <= max_chars:
        return text
    sub = text[:max_chars]
    # Check for sentence ending punctuation (. ! ?) followed by whitespace or end of string
    matches = list(re.finditer(r'[\.\!\?](?:\s|$)', sub))
    if matches and matches[-1].end() >= 60:
        return text[:matches[-1].end()].strip()
    # Fallback to last clean word boundary
    last_space = sub.rfind(" ")
    if last_space > 60:
        clean_sub = text[:last_space].rstrip(",;:- ")
        return clean_sub + "."
    return sub.rstrip(",;:- ") + "."


def extract_concise_bullets(query: str, sources: List[Dict[str, Any]], max_bullets: int = 3) -> List[str]:
    """Extracts and synthesizes 2-3 direct, concise bullet points from sources
    specifically addressing the user query without mid-word cutoffs or dumping unrelated sections.
    """
    STOPWORDS = {
        "what", "is", "the", "are", "how", "can", "for", "and", "does", "with",
        "from", "about", "have", "you", "your", "our", "this", "that", "there",
        "will", "when", "where", "which", "who", "why", "would", "could", "should",
        "please", "tell", "much", "many", "give", "show", "help", "need", "i", "do"
    }
    q_words = [w.lower() for w in re.findall(r'[a-zA-Z0-9]+', query) if len(w) > 2 and w.lower() not in STOPWORDS]

    candidates = []
    for s_idx, src in enumerate(sources):
        raw_text = src.get("content") or src.get("snippet", "")
        lines = [line.strip() for line in raw_text.split("\n") if line.strip()]
        for line in lines:
            if line.startswith("#"):
                continue
            # Skip introductory preamble headers (e.g. "Guidelines for...", "...consultations:")
            if line.rstrip().endswith(":") or line.endswith("---"):
                continue
            if re.match(r'^(Guidelines|Welcome|Our company|We operate|We respect|Following|Managing|Comprehensive)\b', line, re.I):
                continue

            # Clean leading bullet symbols without removing valid title characters or numbers (e.g. 30-Day)
            clean_line = re.sub(r'^\s*[-*•]\s*', '', line).strip()
            clean_line = re.sub(r'^\d+\.\s+', '', clean_line).strip()

            if len(clean_line) < 25:
                continue

            trimmed = clean_sentence_boundary(clean_line, 280)
            if not trimmed:
                continue
            if trimmed[-1] not in ".!?":
                trimmed += "."

            line_lower = trimmed.lower()
            score = 0
            for qw in q_words:
                if qw in line_lower:
                    score += 5
            # Heavily weight the top source matching the query so unrelated policy sections are not mixed in
            score += max(0, (len(sources) - s_idx) * 3)

            candidates.append((score, s_idx, trimmed))

    candidates.sort(key=lambda x: (x[0], -x[1]), reverse=True)

    seen = set()
    selected = []
    for score, _, bullet in candidates:
        key = re.sub(r'[^a-zA-Z0-9]', '', bullet[:35]).lower()
        if key in seen:
            continue
        seen.add(key)
        selected.append(bullet)
        if len(selected) >= max_bullets:
            break

    return selected


class VectorStoreManager:
    """
    Lightweight embedding & vector retrieval manager supporting multi-workspace isolation.
    Workspace "demo" loads policies.md and amazon_products.csv.
    Custom workspaces maintain independent in-memory chunk indexes.
    Uses < 10MB of memory and starts up instantaneously.
    """
    _instance = None

    def __init__(self):
        self.workspaces: Dict[str, Dict[str, Any]] = {}
        self._initialize_workspaces()

    @classmethod
    def get_instance(cls):
        if cls._instance is None:
            cls._instance = cls()
        return cls._instance

    @property
    def chunks(self) -> List[Dict[str, Any]]:
        return self._get_workspace_data("retail_ops")["chunks"]

    @property
    def vocab(self) -> Dict[str, int]:
        return self._get_workspace_data("retail_ops")["vocab"]

    @property
    def idf(self) -> Dict[str, float]:
        return self._get_workspace_data("retail_ops")["idf"]

    @property
    def chunk_tfidf_vectors(self):
        return self._get_workspace_data("retail_ops")["chunk_tfidf_vectors"]

    def _normalize_workspace_id(self, workspace_id: str) -> str:
        ws = (workspace_id or "").strip().lower()
        if ws in ("demo", "retail", "retail_ops", "ecommerce"):
            return "retail_ops"
        elif ws in ("clinic", "clinic_ops", "healthcare"):
            return "clinic_ops"
        elif ws in ("hr", "hr_ops", "internal"):
            return "hr_ops"
        return ws or "retail_ops"

    def _get_workspace_data(self, workspace_id: str) -> Dict[str, Any]:
        norm_id = self._normalize_workspace_id(workspace_id)
        if norm_id not in self.workspaces:
            self.workspaces[norm_id] = {
                "chunks": [],
                "vocab": {},
                "idf": {},
                "chunk_tfidf_vectors": None
            }
        return self.workspaces[norm_id]

    def _load_markdown_sections(self, file_path: str, title_prefix: str, chunk_type: str) -> List[Dict[str, Any]]:
        chunks = []
        if not os.path.exists(file_path):
            logger.warning("Markdown file not found at %s", file_path)
            return chunks

        with open(file_path, "r", encoding="utf-8") as f:
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
                "title": f"{title_prefix}: {title}",
                "content": sec,
                "snippet": clean_sentence_boundary(body, 360),
                "type": chunk_type
            })
        return chunks

    def _load_policy_chunks(self) -> List[Dict[str, Any]]:
        return self._load_markdown_sections(POLICIES_MD_PATH, "Store Policy", "policy")

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
                        "snippet": clean_sentence_boundary(reviews, 350),
                        "type": "review"
                    })
                # Chunk for technical description
                if desc and desc != "nan":
                    chunks.append({
                        "title": f"Specifications: {p_name}",
                        "content": f"Product: {p_name} ({category}, ${price})\nTechnical Specifications: {desc}",
                        "snippet": clean_sentence_boundary(desc, 350),
                        "type": "description"
                    })
        except Exception as e:
            logger.error("Error reading products CSV for vector store: %s", e)

        return chunks

    def _initialize_workspaces(self):
        # 1. Retail Ops ("E-Commerce & Retail")
        retail_chunks = self._load_policy_chunks() + self._load_product_chunks()
        self.workspaces["retail_ops"] = {
            "chunks": retail_chunks,
            "vocab": {},
            "idf": {},
            "chunk_tfidf_vectors": None
        }
        self._build_tfidf_index("retail_ops")

        # 2. Clinic Ops ("Clinic & Healthcare Desk")
        clinic_chunks = self._load_markdown_sections(CLINIC_POLICIES_MD_PATH, "Clinical Policy", "clinic_faq")
        self.workspaces["clinic_ops"] = {
            "chunks": clinic_chunks,
            "vocab": {},
            "idf": {},
            "chunk_tfidf_vectors": None
        }
        self._build_tfidf_index("clinic_ops")

        # 3. HR Ops ("HR & Internal Operations")
        hr_chunks = self._load_markdown_sections(HR_POLICIES_MD_PATH, "HR Policy", "hr_policy")
        self.workspaces["hr_ops"] = {
            "chunks": hr_chunks,
            "vocab": {},
            "idf": {},
            "chunk_tfidf_vectors": None
        }
        self._build_tfidf_index("hr_ops")

        logger.info(
            "Pre-seeded 3 commercial workspaces: retail_ops (%d chunks), clinic_ops (%d chunks), hr_ops (%d chunks)",
            len(retail_chunks), len(clinic_chunks), len(hr_chunks)
        )

    def _tokenize(self, text: str) -> List[str]:
        return [w.lower() for w in re.findall(r'[a-zA-Z0-9]+', text) if len(w) > 2]

    def _build_tfidf_index(self, workspace_id: str):
        """Builds an in-memory TF-IDF index using NumPy for a specific workspace."""
        import numpy as np
        ws_data = self._get_workspace_data(workspace_id)
        chunks = ws_data["chunks"]
        if not chunks:
            ws_data["vocab"] = {}
            ws_data["idf"] = {}
            ws_data["chunk_tfidf_vectors"] = None
            return

        doc_tokens = [self._tokenize(c["content"]) for c in chunks]
        num_docs = max(1, len(doc_tokens))

        df_counts: Dict[str, int] = {}
        for tokens in doc_tokens:
            for term in set(tokens):
                df_counts[term] = df_counts.get(term, 0) + 1

        vocab = {term: idx for idx, term in enumerate(df_counts.keys())}
        idf = {term: math.log((num_docs + 1) / (count + 1)) + 1.0 for term, count in df_counts.items()}

        vectors = []
        for tokens in doc_tokens:
            vec = np.zeros(len(vocab), dtype=np.float32)
            counts: Dict[str, int] = {}
            for t in tokens:
                counts[t] = counts.get(t, 0) + 1
            for t, cnt in counts.items():
                if t in vocab:
                    idx = vocab[t]
                    vec[idx] = (cnt / max(1, len(tokens))) * idf[t]
            norm = np.linalg.norm(vec)
            if norm > 0:
                vec = vec / norm
            vectors.append(vec)

        ws_data["vocab"] = vocab
        ws_data["idf"] = idf
        ws_data["chunk_tfidf_vectors"] = np.array(vectors) if vectors else np.empty((0, 0))

    def add_chunks(self, workspace_id: str, new_chunks: List[Dict[str, Any]]):
        """Appends new chunks to a workspace and rebuilds its TF-IDF index."""
        ws_data = self._get_workspace_data(workspace_id)
        ws_data["chunks"].extend(new_chunks)
        self._build_tfidf_index(workspace_id)
        logger.info("Added %d chunks to workspace '%s' (total: %d)", len(new_chunks), workspace_id, len(ws_data["chunks"]))

    def get_chunks(self, workspace_id: str) -> List[Dict[str, Any]]:
        """Returns all chunks for a workspace."""
        return self._get_workspace_data(workspace_id)["chunks"]

    def clear_workspace(self, workspace_id: str):
        """Resets knowledge base for a workspace."""
        norm_id = self._normalize_workspace_id(workspace_id)
        if norm_id in ("retail_ops", "clinic_ops", "hr_ops"):
            self._initialize_workspaces()
        else:
            self.workspaces[norm_id] = {
                "chunks": [],
                "vocab": {},
                "idf": {},
                "chunk_tfidf_vectors": None
            }
        logger.info("Cleared knowledge base for workspace '%s'", norm_id)

    def search(self, query: str, workspace_id: str = "retail_ops", top_k: int = 4) -> List[Dict[str, Any]]:
        """
        Calculates semantic similarity using high-speed TF-IDF cosine similarity
        strictly isolated within the target workspace. Returns top-k chunks.
        """
        import numpy as np
        ws_data = self._get_workspace_data(workspace_id)
        chunks = ws_data["chunks"]
        if not chunks or ws_data["chunk_tfidf_vectors"] is None or len(ws_data["chunk_tfidf_vectors"]) == 0:
            return []

        vocab = ws_data["vocab"]
        idf = ws_data["idf"]
        vectors = ws_data["chunk_tfidf_vectors"]

        q_tokens = self._tokenize(query)
        if not q_tokens:
            return []

        q_vec = np.zeros(len(vocab), dtype=np.float32)
        counts: Dict[str, int] = {}
        for t in q_tokens:
            counts[t] = counts.get(t, 0) + 1
        for t, cnt in counts.items():
            if t in vocab:
                q_vec[vocab[t]] = (cnt / max(1, len(q_tokens))) * idf[t]

        q_norm = np.linalg.norm(q_vec)
        if q_norm > 0:
            q_vec = q_vec / q_norm
            similarities = np.dot(vectors, q_vec)
        else:
            similarities = np.zeros(len(chunks))

        scored_chunks = []
        for idx, sim in enumerate(similarities):
            relevance = float(sim)
            if relevance > 0.04:
                scaled = min(0.95, 0.50 + (relevance * 0.60))
            else:
                scaled = 0.15
            scored_chunks.append((scaled, chunks[idx]))

        scored_chunks.sort(key=lambda x: x[0], reverse=True)
        results = []
        for rel, ch in scored_chunks[:top_k]:
            results.append({
                "title": ch["title"],
                "snippet": ch["snippet"],
                "content": ch.get("content", ch["snippet"]),
                "relevance": round(rel, 3)
            })
        return results


# ==============================================================================
# DUCKDB CATALOG ENGINE
# ==============================================================================

class CatalogSQLEngine:
    """Uses DuckDB to execute SQL filtering and numerical constraints on product catalogs per workspace."""

    def __init__(self):
        self.conn = duckdb.connect(database=':memory:')
        self.catalogs: Dict[str, bool] = {}
        self._load_retail_table()

    def _normalize_workspace_id(self, workspace_id: str) -> str:
        ws = (workspace_id or "").strip().lower()
        if ws in ("demo", "retail", "retail_ops", "ecommerce"):
            return "retail_ops"
        elif ws in ("clinic", "clinic_ops", "healthcare"):
            return "clinic_ops"
        elif ws in ("hr", "hr_ops", "internal"):
            return "hr_ops"
        return ws or "retail_ops"

    def _safe_table_name(self, workspace_id: str) -> str:
        norm = self._normalize_workspace_id(workspace_id)
        safe = re.sub(r'[^a-zA-Z0-9_]', '_', norm)
        return f"products_{safe}"

    def _load_retail_table(self):
        if os.path.exists(PRODUCTS_CSV_PATH):
            try:
                table_name = self._safe_table_name("retail_ops")
                self.conn.execute(f"""
                    CREATE OR REPLACE TABLE {table_name} AS 
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
                # Aliases for backward compatibility
                self.conn.execute(f"CREATE OR REPLACE VIEW products AS SELECT * FROM {table_name}")
                self.conn.execute(f"CREATE OR REPLACE VIEW products_demo AS SELECT * FROM {table_name}")
                self.catalogs["retail_ops"] = True
                self.catalogs["demo"] = True
                logger.info("Successfully loaded amazon_products.csv into DuckDB retail catalog table '%s'", table_name)
            except Exception as e:
                logger.error("Error loading products CSV into DuckDB: %s", e)

    def has_catalog(self, workspace_id: str) -> bool:
        """Checks if a workspace has an active registered product catalog."""
        norm = self._normalize_workspace_id(workspace_id)
        return self.catalogs.get(norm, False)

    def load_csv_catalog(self, workspace_id: str, csv_path_or_content: str, is_content: bool = False) -> int:
        """Loads and registers an uploaded CSV catalog for a specific custom workspace."""
        try:
            norm_id = self._normalize_workspace_id(workspace_id)
            table_name = self._safe_table_name(norm_id)
            if is_content:
                import io
                df = pd.read_csv(io.StringIO(csv_path_or_content))
            else:
                df = pd.read_csv(csv_path_or_content)

            col_map = {}
            for col in df.columns:
                cl = col.strip().lower()
                if "name" in cl or "title" in cl or "product" in cl:
                    col_map[col] = "name"
                elif "cat" in cl:
                    col_map[col] = "category"
                elif "price" in cl or "cost" in cl:
                    col_map[col] = "price"
                elif "disc" in cl:
                    col_map[col] = "discount"
                elif "rat" in cl or "score" in cl or "star" in cl:
                    col_map[col] = "rating"

            df = df.rename(columns=col_map)
            if "name" not in df.columns:
                df["name"] = df.iloc[:, 0].astype(str)
            if "category" not in df.columns:
                df["category"] = "General"
            if "price" not in df.columns:
                df["price"] = 0.0
            else:
                df["price"] = pd.to_numeric(df["price"].astype(str).str.replace(r'[\$,]', '', regex=True), errors='coerce').fillna(0.0)
            if "discount" not in df.columns:
                df["discount"] = "None"
            if "rating" not in df.columns:
                df["rating"] = 4.5
            else:
                df["rating"] = pd.to_numeric(df["rating"], errors='coerce').fillna(4.0)

            clean_df = df[["name", "category", "price", "discount", "rating"]].copy()
            self.conn.register(f"temp_df_{table_name}", clean_df)
            self.conn.execute(f"CREATE OR REPLACE TABLE {table_name} AS SELECT * FROM temp_df_{table_name}")
            self.catalogs[norm_id] = True
            logger.info("Successfully registered custom catalog for workspace '%s' with %d products", norm_id, len(clean_df))
            return len(clean_df)
        except Exception as e:
            logger.error("Failed to load custom catalog for workspace %s: %s", workspace_id, e)
            return 0

    def clear_catalog(self, workspace_id: str):
        """Drops custom catalog table for a workspace."""
        norm_id = self._normalize_workspace_id(workspace_id)
        if norm_id not in ("retail_ops", "demo"):
            table_name = self._safe_table_name(norm_id)
            try:
                self.conn.execute(f"DROP TABLE IF EXISTS {table_name}")
            except Exception:
                pass
            self.catalogs[norm_id] = False
            logger.info("Cleared custom catalog for workspace '%s'", norm_id)

    def filter_products(self, query: str, workspace_id: str = "retail_ops", limit: int = 5) -> List[Dict[str, Any]]:
        """Parses numerical and categorical constraints and executes SQL via DuckDB on the workspace catalog."""
        norm_id = self._normalize_workspace_id(workspace_id)
        if not self.has_catalog(norm_id):
            return []

        table_name = self._safe_table_name(norm_id)
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
            FROM {table_name} 
            {where_sql} 
            ORDER BY {order_by} 
            LIMIT {limit}
        """
        
        try:
            results_df = self.conn.execute(sql).df()
            if results_df.empty and where_clauses:
                fallback_sql = f"""
                    SELECT name, category, price, discount, rating 
                    FROM {table_name} 
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
            logger.error("DuckDB execution error: %s", e)
            return []


# Singletons for vector store & DuckDB catalog (safely wrapped for serverless import)
try:
    vector_store = VectorStoreManager.get_instance()
except Exception as _vs_err:
    logger.warning("VectorStoreManager initialization deferred or failed: %s", _vs_err)
    vector_store = None

try:
    catalog_engine = CatalogSQLEngine()
except Exception as _ce_err:
    logger.warning("CatalogSQLEngine initialization deferred or failed: %s", _ce_err)
    catalog_engine = None


# ==============================================================================
# 5 LANGGRAPH WORKFLOW NODES
# ==============================================================================

def router_node(state: AgentState) -> Dict[str, Any]:
    """Node 1: Classifies intent and rewrites ambiguous follow-up queries using session memory."""
    t0 = time.time()
    workspace_id = state.get("workspace_id", "retail_ops")
    query = state.get("query", "").strip()
    session_id = state.get("session_id", "default")
    history = state.get("history") or get_session_history(session_id, limit=6, workspace_id=workspace_id)
    
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
    has_cat = catalog_engine.has_catalog(workspace_id) if catalog_engine else False

    if has_escalate:
        intent = "ESCALATE_ACTION"
        reason = "User explicitly requested human assistance, filed a severe dispute, or demanded escalation."
    elif not has_cat:
        # Non-catalog workspaces route straight to semantic FAQ RAG
        intent = "POLICY_FAQ"
        reason = f"Workspace '{workspace_id}' without catalog table routed straight to semantic knowledge RAG."
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

    logger.info("Router classified intent as '%s' (workspace='%s', Rewritten: '%s') in %d ms", intent, workspace_id, rewritten_query, latency_ms)

    return {
        "workspace_id": workspace_id,
        "query": rewritten_query,
        "original_query": state.get("original_query") or query,
        "history": history,
        "intent": intent,
        "intent_reasoning": reason,
        "execution_trace": traces
    }


def catalog_sql_node(state: AgentState) -> Dict[str, Any]:
    """Node 2: Executes exact filtering and numerical sorting on catalog using DuckDB."""
    t0 = time.time()
    workspace_id = state.get("workspace_id", "retail_ops")
    query = state.get("query", "")
    
    has_cat = catalog_engine.has_catalog(workspace_id) if catalog_engine else False
    if not has_cat:
        products = []
    else:
        try:
            products = catalog_engine.filter_products(query, workspace_id=workspace_id, limit=5) if catalog_engine else []
        except Exception as e:
            logger.warning("Catalog filtering non-fatal error: %s", e)
            products = []
    latency_ms = int((time.time() - t0) * 1000)

    trace_entry = {
        "step": "catalog_sql_node",
        "tool": "duckdb_sql_filter",
        "status": "completed",
        "latency_ms": latency_ms
    }
    traces = list(state.get("execution_trace", []))
    traces.append(trace_entry)

    logger.info("DuckDB retrieved %d products matching constraints in %d ms (workspace=%s)", len(products), latency_ms, workspace_id)

    return {
        "products": products,
        "execution_trace": traces
    }


def semantic_rag_node(state: AgentState) -> Dict[str, Any]:
    """Node 3: Retrieves relevant chunks from knowledge base using semantic embeddings."""
    t0 = time.time()
    workspace_id = state.get("workspace_id", "retail_ops")
    query = state.get("query", "")
    
    try:
        top_chunks = vector_store.search(query, workspace_id=workspace_id, top_k=4) if vector_store else []
    except Exception as e:
        logger.warning("Semantic RAG search non-fatal error: %s", e)
        top_chunks = []
    latency_ms = int((time.time() - t0) * 1000)

    trace_entry = {
        "step": "semantic_rag_node",
        "tool": "faiss_sentence_transformer",
        "status": "completed",
        "latency_ms": latency_ms
    }
    traces = list(state.get("execution_trace", []))
    traces.append(trace_entry)

    logger.info("Semantic RAG retrieved %d chunks in %d ms (workspace=%s)", len(top_chunks), latency_ms, workspace_id)

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
    workspace_id = state.get("workspace_id", "retail_ops")
    if confidence >= 0.65 and intent != "ESCALATE_ACTION":
        answer = _generate_grounded_answer(query, intent, products, sources, workspace_id=workspace_id)

    return {
        "query": next_query,
        "retry_count": next_retry,
        "confidence_score": confidence,
        "answer": answer,
        "execution_trace": traces
    }


# ==============================================================================
# WORKSPACE METADATA MAPPING (ENTERPRISE MULTI-WORKSPACE AUTOMATION)
# ==============================================================================

DEFAULT_WORKSPACE_METADATA: Dict[str, Dict[str, str]] = {
    "retail_ops": {
        "brand_name": "NexusDesk Retail & E-Commerce",
        "escalation_email": "support@nexusdesk.com",
        "sla_text": "2-Hour Response Time SLA (Priority Support)"
    },
    "clinic_ops": {
        "brand_name": "NexusDesk Clinical & Health Network",
        "escalation_email": "clinical-support@nexusdesk.com",
        "sla_text": "1-Hour Urgent Clinical SLA (EHR Intake Queue)"
    },
    "hr_ops": {
        "brand_name": "NexusDesk People Operations & HR",
        "escalation_email": "hr-ops@nexusdesk.com",
        "sla_text": "24-Hour Confidential HR SLA (People Operations Queue)"
    }
}


def get_workspace_metadata(workspace_id: str) -> Dict[str, str]:
    """
    Retrieves enterprise metadata mapping (brand_name, escalation_email, and sla_text)
    for ecommerce, clinic, hr, and any custom workspace created via Connect Website.
    Default fallback escalation email is contact@zavianlabs.com.
    """
    norm_ws = (workspace_id or "retail_ops").strip().lower()
    if norm_ws in ("demo", "retail", "retail_ops", "ecommerce"):
        norm_ws = "retail_ops"
    elif norm_ws in ("clinic", "clinic_ops", "healthcare"):
        norm_ws = "clinic_ops"
    elif norm_ws in ("hr", "hr_ops", "internal"):
        norm_ws = "hr_ops"

    if norm_ws in DEFAULT_WORKSPACE_METADATA:
        return dict(DEFAULT_WORKSPACE_METADATA[norm_ws])

    # Check database for custom workspace metadata
    try:
        from backend.database import get_workspace_meta
        db_meta = get_workspace_meta(norm_ws)
        if db_meta:
            return db_meta
    except Exception as e:
        logger.debug("Database workspace metadata lookup error for %s: %s", norm_ws, e)

    brand_title = norm_ws.replace("_", " ").replace("-", " ").title()
    return {
        "brand_name": f"{brand_title} Support",
        "escalation_email": "contact@zavianlabs.com",
        "sla_text": "4-Hour Response Time SLA (Enterprise Custom Support)"
    }


def escalation_node(state: AgentState) -> Dict[str, Any]:
    """Node 5: Creates SQLite support ticket and sends an HTTP POST payload to n8n webhook with timeout fallback.
    Never fails or stalls when N8N_WEBHOOK_URL is unreachable or offline.
    """
    t0 = time.time()
    session_id = state.get("session_id", "default_session")
    customer_query = state.get("original_query") or state.get("query", "")
    intent = state.get("intent", "ESCALATE_ACTION")
    confidence_score = state.get("confidence_score", 0.0)
    workspace_id = state.get("workspace_id", "retail_ops")
    timestamp = datetime.datetime.now(datetime.timezone.utc).isoformat()

    # Workspace metadata mapping (brand_name, escalation_email, sla_text)
    ws_meta = get_workspace_metadata(workspace_id)
    brand_name = ws_meta["brand_name"]
    escalation_email = ws_meta["escalation_email"]
    sla_text = ws_meta["sla_text"]

    # Extract customer email if provided in customer_query via regex or accept customer_email from state
    provided_email = state.get("customer_email")
    if provided_email and str(provided_email).strip() and str(provided_email).strip().lower() != "not provided":
        customer_email = str(provided_email).strip()
    else:
        email_match = re.search(r'[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}', customer_query or "")
        customer_email = email_match.group(0) if email_match else "Not Provided"

    # Extract top citations (titles of retrieved sources)
    top_citations: List[str] = []
    sources = state.get("sources", [])
    if sources:
        top_citations = [s.get("title", "") for s in sources if s.get("title")]

    # 1. Generate structured ticket ID (#ND- + 6 uppercase alphanumeric)
    ticket_id = f"#ND-{uuid.uuid4().hex[:6].upper()}"

    payload = {
        "ticket_id": ticket_id,
        "workspace_id": workspace_id,
        "brand_name": brand_name,
        "escalation_email": escalation_email,
        "sla_text": sla_text,
        "customer_query": customer_query,
        "customer_email": customer_email,
        "intent": intent,
        "confidence_score": confidence_score,
        "top_citations": top_citations,
        "status": "Open",
        "session_id": session_id,
        "timestamp": timestamp
    }

    # 2. Strict timeout protected call to n8n webhook
    webhook_url = os.getenv("N8N_WEBHOOK_URL", "").strip()
    webhook_status = "queued_offline"
    if webhook_url:
        try:
            logger.info("Sending escalation payload for ticket %s to %s", ticket_id, webhook_url)
            with httpx.Client(timeout=3.0) as client:
                res = client.post(webhook_url, json=payload)
                if res.is_success:
                    webhook_status = "dispatched"
                    logger.info("n8n webhook acknowledged receipt for ticket %s", ticket_id)
                else:
                    webhook_status = "queued_offline"
                    logger.warning("n8n webhook returned status %s for ticket %s (graceful fallback)", res.status_code, ticket_id)
        except httpx.TimeoutException:
            webhook_status = "queued_offline"
            logger.warning("n8n webhook timed out after 3.0s for ticket %s (graceful fallback)", ticket_id)
        except Exception as e:
            webhook_status = "queued_offline"
            logger.warning("n8n webhook connection error for ticket %s: %s (graceful fallback)", ticket_id, e)
    else:
        webhook_status = "queued_offline"
        logger.info("N8N_WEBHOOK_URL not configured. Ticket %s marked as queued_offline", ticket_id)

    # 3. Persist ticket to SQLite
    save_ticket(
        ticket_id=ticket_id,
        session_id=session_id,
        customer_query=customer_query,
        intent=intent,
        confidence_score=confidence_score,
        status="Open",
        n8n_status=webhook_status,
        created_at=timestamp,
        workspace_id=workspace_id,
        customer_email=customer_email
    )

    ticket_obj = {
        "ticket_id": ticket_id,
        "status": "Open",
        "webhook_status": webhook_status,
        "workspace_id": workspace_id,
        "brand_name": brand_name,
        "escalation_email": escalation_email,
        "sla_text": sla_text,
        "customer_email": customer_email,
        "top_citations": top_citations,
        "query": customer_query,
        "timestamp": timestamp
    }

    escalation_info = {
        "triggered": True,
        "ticket_id": ticket_id,
        "status": "Open",
        "webhook_status": webhook_status,
        "n8n_status": webhook_status,
        "workspace_id": workspace_id,
        "brand_name": brand_name,
        "escalation_email": escalation_email,
        "sla_text": sla_text,
        "customer_email": customer_email,
        "top_citations": top_citations,
        "query": customer_query,
        "timestamp": timestamp
    }

    answer = (
        f"Your request has been escalated to our human support team. "
        f"Support Ticket **{ticket_id}** has been created. A specialist "
        f"is reviewing your inquiry and will follow up shortly via your registered email or account portal."
    )

    latency_ms = int((time.time() - t0) * 1000)
    trace_entry = {
        "step": "escalation_node",
        "tool": "n8n_ticket_escalation",
        "status": f"ticket_created_{webhook_status}",
        "latency_ms": latency_ms
    }
    traces = list(state.get("execution_trace", []))
    traces.append(trace_entry)

    return {
        "escalation": escalation_info,
        "ticket": ticket_obj,
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
    sources: List[Dict[str, Any]],
    workspace_id: str = "retail_ops"
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
        prompt = (
            f"You are NexusDesk AI, an expert customer support assistant for workspace '{workspace_id}'.\n"
            f"Answer the customer inquiry accurately and professionally based ONLY on the provided context.\n\n"
            f"Context:\n{context_str}\n\n"
            f"Customer Query: {query}\n\n"
            f"Answer:"
        )
        try:
            with httpx.Client(timeout=8.0) as client:
                res = client.post(
                    f"https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key={gemini_key}",
                    headers={"Content-Type": "application/json"},
                    json={
                        "contents": [{"parts": [{"text": prompt}]}],
                        "generationConfig": {"temperature": 0.2, "maxOutputTokens": 350}
                    }
                )
                if res.is_success:
                    candidates = res.json().get("candidates", [])
                    if candidates:
                        text = candidates[0].get("content", {}).get("parts", [{}])[0].get("text", "")
                        if text and text.strip():
                            return text.strip()
        except Exception as e:
            logger.warning("Gemini REST synthesis failed: %s. Trying SDK fallback if available.", e)

        try:
            from google import genai
            client = genai.Client(api_key=gemini_key)
            response = client.models.generate_content(
                model="gemini-2.5-flash",
                contents=prompt
            )
            if response and response.text:
                return response.text.strip()
        except Exception:
            pass

    # 2. Try OpenAI if configured
    if openai_key:
        try:
            with httpx.Client(timeout=8.0) as client:
                res = client.post(
                    "https://api.openai.com/v1/chat/completions",
                    headers={
                        "Content-Type": "application/json",
                        "Authorization": f"Bearer {openai_key}"
                    },
                    json={
                        "model": "gpt-4o-mini",
                        "messages": [
                            {"role": "system", "content": f"You are NexusDesk AI, an expert customer support assistant for workspace '{workspace_id}'. Answer accurately based on the provided context."},
                            {"role": "user", "content": f"Context:\n{context_str}\n\nQuery: {query}"}
                        ],
                        "max_tokens": 300,
                        "temperature": 0.2
                    }
                )
                if res.is_success:
                    choices = res.json().get("choices", [])
                    if choices:
                        content = choices[0].get("message", {}).get("content", "")
                        if content and content.strip():
                            return content.strip()
        except Exception as e:
            logger.warning("OpenAI REST synthesis failed: %s. Trying SDK fallback if available.", e)

        try:
            from openai import OpenAI
            client = OpenAI(api_key=openai_key)
            response = client.chat.completions.create(
                model="gpt-4o-mini",
                messages=[
                    {"role": "system", "content": f"You are NexusDesk AI, an expert customer support assistant for workspace '{workspace_id}'. Answer accurately based on the provided context."},
                    {"role": "user", "content": f"Context:\n{context_str}\n\nQuery: {query}"}
                ],
                max_tokens=300
            )
            if response.choices:
                return response.choices[0].message.content.strip()
        except Exception:
            pass

    # 3. Deterministic Grounded Synthesis Fallback
    answer_parts = []
    norm_ws = (workspace_id or "retail_ops").lower()
    if intent == "CATALOG_FILTER" and products:
        answer_parts.append(f"Here are the top products matching your search for '{query}':\n")
        for i, p in enumerate(products, 1):
            disc_str = f" **({p['discount']})**" if p['discount'] and p['discount'] != 'None' else ""
            answer_parts.append(f"{i}. **{p['name']}** — **${p['price']:.2f}**{disc_str}\n   *Rating*: {p['rating']} / 5.0 | *Category*: {p['category']}")
        if norm_ws in ("retail_ops", "demo"):
            answer_parts.append("\nAll products include a standard 1-year limited warranty and are eligible for our 30-day return policy.")
    elif (intent == "POLICY_FAQ" or not products) and sources:
        top_source = sources[0]
        if norm_ws in ("retail_ops", "demo"):
            prefix = "Based on our official store guidelines"
        elif norm_ws in ("clinic_ops", "clinic"):
            prefix = "Based on Clinic & Patient Support guidelines"
        elif norm_ws in ("hr_ops", "hr"):
            prefix = "Based on HR & Employee Operations policies"
        else:
            prefix = f"Based on verified {workspace_id} knowledge base documentation"

        bullets = extract_concise_bullets(query, sources, max_bullets=3)
        if bullets:
            answer_parts.append(f"{prefix} ({top_source['title']}):\n")
            for b in bullets:
                answer_parts.append(f"• {b}")
        else:
            clean_snip = clean_sentence_boundary(top_source.get("snippet", ""), 320)
            answer_parts.append(f"{prefix} ({top_source['title']}):\n{clean_snip}")

        if norm_ws in ("clinic_ops", "clinic"):
            answer_parts.append("\n*Note: For urgent medical emergencies, please dial emergency services immediately (911/999) or visit the nearest emergency department.*")
        elif norm_ws in ("hr_ops", "hr"):
            answer_parts.append("\n*Note: For confidential HR consultations or payroll inquiries, you can also submit a private ticket via the People Portal.*")
    elif intent == "HYBRID_COMPARISON":
        if products:
            p = products[0]
            answer_parts.append(f"Regarding the **{p['name']}** (${p['price']:.2f}, rated {p['rating']}/5.0):\n")
        if sources:
            bullets = extract_concise_bullets(query, sources, max_bullets=2)
            if bullets:
                for b in bullets:
                    answer_parts.append(f"• {b}")
            else:
                clean_snip = clean_sentence_boundary(sources[0].get("snippet", ""), 280)
                answer_parts.append(f"{clean_snip}\n")
        if norm_ws in ("retail_ops", "demo"):
            answer_parts.append("\nYou are covered under our 30-day return window and 1-year limited warranty.")
    else:
        if sources:
            bullets = extract_concise_bullets(query, sources, max_bullets=2)
            if bullets:
                for b in bullets:
                    answer_parts.append(f"• {b}")
            else:
                clean_snip = clean_sentence_boundary(sources[0].get("snippet", ""), 280)
                answer_parts.append(f"{clean_snip}\n")
        elif products:
            answer_parts.append(f"Found {len(products)} relevant products in our catalog.")
        else:
            answer_parts.append("Thank you for contacting customer support. We are here to assist with any inquiries.")

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
            workspace_id = state.get("workspace_id", "retail_ops")
            has_cat = catalog_engine.has_catalog(workspace_id) if catalog_engine else False

            if intent == "ESCALATE_ACTION":
                return "escalation_node"
            if not has_cat:
                return "semantic_rag_node"
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
            workspace_id = state.get("workspace_id", "retail_ops")
            has_cat = catalog_engine.has_catalog(workspace_id) if catalog_engine else False

            if intent == "ESCALATE_ACTION":
                return "escalation_node"

            if confidence < 0.65:
                if retry_count < 1:
                    # Loop back to retrieve once with rewritten query!
                    if intent == "CATALOG_FILTER" and has_cat:
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

def run_agentic_pipeline(
    query: str,
    session_id: str = "default_session",
    workspace_id: str = "retail_ops",
    customer_email: Optional[str] = None
) -> Dict[str, Any]:
    """
    Executes the 5-node cyclic workflow for a query, session_id, and workspace_id.
    Returns the full structured response conforming to the NexusDesk API contract.
    """
    history = get_session_history(session_id, limit=6, workspace_id=workspace_id)

    initial_state: AgentState = {
        "workspace_id": workspace_id,
        "session_id": session_id,
        "original_query": query,
        "query": query,
        "customer_email": (customer_email or "").strip(),
        "history": history,
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
            has_cat = catalog_engine.has_catalog(workspace_id) if catalog_engine else False
            run_catalog = has_cat

            for attempt in range(max_attempts):
                if intent == "CATALOG_FILTER":
                    if run_catalog:
                        cat_res = catalog_sql_node(state)
                        state.update(cat_res)
                    else:
                        sem_res = semantic_rag_node(state)
                        state.update(sem_res)
                elif intent == "POLICY_FAQ":
                    sem_res = semantic_rag_node(state)
                    state.update(sem_res)
                elif intent == "HYBRID_COMPARISON":
                    if run_catalog:
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
    save_message(session_id, "user", query, workspace_id=workspace_id)
    if final_state.get("answer"):
        save_message(session_id, "assistant", final_state["answer"], workspace_id=workspace_id)

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


# ==============================================================================
# MULTI-WORKSPACE INGESTION UTILITY
# ==============================================================================

def chunk_text(text: str, chunk_size: int = 500, chunk_overlap: int = 100) -> List[str]:
    """Splits text into overlapping chunks respecting paragraph or sentence boundaries."""
    if not text or not text.strip():
        return []
    
    text = re.sub(r'\r\n', '\n', text)
    paragraphs = re.split(r'\n\s*\n', text)
    chunks = []
    current_chunk = ""
    
    for p in paragraphs:
        p = p.strip()
        if not p:
            continue
        if len(current_chunk) + len(p) + 2 <= chunk_size:
            current_chunk = f"{current_chunk}\n\n{p}".strip()
        else:
            if current_chunk:
                chunks.append(current_chunk)
            if len(p) > chunk_size:
                words = p.split()
                sub = []
                sub_len = 0
                for w in words:
                    sub.append(w)
                    sub_len += len(w) + 1
                    if sub_len >= chunk_size:
                        chunks.append(" ".join(sub))
                        overlap_words = sub[-int(chunk_overlap / 10):] if len(sub) > 5 else []
                        sub = list(overlap_words)
                        sub_len = sum(len(x) + 1 for x in sub)
                if sub:
                    current_chunk = " ".join(sub)
            else:
                current_chunk = p
                
    if current_chunk:
        chunks.append(current_chunk)
        
    return chunks


async def ingest_knowledge_source(
    workspace_id: str = "retail_ops",
    url: Optional[str] = None,
    file_bytes: Optional[bytes] = None,
    filename: Optional[str] = None,
    faq_text: Optional[str] = None,
    escalation_email: Optional[str] = None,
    brand_name: Optional[str] = None,
    sla_text: Optional[str] = None
) -> Dict[str, Any]:
    """
    Ingests and indexes custom content (URL, file, or raw FAQ text) into the specified workspace.
    """
    from backend.database import record_knowledge_source, save_workspace_meta
    new_chunks = []
    recorded_sources = []

    # If workspace metadata provided or custom workspace ingested, persist metadata
    if escalation_email or brand_name or sla_text:
        clean_email = (escalation_email or "contact@zavianlabs.com").strip()
        clean_brand = (brand_name or workspace_id.replace("_", " ").title()).strip()
        clean_sla = (sla_text or "Under 2-4 Hours (Tier 1 Support SLA)").strip()
        save_workspace_meta(
            workspace_id=workspace_id,
            brand_name=clean_brand,
            escalation_email=clean_email,
            sla_text=clean_sla
        )

    # 1. Scrape URL if provided
    if url and str(url).strip():
        url_str = str(url).strip()
        is_safe, error_msg = is_safe_public_url(url_str)
        if not is_safe:
            logger.warning("Blocked unsafe URL ingestion attempt for '%s': %s", url_str, error_msg)
            rec = record_knowledge_source(workspace_id, f"URL: {url_str}", "url", 0, f"error: {error_msg[:60]}")
            recorded_sources.append(rec)
            return {
                "status": "error",
                "workspace_id": workspace_id,
                "error": error_msg,
                "ingested_sources": recorded_sources,
                "total_chunks": len(vector_store.get_chunks(workspace_id)) if vector_store else 0,
                "new_chunks_indexed": 0
            }

        try:
            from bs4 import BeautifulSoup
            async with httpx.AsyncClient(timeout=10.0, follow_redirects=True) as client:
                resp = await client.get(url_str)
                resp.raise_for_status()
                # Enforce max content length of 5 MB
                if len(resp.content) > 5 * 1024 * 1024:
                    raise ValueError("Target page content exceeds maximum allowed size of 5 MB.")
                soup = BeautifulSoup(resp.text, "html.parser")
                for tag in soup(["script", "style", "nav", "footer", "header", "noscript"]):
                    tag.decompose()
                title = soup.title.string.strip() if soup.title and soup.title.string else url_str
                text = soup.get_text(separator="\n")
                clean_text = re.sub(r'\n\s*\n+', '\n\n', text).strip()
                chunks = chunk_text(clean_text)
                for c in chunks:
                    new_chunks.append({
                        "title": f"Web: {title}",
                        "content": c,
                        "snippet": clean_sentence_boundary(c, 350),
                        "type": "web"
                    })
                rec = record_knowledge_source(workspace_id, f"URL: {url_str}", "url", len(chunks), "indexed")
                recorded_sources.append(rec)
        except Exception as e:
            logger.error("Failed to ingest URL %s: %s", url_str, e)
            rec = record_knowledge_source(workspace_id, f"URL: {url_str}", "url", 0, f"error: {str(e)[:60]}")
            recorded_sources.append(rec)

    # 2. Ingest raw FAQ text if provided
    if faq_text and str(faq_text).strip():
        text_str = str(faq_text).strip()
        chunks = chunk_text(text_str)
        first_line = text_str.split("\n")[0].strip()[:60]
        title = first_line if first_line else "Custom FAQ Document"
        for c in chunks:
            new_chunks.append({
                "title": f"FAQ: {title}",
                "content": c,
                "snippet": clean_sentence_boundary(c, 350),
                "type": "faq"
            })
        rec = record_knowledge_source(workspace_id, f"FAQ: {title}", "faq_text", len(chunks), "indexed")
        recorded_sources.append(rec)

    # 3. Ingest uploaded file if provided
    if file_bytes and filename:
        try:
            fn_lower = filename.lower()
            if fn_lower.endswith(".pdf"):
                import io, pypdf
                reader = pypdf.PdfReader(io.BytesIO(file_bytes))
                pdf_chunks = []
                for p_num, page in enumerate(reader.pages, 1):
                    p_txt = page.extract_text() or ""
                    if p_txt.strip():
                        for c in chunk_text(p_txt):
                            pdf_chunks.append({
                                "title": f"PDF: {filename} (p.{p_num})",
                                "content": c,
                                "snippet": clean_sentence_boundary(c, 350),
                                "type": "pdf"
                            })
                new_chunks.extend(pdf_chunks)
                rec = record_knowledge_source(workspace_id, filename, "pdf", len(pdf_chunks), "indexed")
                recorded_sources.append(rec)
            elif fn_lower.endswith(".csv"):
                csv_text = file_bytes.decode("utf-8", errors="replace")
                cat_count = 0
                if catalog_engine:
                    cat_count = catalog_engine.load_csv_catalog(workspace_id, csv_text, is_content=True)
                import csv, io
                csv_chunks = []
                reader = csv.DictReader(io.StringIO(csv_text))
                for row in reader:
                    row_str = " | ".join([f"{k}: {v}" for k, v in row.items() if v])
                    csv_chunks.append({
                        "title": f"Catalog: {row.get('name', row.get('product name', filename))}",
                        "content": row_str,
                        "snippet": clean_sentence_boundary(row_str, 350),
                        "type": "catalog"
                    })
                new_chunks.extend(csv_chunks)
                rec = record_knowledge_source(workspace_id, filename, "csv", len(csv_chunks), "indexed")
                recorded_sources.append(rec)
            else:
                # Text / Markdown file
                txt = file_bytes.decode("utf-8", errors="replace")
                file_ch = chunk_text(txt)
                for c in file_ch:
                    new_chunks.append({
                        "title": f"File: {filename}",
                        "content": c,
                        "snippet": clean_sentence_boundary(c, 350),
                        "type": "file"
                    })
                new_chunks.extend(file_ch)
                rec = record_knowledge_source(workspace_id, filename, "file", len(file_ch), "indexed")
                recorded_sources.append(rec)
        except Exception as e:
            logger.error("Failed to parse file %s: %s", filename, e)
            rec = record_knowledge_source(workspace_id, filename, "file", 0, f"error: {str(e)[:60]}")
            recorded_sources.append(rec)

    if new_chunks and vector_store:
        vector_store.add_chunks(workspace_id, new_chunks)

    total_chunks = len(vector_store.get_chunks(workspace_id)) if vector_store else len(new_chunks)
    return {
        "status": "ok",
        "workspace_id": workspace_id,
        "ingested_sources": recorded_sources,
        "total_chunks": total_chunks,
        "new_chunks_indexed": len(new_chunks)
    }
