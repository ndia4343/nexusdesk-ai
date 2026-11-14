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

DB_DIR = os.path.dirname(os.path.abspath(__file__))
DEFAULT_DB_PATH = os.path.join(DB_DIR, "nexusdesk.db")
DATABASE_PATH = os.getenv("DATABASE_PATH", DEFAULT_DB_PATH)


def get_db_connection() -> sqlite3.Connection:
    """Establish and return an SQLite connection with row factory enabled."""
    os.makedirs(os.path.dirname(DATABASE_PATH), exist_ok=True)
    conn = sqlite3.connect(DATABASE_PATH, timeout=10.0)
    conn.row_factory = sqlite3.Row
    return conn


def init_db() -> None:
    """Initialize SQLite tables for tickets and session memory."""
    with get_db_connection() as conn:
        cursor = conn.cursor()
        
        # Tickets table for human escalation and audit logging
        cursor.execute("""
            CREATE TABLE IF NOT EXISTS tickets (
                ticket_id TEXT PRIMARY KEY,
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
                session_id TEXT NOT NULL,
                role TEXT NOT NULL,
                content TEXT NOT NULL,
                timestamp TEXT NOT NULL
            )
        """)
        
        # Create indexes for fast lookup
        cursor.execute("CREATE INDEX IF NOT EXISTS idx_tickets_session ON tickets(session_id)")
        cursor.execute("CREATE INDEX IF NOT EXISTS idx_memory_session ON session_memory(session_id)")
        
        conn.commit()
    logger.info("Initialized SQLite database schema at %s", DATABASE_PATH)


def save_ticket(
    ticket_id: str,
    session_id: str,
    customer_query: str,
    intent: str,
    confidence_score: float,
    status: str = "OPEN",
    n8n_status: str = "none",
    details: Optional[str] = None,
    created_at: Optional[str] = None
) -> Dict[str, Any]:
    """Persist a new support ticket to the SQLite database."""
    if not created_at:
        created_at = datetime.datetime.now(datetime.timezone.utc).isoformat()

    with get_db_connection() as conn:
        cursor = conn.cursor()
        cursor.execute("""
            INSERT OR REPLACE INTO tickets 
            (ticket_id, session_id, customer_query, intent, confidence_score, status, n8n_status, details, created_at)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
        """, (ticket_id, session_id, customer_query, intent, confidence_score, status, n8n_status, details, created_at))
        conn.commit()

    logger.info("Ticket %s saved successfully with n8n_status=%s", ticket_id, n8n_status)
    return {
        "ticket_id": ticket_id,
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


def list_tickets(limit: int = 50) -> List[Dict[str, Any]]:
    """Retrieve recent support tickets."""
    with get_db_connection() as conn:
        cursor = conn.cursor()
        cursor.execute("SELECT * FROM tickets ORDER BY created_at DESC LIMIT ?", (limit,))
        rows = cursor.fetchall()
        return [dict(r) for r in rows]


def save_message(session_id: str, role: str, content: str) -> None:
    """Append a conversational turn into session memory."""
    timestamp = datetime.datetime.now(datetime.timezone.utc).isoformat()
    with get_db_connection() as conn:
        cursor = conn.cursor()
        cursor.execute("""
            INSERT INTO session_memory (session_id, role, content, timestamp)
            VALUES (?, ?, ?, ?)
        """, (session_id, role, content, timestamp))
        conn.commit()


def get_session_history(session_id: str, limit: int = 6) -> List[Dict[str, str]]:
    """Retrieve recent conversation history for a given session."""
    with get_db_connection() as conn:
        cursor = conn.cursor()
        cursor.execute("""
            SELECT role, content FROM session_memory 
            WHERE session_id = ? 
            ORDER BY id ASC LIMIT ?
        """, (session_id, limit))
        rows = cursor.fetchall()
        return [{"role": r["role"], "content": r["content"]} for r in rows]
