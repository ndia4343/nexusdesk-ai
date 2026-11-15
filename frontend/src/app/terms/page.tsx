import React from "react";
import Link from "next/link";
import { ArrowLeft, CheckCircle, ShieldCheck, Scale, FileText } from "lucide-react";

export const metadata = {
  title: "Terms of Service | NexusDesk AI",
  description: "Commercial service terms, SLA agreements, and intellectual property ownership.",
};

export default function TermsPage() {
  return (
    <div className="min-h-screen bg-canvas text-slate-100 font-sans selection:bg-cyan selection:text-slate-950">
      <div className="max-w-4xl mx-auto px-6 py-12 space-y-10">
        {/* Navigation back */}
        <Link
          href="/"
          className="inline-flex items-center gap-2 text-xs font-semibold text-cyan hover:text-cyan/80 transition-colors"
        >
          <ArrowLeft className="w-4 h-4" />
          <span>Return to NexusDesk Console</span>
        </Link>

        {/* Header */}
        <div className="space-y-3 border-b border-borderline pb-8">
          <div className="flex items-center gap-2">
            <span className="px-3 py-1 rounded-full text-xs font-semibold bg-cyan/15 text-cyan border border-cyan/40">
              Commercial B2B Agreement
            </span>
            <span className="text-xs text-slate-400 font-mono">Effective: November 2026</span>
          </div>
          <h1 className="text-3xl font-extrabold tracking-tight text-slate-100">
            Terms of Service
          </h1>
          <p className="text-sm text-slate-300 leading-relaxed max-w-2xl font-normal">
            These Commercial Terms of Service (&ldquo;Terms&rdquo;) govern access to and usage of the NexusDesk AI Agentic Customer Support and Operations platform.
          </p>
        </div>

        {/* Key Tenets */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="p-5 rounded-2xl bg-card border border-cardborder shadow-highlight space-y-2">
            <Scale className="w-5 h-5 text-cyan" />
            <h3 className="text-sm font-bold text-slate-100">Customer Data Ownership</h3>
            <p className="text-xs text-slate-300 leading-relaxed font-normal">
              You retain 100% intellectual property ownership of all uploaded documentation, catalogs, and customer dialog history.
            </p>
          </div>

          <div className="p-5 rounded-2xl bg-card border border-cardborder shadow-highlight space-y-2">
            <ShieldCheck className="w-5 h-5 text-emerald" />
            <h3 className="text-sm font-bold text-slate-100">99.9% Uptime Target</h3>
            <p className="text-xs text-slate-300 leading-relaxed font-normal">
              We provide enterprise API availability backed by high-speed serverless deployment and automated circuit breaker fallbacks.
            </p>
          </div>

          <div className="p-5 rounded-2xl bg-card border border-cardborder shadow-highlight space-y-2">
            <FileText className="w-5 h-5 text-indigo" />
            <h3 className="text-sm font-bold text-slate-100">Transparent SLA</h3>
            <p className="text-xs text-slate-300 leading-relaxed font-normal">
              Deterministic DuckDB catalog execution and isolated vector retrieval guarantee sub-second median latency.
            </p>
          </div>
        </div>

        {/* Sections */}
        <div className="space-y-8 text-sm leading-relaxed text-slate-200">
          <section className="space-y-3">
            <h2 className="text-lg font-bold text-slate-100 border-b border-borderline pb-2">
              1. Commercial Use & Workspace Provisioning
            </h2>
            <p className="text-slate-300 font-normal">
              NexusDesk grants your organization a non-exclusive, non-transferable license to access our Agentic RAG services. Each workspace partition acts as an isolated logical tenant. You are responsible for ensuring that content uploaded to your workspaces does not violate third-party intellectual property or applicable regulatory mandates.
            </p>
          </section>

          <section className="space-y-3">
            <h2 className="text-lg font-bold text-slate-100 border-b border-borderline pb-2">
              2. Acceptable Use Policy
            </h2>
            <p className="text-slate-300 font-normal">
              You agree not to utilize NexusDesk AI for:
            </p>
            <ul className="list-disc pl-5 space-y-1.5 text-slate-300 font-normal">
              <li>Scanning, probing, or testing vulnerabilities of internal or private IP address spaces.</li>
              <li>Ingesting classified, highly sensitive personal financial numbers without prior enterprise HIPAA/BBA agreements.</li>
              <li>Attempting to bypass confidence threshold safeguards or automate malicious ticket generation.</li>
            </ul>
          </section>

          <section className="space-y-3">
            <h2 className="text-lg font-bold text-slate-100 border-b border-borderline pb-2">
              3. Service Level Commitments & Escalation
            </h2>
            <p className="text-slate-300 font-normal">
              When confidence scores for customer inquiries fall below 0.65, the NexusDesk agent autonomously attempts a cyclic query reformulation before escalating to human support through configured webhooks (e.g. n8n). NexusDesk is not liable for secondary workflow delays caused by downstream external webhook endpoints.
            </p>
          </section>

          <section className="space-y-3">
            <h2 className="text-lg font-bold text-slate-100 border-b border-borderline pb-2">
              4. Termination & Right to Data Retrieval
            </h2>
            <p className="text-slate-300 font-normal">
              Upon termination of your subscription, you may request an export of all conversation transcripts and ticket records, or invoke the <code className="text-cyan font-mono text-xs">DELETE /api/knowledge</code> endpoint to wipe all indexed chunks instantaneously.
            </p>
          </section>
        </div>

        {/* Footer */}
        <div className="pt-8 border-t border-borderline flex items-center justify-between text-xs text-slate-400">
          <div>© {new Date().getFullYear()} NexusDesk AI Technologies. All rights reserved.</div>
          <Link href="/privacy" className="hover:text-cyan transition-colors font-medium">
            View Privacy Policy &rarr;
          </Link>
        </div>
      </div>
    </div>
  );
}
