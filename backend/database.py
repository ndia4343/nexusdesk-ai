"""
NexusDesk AI - Database Layer
Provides SQLite storage for customer support tickets and conversation session history.
"""

import os
import sqlite3
import datetime
import logging
from typing import Dict, Any, List, Optional

logger = logging.getLogger("nexusdesk.database")

def get_db_path() -> str:
    """Dynamically determine SQLite path, honoring VERCEL and read-only environments."""
    if os.getenv("DATABASE_PATH"):
        return os.getenv("DATABASE_PATH")
    if os.getenv("VERCEL"):
        return "/tmp/nexusdesk.db"
    db_dir = os.path.dirname(os.path.abspath(__file__))
    if not os.access(db_dir, os.W_OK):
        return "/tmp/nexusdesk.db"
    return os.path.join(db_dir, "nexusdesk.db")


def get_db_connection() -> sqlite3.Connection:
    """Establish and return an SQLite connection with row factory enabled."""
    db_path = get_db_path()
    os.makedirs(os.path.dirname(db_path), exist_ok=True)
    conn = sqlite3.connect(db_path, timeout=10.0)
    conn.row_factory = sqlite3.Row
    return conn


def init_db() -> None:
    """Initialize SQLite tables for tickets, session memory, and knowledge sources."""
    with get_db_connection() as conn:
        cursor = conn.cursor()
        
        # Tickets table for human escalation and audit logging
        cursor.execute("""
            CREATE TABLE IF NOT EXISTS tickets (
                ticket_id TEXT PRIMARY KEY,
                workspace_id TEXT NOT NULL DEFAULT 'demo',
                session_id TEXT NOT NULL,
                customer_query TEXT NOT NULL,
                intent TEXT NOT NULL,
                confidence_score REAL NOT NULL,
                status TEXT NOT NULL DEFAULT 'OPEN',
                n8n_status TEXT NOT NULL DEFAULT 'none',
                details TEXT,
                created_at TEXT NOT NULL
            )
        """)
        
        # Session memory table for stateful conversation tracking & query rewriting
        cursor.execute("""
            CREATE TABLE IF NOT EXISTS session_memory (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                workspace_id TEXT NOT NULL DEFAULT 'demo',
                session_id TEXT NOT NULL,
                role TEXT NOT NULL,
                content TEXT NOT NULL,
                timestamp TEXT NOT NULL
            )
        """)

        # Knowledge sources table for tracking ingested workspace documents
        cursor.execute("""
            CREATE TABLE IF NOT EXISTS knowledge_sources (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                workspace_id TEXT NOT NULL,
                source_name TEXT NOT NULL,
                source_type TEXT NOT NULL,
                chunk_count INTEGER NOT NULL DEFAULT 0,
                status TEXT NOT NULL DEFAULT 'indexed',
                created_at TEXT NOT NULL
            )
        """)
        
        # Check and migrate columns if tables previously existed without workspace_id
        cursor.execute("PRAGMA table_info(tickets)")
        cols_tickets = [col[1] for col in cursor.fetchall()]
        if "workspace_id" not in cols_tickets:
            try:
                cursor.execute("ALTER TABLE tickets ADD COLUMN workspace_id TEXT NOT NULL DEFAULT 'demo'")
            except Exception:
                pass

        cursor.execute("PRAGMA table_info(session_memory)")
        cols_mem = [col[1] for col in cursor.fetchall()]
        if "workspace_id" not in cols_mem:
            try:
                cursor.execute("ALTER TABLE session_memory ADD COLUMN workspace_id TEXT NOT NULL DEFAULT 'demo'")
            except Exception:
                pass

        # Create indexes for fast lookup
        cursor.execute("CREATE INDEX IF NOT EXISTS idx_tickets_session ON tickets(session_id)")
        cursor.execute("CREATE INDEX IF NOT EXISTS idx_tickets_workspace ON tickets(workspace_id)")
        cursor.execute("CREATE INDEX IF NOT EXISTS idx_memory_session ON session_memory(session_id)")
        cursor.execute("CREATE INDEX IF NOT EXISTS idx_sources_workspace ON knowledge_sources(workspace_id)")
        
        conn.commit()
    logger.info("Initialized SQLite database schema at %s", get_db_path())


def save_ticket(
    ticket_id: str,
    session_id: str,
    customer_query: str,
    intent: str,
    confidence_score: float,
    status: str = "OPEN",
    n8n_status: str = "none",
    details: Optional[str] = None,
    created_at: Optional[str] = None,
    workspace_id: str = "demo"
) -> Dict[str, Any]:
    """Persist a new support ticket to the SQLite database."""
    if not created_at:
        created_at = datetime.datetime.now(datetime.timezone.utc).isoformat()

    with get_db_connection() as conn:
        cursor = conn.cursor()
        cursor.execute("""
            INSERT OR REPLACE INTO tickets 
            (ticket_id, workspace_id, session_id, customer_query, intent, confidence_score, status, n8n_status, details, created_at)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        """, (ticket_id, workspace_id, session_id, customer_query, intent, confidence_score, status, n8n_status, details, created_at))
        conn.commit()

    logger.info("Ticket %s saved successfully with workspace=%s, n8n_status=%s", ticket_id, workspace_id, n8n_status)
    return {
        "ticket_id": ticket_id,
        "workspace_id": workspace_id,
        "session_id": session_id,
        "customer_query": customer_query,
        "intent": intent,
        "confidence_score": confidence_score,
        "status": status,
        "n8n_status": n8n_status,
        "created_at": created_at
    }


def update_ticket_n8n_status(ticket_id: str, n8n_status: str) -> None:
    """Update n8n dispatch status for an existing ticket."""
    with get_db_connection() as conn:
        cursor = conn.cursor()
        cursor.execute("UPDATE tickets SET n8n_status = ? WHERE ticket_id = ?", (n8n_status, ticket_id))
        conn.commit()


def get_ticket(ticket_id: str) -> Optional[Dict[str, Any]]:
    """Retrieve ticket details by ticket ID."""
    with get_db_connection() as conn:
        cursor = conn.cursor()
        cursor.execute("SELECT * FROM tickets WHERE ticket_id = ?", (ticket_id,))
        row = cursor.fetchone()
        if row:
            return dict(row)
        return None


def list_tickets(limit: int = 50, workspace_id: Optional[str] = None) -> List[Dict[str, Any]]:
    """Retrieve recent support tickets, optionally filtered by workspace."""
    with get_db_connection() as conn:
        cursor = conn.cursor()
        if workspace_id:
            cursor.execute("SELECT * FROM tickets WHERE workspace_id = ? ORDER BY created_at DESC LIMIT ?", (workspace_id, limit))
        else:
            cursor.execute("SELECT * FROM tickets ORDER BY created_at DESC LIMIT ?", (limit,))
        rows = cursor.fetchall()
        return [dict(r) for r in rows]


def save_message(session_id: str, role: str, content: str, workspace_id: str = "demo") -> None:
    """Append a conversational turn into session memory."""
    timestamp = datetime.datetime.now(datetime.timezone.utc).isoformat()
    with get_db_connection() as conn:
        cursor = conn.cursor()
        cursor.execute("""
            INSERT INTO session_memory (workspace_id, session_id, role, content, timestamp)
            VALUES (?, ?, ?, ?, ?)
        """, (workspace_id, session_id, role, content, timestamp))
        conn.commit()


def get_session_history(session_id: str, limit: int = 6, workspace_id: Optional[str] = None) -> List[Dict[str, str]]:
    """Retrieve recent conversation history for a given session."""
    with get_db_connection() as conn:
        cursor = conn.cursor()
        if workspace_id:
            cursor.execute("""
                SELECT role, content FROM session_memory 
                WHERE session_id = ? AND workspace_id = ?
                ORDER BY id ASC LIMIT ?
            """, (session_id, workspace_id, limit))
        else:
            cursor.execute("""
                SELECT role, content FROM session_memory 
                WHERE session_id = ? 
                ORDER BY id ASC LIMIT ?
            """, (session_id, limit))
        rows = cursor.fetchall()
        return [{"role": r["role"], "content": r["content"]} for r in rows]


def record_knowledge_source(
    workspace_id: str,
    source_name: str,
    source_type: str,
    chunk_count: int,
    status: str = "indexed"
) -> Dict[str, Any]:
    """Record an ingested knowledge source in SQLite."""
    created_at = datetime.datetime.now(datetime.timezone.utc).isoformat()
    try:
        with get_db_connection() as conn:
            cursor = conn.cursor()
            cursor.execute("""
                INSERT INTO knowledge_sources (workspace_id, source_name, source_type, chunk_count, status, created_at)
                VALUES (?, ?, ?, ?, ?, ?)
            """, (workspace_id, source_name, source_type, chunk_count, status, created_at))
            conn.commit()
            source_id = cursor.lastrowid
    except sqlite3.OperationalError:
        init_db()
        with get_db_connection() as conn:
            cursor = conn.cursor()
            cursor.execute("""
                INSERT INTO knowledge_sources (workspace_id, source_name, source_type, chunk_count, status, created_at)
                VALUES (?, ?, ?, ?, ?, ?)
            """, (workspace_id, source_name, source_type, chunk_count, status, created_at))
            conn.commit()
            source_id = cursor.lastrowid
    return {
        "id": source_id,
        "workspace_id": workspace_id,
        "source_name": source_name,
        "source_type": source_type,
        "chunk_count": chunk_count,
        "status": status,
        "created_at": created_at
    }


def list_knowledge_sources(workspace_id: str) -> List[Dict[str, Any]]:
    """List all ingested knowledge sources for a workspace."""
    try:
        with get_db_connection() as conn:
            cursor = conn.cursor()
            cursor.execute("""
                SELECT id, workspace_id, source_name, source_type, chunk_count, status, created_at 
                FROM knowledge_sources 
                WHERE workspace_id = ? 
                ORDER BY created_at DESC
            """, (workspace_id,))
            rows = cursor.fetchall()
            return [dict(r) for r in rows]
    except sqlite3.OperationalError:
        init_db()
        return []


def delete_knowledge_sources(workspace_id: str) -> int:
    """Delete all knowledge sources metadata for a workspace."""
    try:
        with get_db_connection() as conn:
            cursor = conn.cursor()
            cursor.execute("DELETE FROM knowledge_sources WHERE workspace_id = ?", (workspace_id,))
            deleted = cursor.rowcount
            conn.commit()
        return deleted
    except sqlite3.OperationalError:
        return 0


# Self-initialize schema if writable
try:
    init_db()
except Exception as _init_err:
    logger.debug("Database auto-init deferred: %s", _init_err)
