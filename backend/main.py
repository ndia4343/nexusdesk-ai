"""
NexusDesk AI - FastAPI Backend Server
Exposes the Agentic RAG endpoints for customer support, catalog search, and human escalation.
"""

import os
os.environ["HOME"] = "/tmp"
os.environ["TMPDIR"] = "/tmp"

import re
import uuid
import datetime
import logging
from typing import List, Optional, Dict, Any
from contextlib import asynccontextmanager

import httpx
from dotenv import load_dotenv

# Load .env automatically from project root and current working directory
env_path = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), ".env")
if os.path.exists(env_path):
    load_dotenv(dotenv_path=env_path)
load_dotenv()

from fastapi import FastAPI, HTTPException, Request, UploadFile, File, Form, status
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field

# Graceful import wrapper for database and rag pipeline to ensure FastAPI boots cleanly
STARTUP_ERROR: Optional[str] = None
try:
    from backend.database import (
        init_db, list_tickets, save_ticket, get_ticket, get_session_history,
        record_knowledge_source, list_knowledge_sources, delete_knowledge_sources,
        update_ticket_customer_email, get_workspace_meta, save_workspace_meta
    )
    from backend.rag_pipeline import (
        run_agentic_pipeline, vector_store, catalog_engine,
        chunk_text, ingest_knowledge_source, is_safe_public_url,
        get_workspace_metadata
    )
except Exception as e:
    import traceback
    STARTUP_ERROR = f"{type(e).__name__}: {str(e)}\n{traceback.format_exc()}"
    init_db = None
    list_tickets = None
    save_ticket = None
    get_ticket = None
    get_session_history = None
    record_knowledge_source = None
    list_knowledge_sources = None
    delete_knowledge_sources = None
    update_ticket_customer_email = None
    get_workspace_meta = None
    save_workspace_meta = None
    run_agentic_pipeline = None
    vector_store = None
    catalog_engine = None
    chunk_text = None
    ingest_knowledge_source = None
    is_safe_public_url = None
    get_workspace_metadata = None

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
        if init_db is not None:
            init_db()
        else:
            logger.warning("Database init skipped due to startup error: %s", STARTUP_ERROR)
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
    workspace_id: str = Field(default="retail_ops", description="Workspace tenant identifier for data isolation")
    customer_email: Optional[str] = Field(default=None, description="Optional customer email address")


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
    status: Optional[str] = None
    webhook_status: Optional[str] = None
    n8n_status: str
    workspace_id: Optional[str] = None
    brand_name: Optional[str] = None
    escalation_email: Optional[str] = None
    sla_text: Optional[str] = None
    customer_email: Optional[str] = None
    top_citations: Optional[List[str]] = None
    query: Optional[str] = None
    timestamp: Optional[str] = None


class AttachEmailPayload(BaseModel):
    ticket_id: str = Field(..., description="Escalated ticket ID (e.g. #ND-XXXXXX)")
    workspace_id: str = Field(default="retail_ops", description="Workspace tenant identifier")
    customer_email: str = Field(..., description="Customer contact email for confirmation receipt")
    customer_query: Optional[str] = Field(default="Customer attached contact email for support ticket", description="Original user query or ticket context")


class ChatResponse(BaseModel):
    answer: str
    execution_trace: List[ExecutionTraceItem]
    products: List[ProductItem]
    sources: List[SourceItem]
    confidence_score: float
    escalation: EscalationInfo


class ActionPayload(BaseModel):
    workspace_id: str = "retail_ops"
    brand_name: Optional[str] = None
    session_id: str = "default_session"
    action_type: str = "workflow_dispatch"
    customer_query: str
    customer_email: Optional[str] = None
    details: Optional[Dict[str, Any]] = None


class ActionResponse(BaseModel):
    status: str
    ticket_id: str
    webhook_status: str
    n8n_status: str
    workspace_id: str
    brand_name: Optional[str] = None
    query: str
    action_type: str
    timestamp: str
    message: str


# ==============================================================================
# ENDPOINTS
# ==============================================================================

@app.get("/", tags=["Health"])
async def root():
    """Root health check returning status, service name, and documentation link."""
    return {
        "status": "ok",
        "service": "NexusDesk AI",
        "docs": "/docs"
    }


@app.get("/api/health", tags=["Health"])
@app.get("/health", tags=["Health"])
async def health_check():
    """Health check endpoint for container probes and monitoring."""
    return {
        "status": "ok",
        "startup_error": STARTUP_ERROR
    }


@app.post("/api/chat", response_model=ChatResponse, tags=["Chat"])
@app.post("/api/search", response_model=ChatResponse, tags=["Chat"])
async def handle_chat(payload: ChatRequest):
    """
    Main Agentic RAG chat endpoint.
    Accepts query & session_id & workspace_id, runs cyclic 5-node LangGraph pipeline,
    and returns answer, execution trace, products, sources, confidence, and escalation state.
    """
    if not payload.query or not payload.query.strip():
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="The 'query' field cannot be empty."
        )

    if STARTUP_ERROR or run_agentic_pipeline is None:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail=f"Pipeline unavailable due to startup error: {STARTUP_ERROR}"
        )

    try:
        session_id = payload.session_id.strip() if payload.session_id else "default_session"
        workspace_id = payload.workspace_id.strip() if payload.workspace_id else "retail_ops"
        result = run_agentic_pipeline(
            query=payload.query.strip(),
            session_id=session_id,
            workspace_id=workspace_id,
            customer_email=payload.customer_email
        )
        return result
    except Exception as e:
        logger.exception("Unexpected error in pipeline execution: %s", e)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Pipeline execution encountered an internal error: {str(e)}"
        )


@app.post("/api/ingest", tags=["Knowledge"])
async def ingest_knowledge(request: Request):
    """
    Ingests knowledge documents, FAQs, web pages, or product catalogs into a workspace.
    Accepts JSON or multipart/form-data with workspace_id, optional url, optional file, raw faq_text,
    and optional escalation_email (defaulting to contact@zavianlabs.com).
    """
    if STARTUP_ERROR or ingest_knowledge_source is None:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail=f"Ingestion service unavailable: {STARTUP_ERROR}"
        )

    content_type = request.headers.get("content-type", "")
    target_workspace = "retail_ops"
    target_url = None
    target_faq_text = None
    escalation_email = None
    brand_name = None
    sla_text = None
    file_bytes = None
    filename = None

    if "application/json" in content_type:
        try:
            body = await request.json()
        except Exception:
            body = {}
        target_workspace = body.get("workspace_id", "retail_ops")
        target_url = body.get("url")
        target_faq_text = body.get("faq_text")
        escalation_email = body.get("escalation_email")
        brand_name = body.get("brand_name")
        sla_text = body.get("sla_text")
    else:
        form = await request.form()
        target_workspace = form.get("workspace_id", "retail_ops")
        target_url = form.get("url")
        target_faq_text = form.get("faq_text")
        escalation_email = form.get("escalation_email")
        brand_name = form.get("brand_name")
        sla_text = form.get("sla_text")
        uploaded_file = form.get("file")
        if uploaded_file and hasattr(uploaded_file, "filename") and uploaded_file.filename:
            filename = uploaded_file.filename
            file_bytes = await uploaded_file.read()

    # Validate target URL if provided
    if target_url and str(target_url).strip():
        url_str = str(target_url).strip()
        if is_safe_public_url:
            is_safe, error_msg = is_safe_public_url(url_str)
            if not is_safe:
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail=f"Security rejection for URL: {error_msg}"
                )

    res = await ingest_knowledge_source(
        workspace_id=str(target_workspace).strip() or "retail_ops",
        url=target_url,
        file_bytes=file_bytes,
        filename=filename,
        faq_text=target_faq_text,
        escalation_email=str(escalation_email).strip() if escalation_email else "contact@zavianlabs.com",
        brand_name=str(brand_name).strip() if brand_name else None,
        sla_text=str(sla_text).strip() if sla_text else None
    )
    return res


@app.get("/api/knowledge", tags=["Knowledge"])
async def get_knowledge(workspace_id: str = "retail_ops"):
    """
    Returns the list of ingested sources, chunk counts, and status for the specified workspace.
    """
    norm_ws = (workspace_id or "retail_ops").strip().lower()
    if norm_ws in ("demo", "retail", "retail_ops", "ecommerce"):
        norm_ws = "retail_ops"
    elif norm_ws in ("clinic", "clinic_ops", "healthcare"):
        norm_ws = "clinic_ops"
    elif norm_ws in ("hr", "hr_ops", "internal"):
        norm_ws = "hr_ops"

    sources = list_knowledge_sources(workspace_id=norm_ws) if list_knowledge_sources else []
    chunks = vector_store.get_chunks(norm_ws) if vector_store else []
    has_cat = catalog_engine.has_catalog(norm_ws) if catalog_engine else False

    # Seed default system sources in response if not yet recorded in SQLite
    if not sources:
        if norm_ws == "retail_ops":
            sources = [
                {
                    "id": 1,
                    "workspace_id": "retail_ops",
                    "source_name": "policies.md",
                    "source_type": "policy",
                    "chunk_count": len([c for c in chunks if c.get("type") == "policy"]),
                    "status": "indexed",
                    "created_at": "system_boot"
                },
                {
                    "id": 2,
                    "workspace_id": "retail_ops",
                    "source_name": "amazon_products.csv",
                    "source_type": "catalog",
                    "chunk_count": len([c for c in chunks if c.get("type") in ("review", "description")]),
                    "status": "indexed",
                    "created_at": "system_boot"
                }
            ]
        elif norm_ws == "clinic_ops":
            sources = [
                {
                    "id": 3,
                    "workspace_id": "clinic_ops",
                    "source_name": "clinic_policies.md",
                    "source_type": "clinical_faq",
                    "chunk_count": len(chunks),
                    "status": "indexed",
                    "created_at": "system_boot"
                }
            ]
        elif norm_ws == "hr_ops":
            sources = [
                {
                    "id": 4,
                    "workspace_id": "hr_ops",
                    "source_name": "hr_policies.md",
                    "source_type": "hr_policy",
                    "chunk_count": len(chunks),
                    "status": "indexed",
                    "created_at": "system_boot"
                }
            ]

    return {
        "workspace_id": norm_ws,
        "sources": sources,
        "total_chunks": len(chunks),
        "has_catalog": has_cat
    }


@app.delete("/api/knowledge", tags=["Knowledge"])
async def delete_knowledge(workspace_id: str = "retail_ops"):
    """
    Clears and resets a custom client workspace knowledge base.
    """
    norm_ws = (workspace_id or "retail_ops").strip().lower()
    if norm_ws in ("demo", "retail", "retail_ops", "ecommerce"):
        norm_ws = "retail_ops"
    elif norm_ws in ("clinic", "clinic_ops", "healthcare"):
        norm_ws = "clinic_ops"
    elif norm_ws in ("hr", "hr_ops", "internal"):
        norm_ws = "hr_ops"

    if vector_store:
        vector_store.clear_workspace(norm_ws)
    if catalog_engine:
        catalog_engine.clear_catalog(norm_ws)
    deleted_records = delete_knowledge_sources(norm_ws) if delete_knowledge_sources else 0

    return {
        "status": "ok",
        "workspace_id": norm_ws,
        "deleted_records": deleted_records,
        "message": f"Knowledge base for workspace '{norm_ws}' cleared successfully."
    }


@app.post("/api/action", response_model=ActionResponse, tags=["Agentic Actions"])
@app.post("/api/escalate", response_model=ActionResponse, tags=["Agentic Actions"])
async def trigger_agentic_action(payload: ActionPayload):
    """Dispatches a structured operational request (expense, booking, return, etc.) to the n8n webhook and records the support ticket."""
    ticket_id = f"#ND-{uuid.uuid4().hex[:6].upper()}"
    timestamp = datetime.datetime.now(datetime.timezone.utc).isoformat()
    webhook_url = os.getenv("N8N_WEBHOOK_URL", "").strip()

    raw_ws = (payload.workspace_id or "retail_ops").strip()
    norm_ws = raw_ws.lower()
    if norm_ws in ("demo", "retail", "retail_ops", "ecommerce"):
        norm_ws = "retail_ops"
    elif norm_ws in ("clinic", "clinic_ops", "healthcare"):
        norm_ws = "clinic_ops"
    elif norm_ws in ("hr", "hr_ops", "internal", "people & operations"):
        norm_ws = "hr_ops"

    # Workspace metadata lookup
    ws_meta = get_workspace_metadata(norm_ws) if get_workspace_metadata else {}

    # Brand name resolution
    if payload.brand_name and payload.brand_name.strip() and payload.brand_name.strip().lower() not in (raw_ws.lower(), norm_ws):
        brand_name = payload.brand_name.strip()
    elif norm_ws == "hr_ops":
        brand_name = "HR & Employee Operations"
    elif norm_ws == "clinic_ops":
        brand_name = "Clinic & Patient Support"
    elif norm_ws == "retail_ops":
        brand_name = "E-Commerce & Retail"
    else:
        brand_name = ws_meta.get("brand_name") or raw_ws.replace("_", " ").title()

    escalation_email = ws_meta.get("escalation_email", "contact@zavianlabs.com")
    sla_text = ws_meta.get("sla_text", "Under 2-4 Hours (Tier 1 Support SLA)")

    email_match = re.search(r'[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}', payload.customer_query or "")
    customer_email = payload.customer_email or (email_match.group(0) if email_match else "Not Provided")

    webhook_payload = {
        "ticket_id": ticket_id,
        "session_id": payload.session_id,
        "action_type": payload.action_type,
        "customer_query": payload.customer_query,
        "customer_email": customer_email,
        "workspace_id": norm_ws,
        "brand_name": brand_name,
        "escalation_email": escalation_email,
        "sla_text": sla_text,
        "details": payload.details or {},
        "timestamp": timestamp
    }

    webhook_status = "queued_offline"
    if webhook_url:
        try:
            with httpx.Client(timeout=3.0) as client:
                res = client.post(webhook_url, json=webhook_payload)
                if res.is_success:
                    webhook_status = "dispatched"
                else:
                    webhook_status = "queued_offline"
        except Exception:
            webhook_status = "queued_offline"
    else:
        webhook_status = "queued_offline"

    if save_ticket:
        try:
            save_ticket(
                ticket_id=ticket_id,
                session_id=payload.session_id,
                customer_query=payload.customer_query,
                intent=payload.action_type,
                confidence_score=0.98,
                status="OPEN",
                n8n_status=webhook_status,
                workspace_id=norm_ws,
                customer_email=customer_email
            )
        except Exception as e:
            logger.warning("Failed to persist action ticket: %s", e)

    action_label = payload.action_type.replace('_', ' ').title()
    return ActionResponse(
        status="OPEN",
        ticket_id=ticket_id,
        webhook_status=webhook_status,
        n8n_status=webhook_status,
        workspace_id=norm_ws,
        brand_name=brand_name,
        query=payload.customer_query,
        action_type=payload.action_type,
        timestamp=timestamp,
        message=f"{action_label} successfully queued and dispatched to {brand_name} workflow."
    )


@app.get("/api/tickets", tags=["Support & Audit"])
async def get_tickets(limit: int = 25, workspace_id: Optional[str] = None):
    """List recent support tickets escalated to Tier 2 / n8n."""
    if list_tickets is None:
        return {
            "count": 0,
            "tickets": [],
            "startup_error": STARTUP_ERROR
        }
    tickets = list_tickets(limit=limit, workspace_id=workspace_id)
    return {
        "count": len(tickets),
        "tickets": tickets
    }


@app.post("/api/tickets/attach-email", tags=["Support & Audit"])
async def attach_email_to_ticket(payload: AttachEmailPayload):
    """
    Attaches a customer email address to an existing or escalated support ticket,
    persists it in SQLite, and forwards full ticket + workspace metadata to n8n webhook.
    """
    clean_email = (payload.customer_email or "").strip()
    if not clean_email or "@" not in clean_email:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="A valid customer_email address is required."
        )

    norm_ws = (payload.workspace_id or "retail_ops").strip().lower()
    if norm_ws in ("demo", "retail", "retail_ops", "ecommerce"):
        norm_ws = "retail_ops"
    elif norm_ws in ("clinic", "clinic_ops", "healthcare"):
        norm_ws = "clinic_ops"
    elif norm_ws in ("hr", "hr_ops", "internal"):
        norm_ws = "hr_ops"

    # Workspace metadata
    ws_meta = get_workspace_metadata(norm_ws) if get_workspace_metadata else {
        "brand_name": norm_ws.replace("_", " ").title(),
        "escalation_email": "contact@zavianlabs.com",
        "sla_text": "Under 2-4 Hours (Tier 1 Support SLA)"
    }
    brand_name = ws_meta.get("brand_name", norm_ws)
    escalation_email = ws_meta.get("escalation_email", "contact@zavianlabs.com")
    sla_text = ws_meta.get("sla_text", "Under 2-4 Hours (Tier 1 Support SLA)")

    # Fetch existing ticket or query
    cust_query = (payload.customer_query or "").strip()
    if (not cust_query or cust_query == "Customer attached contact email for support ticket") and get_ticket:
        try:
            existing_ticket = get_ticket(payload.ticket_id)
            if existing_ticket and existing_ticket.get("customer_query"):
                cust_query = existing_ticket["customer_query"]
        except Exception:
            pass
    if not cust_query:
        cust_query = "Customer attached contact email for support ticket"

    # Build forward payload matching requirement:
    # (ticket_id, workspace_id, brand_name, escalation_email, sla_text, customer_query, customer_email, intent: 'EMAIL_ATTACHED', confidence_score: '100%', status: 'Open')
    timestamp = datetime.datetime.now(datetime.timezone.utc).isoformat()
    n8n_payload = {
        "ticket_id": payload.ticket_id,
        "workspace_id": norm_ws,
        "brand_name": brand_name,
        "escalation_email": escalation_email,
        "sla_text": sla_text,
        "customer_query": cust_query,
        "customer_email": clean_email,
        "intent": "EMAIL_ATTACHED",
        "confidence_score": "100%",
        "status": "Open",
        "timestamp": timestamp
    }

    # Dispatch to n8n webhook with 3.0s timeout
    webhook_url = os.getenv("N8N_WEBHOOK_URL", "").strip()
    webhook_status = "queued_offline"
    if webhook_url:
        try:
            with httpx.Client(timeout=3.0) as client:
                res = client.post(webhook_url, json=n8n_payload)
                if res.is_success:
                    webhook_status = "dispatched"
                    logger.info("n8n webhook acknowledged receipt for attach-email ticket %s", payload.ticket_id)
                else:
                    webhook_status = "queued_offline"
                    logger.warning("n8n webhook returned status %s for attach-email ticket %s", res.status_code, payload.ticket_id)
        except httpx.TimeoutException:
            webhook_status = "queued_offline"
            logger.warning("n8n webhook timed out for attach-email ticket %s", payload.ticket_id)
        except Exception as e:
            webhook_status = "queued_offline"
            logger.warning("n8n webhook error for attach-email ticket %s: %s", payload.ticket_id, e)
    else:
        webhook_status = "queued_offline"

    # Update ticket in SQLite
    if update_ticket_customer_email:
        try:
            update_ticket_customer_email(payload.ticket_id, clean_email, n8n_status=webhook_status)
        except Exception as e:
            logger.warning("Failed to update ticket email in SQLite: %s", e)

    return {
        "status": "ok",
        "ticket_id": payload.ticket_id,
        "workspace_id": norm_ws,
        "brand_name": brand_name,
        "escalation_email": escalation_email,
        "sla_text": sla_text,
        "customer_email": clean_email,
        "webhook_status": webhook_status,
        "n8n_status": webhook_status,
        "message": f"Confirmation receipt dispatched to {clean_email}"
    }


@app.get("/api/history/{session_id}", tags=["Memory"])
async def get_history(session_id: str, workspace_id: Optional[str] = None):
    """Retrieve stored conversational turns for a session."""
    if get_session_history is None:
        return {
            "session_id": session_id,
            "turns": [],
            "startup_error": STARTUP_ERROR
        }
    history = get_session_history(session_id=session_id, limit=20, workspace_id=workspace_id)
    return {
        "session_id": session_id,
        "turns": history
    }


if __name__ == "__main__":
    import uvicorn
    port = int(os.getenv("PORT", 7860))
    uvicorn.run("backend.main:app", host="0.0.0.0", port=port, reload=True)
