"""
NexusDesk AI - FastAPI Backend Server
Exposes the Agentic RAG endpoints for customer support, catalog search, and human escalation.
"""

import os
os.environ["HOME"] = "/tmp"
os.environ["TMPDIR"] = "/tmp"

import logging
from typing import List, Optional, Dict, Any
from contextlib import asynccontextmanager

from dotenv import load_dotenv

# Load .env automatically from project root and current working directory
env_path = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), ".env")
if os.path.exists(env_path):
    load_dotenv(dotenv_path=env_path)
load_dotenv()

from fastapi import FastAPI, HTTPException, status
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field

from backend.database import init_db, list_tickets, get_session_history
from backend.rag_pipeline import run_agentic_pipeline

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(name)s: %(message)s"
)
logger = logging.getLogger("nexusdesk.main")


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Lifecycle manager for database initialization on startup."""
    try:
        logger.info("Initializing NexusDesk AI database and services...")
        init_db()
    except Exception as e:
        logger.warning("Database initialization non-fatal warning: %s", e)
    yield
    logger.info("NexusDesk AI server shutting down...")


app = FastAPI(
    title="NexusDesk AI - Agentic RAG Customer Support Engine",
    description="Stateful LangGraph agent for e-commerce customer support, catalog filtering, and n8n escalation.",
    version="1.0.0",
    lifespan=lifespan
)

# Enable CORS for frontend integration
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# ==============================================================================
# PYDANTIC SCHEMAS (API CONTRACT)
# ==============================================================================

class ChatRequest(BaseModel):
    query: str = Field(..., description="Customer message or support query")
    session_id: str = Field(default="default_session", description="Unique conversation session identifier")


class ExecutionTraceItem(BaseModel):
    step: str
    tool: str
    status: str
    latency_ms: int


class ProductItem(BaseModel):
    name: str
    category: str
    price: float
    discount: str
    rating: float


class SourceItem(BaseModel):
    title: str
    snippet: str
    relevance: float


class EscalationInfo(BaseModel):
    triggered: bool
    ticket_id: Optional[str] = None
    n8n_status: str


class ChatResponse(BaseModel):
    answer: str
    execution_trace: List[ExecutionTraceItem]
    products: List[ProductItem]
    sources: List[SourceItem]
    confidence_score: float
    escalation: EscalationInfo


# ==============================================================================
# ENDPOINTS
# ==============================================================================

@app.get("/", tags=["Health"])
async def root():
    """Root health check returning status and service name."""
    return {"status": "ok", "service": "NexusDesk AI"}


@app.get("/api/health", tags=["Health"])
@app.get("/health", tags=["Health"])
async def health_check():
    """Health check endpoint for container probes and monitoring."""
    return {
        "status": "healthy",
        "service": "NexusDesk AI",
        "database": "sqlite_connected"
    }


@app.post("/api/chat", response_model=ChatResponse, tags=["Chat"])
@app.post("/api/search", response_model=ChatResponse, tags=["Chat"])
async def handle_chat(payload: ChatRequest):
    """
    Main Agentic RAG chat endpoint.
    Accepts query & session_id, runs cyclic 5-node LangGraph pipeline,
    and returns answer, execution trace, products, sources, confidence, and escalation state.
    """
    if not payload.query or not payload.query.strip():
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="The 'query' field cannot be empty."
        )

    try:
        session_id = payload.session_id.strip() if payload.session_id else "default_session"
        result = run_agentic_pipeline(
            query=payload.query.strip(),
            session_id=session_id
        )
        return result
    except Exception as e:
        logger.exception("Unexpected error in pipeline execution: %s", e)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Pipeline execution encountered an internal error: {str(e)}"
        )


@app.get("/api/tickets", tags=["Support & Audit"])
async def get_tickets(limit: int = 25):
    """List recent support tickets escalated to Tier 2 / n8n."""
    tickets = list_tickets(limit=limit)
    return {
        "count": len(tickets),
        "tickets": tickets
    }


@app.get("/api/history/{session_id}", tags=["Memory"])
async def get_history(session_id: str):
    """Retrieve stored conversational turns for a session."""
    history = get_session_history(session_id=session_id, limit=20)
    return {
        "session_id": session_id,
        "turns": history
    }


if __name__ == "__main__":
    import uvicorn
    port = int(os.getenv("PORT", 7860))
    uvicorn.run("backend.main:app", host="0.0.0.0", port=port, reload=True)
