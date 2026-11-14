# NexusDesk AI — Agentic RAG Customer Support Engine

[![FastAPI](https://img.shields.io/badge/FastAPI-0.110+-009688?logo=fastapi&logoColor=white)](https://fastapi.tiangolo.com)
[![LangGraph](https://img.shields.io/badge/LangGraph-Cyclic_Workflow-blue?logo=python&logoColor=white)](https://github.com/langchain-ai/langgraph)
[![DuckDB](https://img.shields.io/badge/DuckDB-In--Memory_SQL-FFF000?logo=duckdb&logoColor=black)](https://duckdb.org)
[![Hugging Face Spaces](https://img.shields.io/badge/Hugging_Face-Spaces_Compatible-FFD21E?logo=huggingface&logoColor=black)](https://huggingface.co/spaces)

NexusDesk AI is a stateful, agentic customer support engine designed for e-commerce platforms. Built on FastAPI, LangGraph, DuckDB, FAISS, and SQLite, it classifies customer intent, performs exact numerical and categorical filtering over catalog data, retrieves policy and review context via semantic vector search, autonomously grades context relevance with query-rewriting retry loops, and escalates unresolved or sensitive issues to Tier 2 support via n8n webhooks.

---

## 🏗️ System Architecture

NexusDesk AI replaces rigid linear search with a **cyclic 5-node LangGraph workflow**:

```
                       ┌───────────────────────┐
                       │     Customer Query    │
                       └───────────┬───────────┘
                                   │
                                   ▼
                       ┌───────────────────────┐
                       │      router_node      │
                       │   Intent & Rewrite    │
                       └─────┬─────┬─────┬─────┘
                             │     │     │
            ┌────────────────┘     │     └────────────────┐
            ▼                      ▼                      ▼
  [CATALOG_FILTER]         [HYBRID_COMPARE]          [POLICY_FAQ]
┌───────────────────────┐          │          ┌───────────────────────┐
│   catalog_sql_node    │◄─────────┘          │   semantic_rag_node   │
│ DuckDB SQL Filtering  │                     │ FAISS + SentenceTrans │
└───────────┬───────────┘                     └───────────┬───────────┘
            │                                             │
            └──────────────────────┬──────────────────────┘
                                   │
                                   ▼
                       ┌───────────────────────┐
                ┌─────►│      grader_node      │
                │      │ Confidence & Rewrite  │
                │      └───────────┬───────────┘
                │                  │
   [Confidence < 0.65              │
    & retry_count < 1]             ├────────────────────────┐
                │                  ▼                        ▼
                │        [Confidence >= 0.65]     [Confidence < 0.65 after retry
                │        ┌──────────────────┐      OR Intent == ESCALATE_ACTION]
                └────────┤ Synthesize Final │               │
                         │ Customer Answer  │               ▼
                         └──────────────────┘    ┌──────────────────────┐
                                                 │   escalation_node    │
                                                 │ SQLite + n8n Webhook │
                                                 └──────────────────────┘
```

### The 5 Agent Nodes:

1. **`router_node`**:
   - Classifies customer intent into `CATALOG_FILTER`, `POLICY_FAQ`, `HYBRID_COMPARISON`, or `ESCALATE_ACTION`.
   - Resolves ambiguous follow-up pronouns ("how much is it?", "can I return it?") by contextualizing the query against session memory.
2. **`catalog_sql_node`**:
   - Uses in-memory **DuckDB** to execute structured SQL queries on `amazon_products.csv` for numerical constraints (`price`, `rating`, `discount`, `category`).
3. **`semantic_rag_node`**:
   - Performs dense semantic vector search via **FAISS** + `SentenceTransformer("all-MiniLM-L6-v2")` on `policies.md` and customer reviews / specifications.
4. **`grader_node`**:
   - Evaluates retrieved context relevance on a scale of `0.0` to `1.0`.
   - If confidence is `< 0.65` and `retry_count < 1`, it reformulates search terms and cycles back to retrieval.
   - If confidence remains `< 0.65` or intent is `ESCALATE_ACTION`, it triggers human handoff.
5. **`escalation_node`**:
   - Generates a unique support ticket (`TICK-XXXXXXXX`) and records it in SQLite (`backend/nexusdesk.db`).
   - Dispatches an HTTP POST payload to `N8N_WEBHOOK_URL` with a non-blocking 3.0s timeout and graceful fallback.

---

## 📡 API Contract

### `POST /api/chat` (also aliased as `POST /api/search`)

#### Request Body
```json
{
  "query": "Show me noise cancelling headphones under $300 with rating above 4.5",
  "session_id": "cust_sess_9021"
}
```

#### Response Body
```json
{
  "answer": "Here are the top products matching your search for 'Show me noise cancelling headphones under $300 with rating above 4.5'...",
  "execution_trace": [
    {"step": "router_node", "tool": "intent_classifier_and_rewriter", "status": "completed", "latency_ms": 12},
    {"step": "catalog_sql_node", "tool": "duckdb_sql_filter", "status": "completed", "latency_ms": 8},
    {"step": "grader_node", "tool": "context_relevance_grader", "status": "high_confidence_0.9accepted", "latency_ms": 1}
  ],
  "products": [
    {
      "name": "Bose QuietComfort 45 Bluetooth Wireless Headphones",
      "category": "Audio",
      "price": 279.0,
      "discount": "15% off",
      "rating": 4.6
    }
  ],
  "sources": [
    {
      "title": "Store Policy: 1. 30-Day Standard Return Policy",
      "snippet": "Customers can initiate a return within thirty (30) calendar days from the verified delivery date...",
      "relevance": 0.88
    }
  ],
  "confidence_score": 0.90,
  "escalation": {
    "triggered": false,
    "ticket_id": null,
    "n8n_status": "none"
  }
}
```

---

## 🚀 Running Locally

```bash
# 1. Create and activate a virtual environment
python -m venv venv
source venv/bin/activate  # On Windows: venv\Scripts\activate

# 2. Install dependencies
pip install -r requirements.txt

# 3. Configure environment (optional)
cp .env.example .env

# 4. Start the server
uvicorn backend.main:app --host 0.0.0.0 --port 7860 --reload
```

---

## 🐳 Hugging Face Spaces Deployment

The repository includes a production-ready `Dockerfile` fully conforming to Hugging Face Spaces requirements:
- Non-root user with UID 1000 (`user:user`).
- Default exposure on port `7860`.
- Fast caching of dependencies and datasets.

To deploy on Hugging Face Spaces:
1. Create a new Space on [Hugging Face](https://huggingface.co/spaces) and select **Docker** as the SDK.
2. Push this repository to your Space remote.
3. Configure `N8N_WEBHOOK_URL`, `GEMINI_API_KEY`, or `OPENAI_API_KEY` under the Space's **Settings > Variables and secrets** as needed.
