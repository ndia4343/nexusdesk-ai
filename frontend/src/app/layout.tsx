import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "NexusDesk AI - Multi-Industry Agentic RAG Platform",
  description: "Autonomous Agentic RAG Customer Support & Operations with LangGraph cyclic reasoning, DuckDB catalog filtering, and n8n escalation.",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className="dark">
      <body className="bg-canvas text-slate-100 antialiased selection:bg-cyan selection:text-slate-950">
        {children}
      </body>
    </html>
  );
}
