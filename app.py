"""
NexusDesk AI - Hugging Face Gradio Space Entrypoint
Mounts a Gradio status & interactive testing interface at '/' while preserving
FastAPI API endpoints (/api/chat, /api/search, /health, /docs) at the root URL.
"""

import os
import json
import logging
import gradio as gr
from backend.main import app as fastapi_app
from backend.rag_pipeline import run_agentic_pipeline
from backend.database import list_tickets

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger("nexusdesk.app")


def chat_handler(query: str, session_id: str):
    """Processes queries through the cyclic LangGraph Agentic RAG pipeline."""
    if not query or not query.strip():
        return (
            "Please provide a query to test.",
            0.0,
            [],
            [],
            [],
            "No escalation triggered."
        )

    sess = session_id.strip() if session_id and session_id.strip() else "gradio_session"
    result = run_agentic_pipeline(query.strip(), session_id=sess)

    answer = result.get("answer", "")
    confidence = result.get("confidence_score", 0.0)
    trace = result.get("execution_trace", [])
    products = result.get("products", [])
    sources = result.get("sources", [])
    escalation = result.get("escalation", {})

    esc_summary = (
        f"**Triggered**: {escalation.get('triggered', False)}\n\n"
        f"**Ticket ID**: `{escalation.get('ticket_id') or 'N/A'}`\n\n"
        f"**n8n Webhook Status**: `{escalation.get('n8n_status', 'none')}`"
    )

    return answer, confidence, trace, products, sources, esc_summary


def load_recent_tickets():
    """Fetches recent support tickets from the SQLite database."""
    try:
        tickets = list_tickets(limit=10)
        return json.dumps(tickets, indent=2) if tickets else "No escalated tickets in database yet."
    except Exception as e:
        return f"Error retrieving tickets: {e}"


# ==============================================================================
# GRADIO STATUS & TESTING INTERFACE
# ==============================================================================

with gr.Blocks(title="NexusDesk AI — Customer Support Engine", theme=gr.themes.Soft()) as status_ui:
    gr.Markdown(
        """
        # ⚡ NexusDesk AI — Autonomous Customer Support Engine
        **Stateful LangGraph Agentic RAG • DuckDB SQL Catalog • FAISS Semantic Search • n8n Escalation**
        """
    )

    with gr.Row():
        with gr.Column(scale=2):
            gr.Markdown(
                """
                ### 🟢 Service Status: Online
                All REST API endpoints are active and accessible directly at this root domain:
                * **Chat / Search**: `POST /api/chat` (alias: `POST /api/search`)
                * **Health Probe**: `GET /health` and `GET /api/health`
                * **Swagger API Docs**: `GET /docs`
                * **Ticket History**: `GET /api/tickets`
                """
            )
        with gr.Column(scale=1):
            refresh_btn = gr.Button("🔄 Refresh Database Status", size="sm")

    with gr.Tabs():
        with gr.Tab("💬 Live Agent Testing"):
            with gr.Row():
                with gr.Column(scale=3):
                    query_input = gr.Textbox(
                        label="Customer Query",
                        placeholder="e.g. Show me noise cancelling headphones under $300 with rating above 4.5",
                        lines=2
                    )
                    session_input = gr.Textbox(
                        label="Session ID (Memory Tracking)",
                        value="demo_session_1",
                        lines=1
                    )
                    submit_btn = gr.Button("🚀 Run Pipeline", variant="primary")

                    gr.Examples(
                        examples=[
                            ["Show me noise cancelling headphones under $300 with rating above 4.5", "demo_session_1"],
                            ["What is your 30-day return policy for opened items?", "demo_session_2"],
                            ["Compare the battery life and warranty of Sony WH-1000XM5 and Bose QC45", "demo_session_3"],
                            ["I received a damaged package yesterday, how do I get a replacement?", "demo_session_4"],
                            ["I demand to speak to a human supervisor immediately!", "demo_session_5"]
                        ],
                        inputs=[query_input, session_input]
                    )

                with gr.Column(scale=4):
                    answer_output = gr.Markdown(label="Synthesized Customer Answer")
                    confidence_output = gr.Number(label="Confidence Score (0.0 - 1.0)")
                    escalation_output = gr.Markdown(label="Escalation Status")

            with gr.Row():
                with gr.Accordion("🔍 Execution Trace (Node Latencies & Tool Usage)", open=False):
                    trace_output = gr.JSON(label="Execution Trace")
                with gr.Accordion("📦 Matched Products (DuckDB SQL)", open=False):
                    products_output = gr.JSON(label="Products")
                with gr.Accordion("📚 Retrieved Knowledge Chunks (FAISS Semantic RAG)", open=False):
                    sources_output = gr.JSON(label="Sources")

            submit_btn.click(
                fn=chat_handler,
                inputs=[query_input, session_input],
                outputs=[
                    answer_output,
                    confidence_output,
                    trace_output,
                    products_output,
                    sources_output,
                    escalation_output
                ]
            )

        with gr.Tab("🎫 SQLite Support Tickets (Audit)"):
            tickets_display = gr.Code(
                label="Recent Escalated Support Tickets",
                language="json",
                value=load_recent_tickets()
            )
            refresh_btn.click(fn=load_recent_tickets, outputs=[tickets_display])

        with gr.Tab("📖 API Contract & cURL Examples"):
            gr.Markdown(
                """
                ### cURL Integration Example
                You can invoke NexusDesk AI from any application or terminal:
                ```bash
                curl -X POST "https://alkahan-nexusdesk-ai.hf.space/api/chat" \\
                     -H "Content-Type: application/json" \\
                     -d '{
                           "query": "Show me laptops under $1000 with discount",
                           "session_id": "user_123"
                         }'
                ```
                """
            )

# Mount Gradio app at root '/' on the FastAPI application
app = gr.mount_gradio_app(fastapi_app, status_ui, path="/")

if __name__ == "__main__":
    import uvicorn
    port = int(os.getenv("PORT", 7860))
    logger.info("Starting NexusDesk AI on port %d...", port)
    uvicorn.run(app, host="0.0.0.0", port=port)
