import React from "react";
import Link from "next/link";
import { ArrowLeft, ShieldCheck, Lock, Database, UserCheck } from "lucide-react";

export const metadata = {
  title: "Privacy Policy & EU GDPR Compliance | NexusDesk AI",
  description: "Enterprise privacy policy, multi-tenant data isolation architecture, and zero model training commitment.",
};

export default function PrivacyPage() {
  return (
    <div className="min-h-screen bg-canvas text-slate-900 dark:text-slate-100 font-sans selection:bg-cyan selection:text-slate-950">
      <div className="max-w-4xl mx-auto px-6 py-12 space-y-10">
        {/* Navigation back */}
        <Link
          href="/"
          className="inline-flex items-center gap-2 text-xs font-bold text-sky-600 dark:text-cyan hover:text-sky-700 dark:hover:text-cyan/80 transition-colors"
        >
          <ArrowLeft className="w-4 h-4" />
          <span>Return to NexusDesk Console</span>
        </Link>

        {/* Header */}
        <div className="space-y-3 border-b border-borderline pb-8">
          <div className="flex items-center gap-2">
            <span className="px-3 py-1 rounded-full text-xs font-bold bg-emerald-subtle text-emerald border border-emerald/40">
              EU GDPR & SOC 2 Aligned
            </span>
            <span className="text-xs text-slate-500 dark:text-slate-400 font-mono">Last Updated: November 2026</span>
          </div>
          <h1 className="text-3xl font-extrabold tracking-tight text-slate-900 dark:text-slate-100">
            Enterprise Privacy & Data Protection Policy
          </h1>
          <p className="text-sm text-slate-700 dark:text-slate-300 leading-relaxed max-w-2xl font-medium">
            NexusDesk AI is engineered from the ground up for strict data confidentiality, multi-tenant isolation, and complete European Union GDPR compliance.
          </p>
        </div>

        {/* Core Pillars */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="p-5 rounded-2xl bg-card border border-cardborder shadow-sm space-y-2">
            <Lock className="w-5 h-5 text-sky-600 dark:text-cyan" />
            <h3 className="text-sm font-bold text-slate-900 dark:text-slate-100">Zero Model Training</h3>
            <p className="text-xs text-slate-700 dark:text-slate-300 leading-relaxed font-medium">
              Your uploaded documents, catalogs, and customer conversations are strictly isolated and never used to train or fine-tune public AI foundation models.
            </p>
          </div>

          <div className="p-5 rounded-2xl bg-card border border-cardborder shadow-sm space-y-2">
            <Database className="w-5 h-5 text-indigo" />
            <h3 className="text-sm font-bold text-slate-900 dark:text-slate-100">Tenant Isolation</h3>
            <p className="text-xs text-slate-700 dark:text-slate-300 leading-relaxed font-medium">
              All vector indexes and DuckDB SQL tables are isolated strictly by workspace ID. Queries execute exclusively within your tenant partition.
            </p>
          </div>

          <div className="p-5 rounded-2xl bg-card border border-cardborder shadow-sm space-y-2">
            <UserCheck className="w-5 h-5 text-emerald" />
            <h3 className="text-sm font-bold text-slate-900 dark:text-slate-100">Right to Erasure</h3>
            <p className="text-xs text-slate-700 dark:text-slate-300 leading-relaxed font-medium">
              In full compliance with EU GDPR Article 17, our API provides instantaneous deletion endpoints (<code className="text-sky-700 dark:text-cyan font-mono text-[11px] bg-sky-50 dark:bg-cyan/10 px-1 py-0.5 rounded border border-sky-200 dark:border-cyan/20">DELETE /api/knowledge</code>) to purge workspace data permanently.
            </p>
          </div>
        </div>

        {/* Detailed Sections */}
        <div className="space-y-8 text-sm leading-relaxed text-slate-800 dark:text-slate-200">
          <section className="space-y-3">
            <h2 className="text-lg font-bold text-slate-900 dark:text-slate-100 border-b border-borderline pb-2">
              1. Information We Collect & Process
            </h2>
            <p className="text-slate-700 dark:text-slate-300 font-medium">
              NexusDesk AI processes data strictly on behalf of commercial customers (&ldquo;Data Controllers&rdquo;). We collect:
            </p>
            <ul className="list-disc pl-5 space-y-1.5 text-slate-700 dark:text-slate-300 font-medium">
              <li><strong className="text-slate-900 dark:text-slate-100 font-bold">Knowledge Ingestion Content:</strong> Public URLs, PDF handbooks, CSV catalogs, and markdown documentation uploaded to seed workspaces.</li>
              <li><strong className="text-slate-900 dark:text-slate-100 font-bold">Conversational Turns:</strong> Customer inquiries and grounded agent responses stored temporarily to maintain context during stateful support sessions.</li>
              <li><strong className="text-slate-900 dark:text-slate-100 font-bold">Escalation Audit Metadata:</strong> Timestamps, intent classifications, and confidence scores dispatched to client-configured webhook endpoints (e.g., n8n).</li>
            </ul>
          </section>

          <section className="space-y-3">
            <h2 className="text-lg font-bold text-slate-900 dark:text-slate-100 border-b border-borderline pb-2">
              2. Data Residency & Encryption Standards
            </h2>
            <p className="text-slate-700 dark:text-slate-300 font-medium">
              All customer data is encrypted in transit using TLS 1.3 and encrypted at rest with AES-256 encryption. We operate stateless containerized workloads with isolated temporary storage volumes (<code className="text-sky-700 dark:text-cyan font-mono text-xs bg-sky-50 dark:bg-cyan/10 px-1 py-0.5 rounded border border-sky-200 dark:border-cyan/20">/tmp</code>) that do not persist data across container recycling unless backed by an explicit enterprise managed database.
            </p>
          </section>

          <section className="space-y-3">
            <h2 className="text-lg font-bold text-slate-900 dark:text-slate-100 border-b border-borderline pb-2">
              3. EU GDPR & Data Subject Rights
            </h2>
            <p className="text-slate-700 dark:text-slate-300 font-medium">
              European Economic Area (EEA) and UK users maintain full legal rights under Articles 15 through 22 of the EU General Data Protection Regulation:
            </p>
            <div className="p-4 rounded-xl bg-card border border-cardborder space-y-2 shadow-sm">
              <div className="flex items-center gap-2 font-bold text-slate-900 dark:text-slate-100 text-xs">
                <ShieldCheck className="w-4 h-4 text-emerald" />
                <span>Summary of Guaranteed EU Rights:</span>
              </div>
              <p className="text-xs text-slate-700 dark:text-slate-300 font-medium">
                You possess the Right of Access, Rectification, Erasure (&ldquo;Right to be Forgotten&rdquo;), Restriction of Processing, Data Portability, and the Right to Object to automated decision-making. Requests can be executed directly via our REST API or by emailing our Data Protection Officer at <span className="text-sky-600 dark:text-cyan font-mono font-bold">privacy@nexusdesk.ai</span>.
              </p>
            </div>
          </section>

          <section className="space-y-3">
            <h2 className="text-lg font-bold text-slate-900 dark:text-slate-100 border-b border-borderline pb-2">
              4. Safe Ingestion & Web Scraping Controls
            </h2>
            <p className="text-slate-700 dark:text-slate-300 font-medium">
              Our automated URL ingestion engine strictly prohibits Server-Side Request Forgery (SSRF). Ingestion targets are validated against private IP ranges (RFC 1918), link-local interfaces, and internal container networks. We only crawl publicly accessible HTTP/HTTPS documentation with a strict 10-second timeout and 5MB payload limit.
            </p>
          </section>
        </div>

        {/* Footer */}
        <div className="pt-8 border-t border-borderline flex items-center justify-between text-xs text-slate-600 dark:text-slate-400">
          <div>© {new Date().getFullYear()} NexusDesk AI Technologies. All rights reserved.</div>
          <Link href="/terms" className="hover:text-sky-600 dark:hover:text-cyan transition-colors font-bold">
            View Terms of Service &rarr;
          </Link>
        </div>
      </div>
    </div>
  );
}
