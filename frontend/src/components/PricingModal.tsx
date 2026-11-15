"use client";

import React from "react";
import { X, Check, Zap, Building2, Shield, ArrowRight } from "lucide-react";

interface PricingModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSelectTier?: (tier: string) => void;
}

export const PricingModal: React.FC<PricingModalProps> = ({ isOpen, onClose }) => {
  if (!isOpen) return null;

  const tiers = [
    {
      name: "Starter",
      badge: "For Small Teams",
      price: "$49",
      period: "/ month",
      description: "Ideal for boutique e-commerce stores and solo practices automating routine inquiries.",
      features: [
        "1 Isolated Department Workspace",
        "5,000 queries / month",
        "100 URL pages or PDF chunks",
        "Semantic Vector Search",
        "Standard Response SLA (< 800ms)",
        "Email Support"
      ],
      popular: false,
      cta: "Start 14-Day Free Trial"
    },
    {
      name: "Growth",
      badge: "Most Popular",
      price: "$199",
      period: "/ month",
      description: "For scaling companies requiring structured product catalogs and automated escalation.",
      features: [
        "5 Independent Department Workspaces",
        "50,000 queries / month",
        "Unlimited URL & Document Ingestion",
        "DuckDB Structured Catalog SQL Filtering",
        "Automated n8n Webhook Ticket Dispatch",
        "Confidence Self-Grading & Query Rewriter",
        "Slack & Team Portal Integration",
        "Priority Support"
      ],
      popular: true,
      cta: "Deploy Growth Agent"
    },
    {
      name: "Enterprise",
      badge: "Dedicated & VPC",
      price: "Custom",
      period: "annual billing",
      description: "For regulated industries, healthcare systems, and enterprises demanding private infrastructure.",
      features: [
        "Unlimited Custom Workspaces",
        "Custom LLM Hosting (Self-hosted or Private VPC)",
        "Dedicated SAML / Okta SSO & RBAC",
        "Zero Model Training Guarantee (SOC 2 Type II)",
        "Custom DuckDB Schema & ERP Connectors",
        "99.95% Uptime SLA Agreement",
        "Dedicated Solutions Engineer"
      ],
      popular: false,
      cta: "Contact Enterprise Sales"
    }
  ];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-canvas/80 backdrop-blur-md animate-in fade-in overflow-y-auto">
      <div className="w-full max-w-4xl bg-surface border border-cardborder rounded-2xl shadow-2xl overflow-hidden flex flex-col shadow-highlight my-8">
        {/* Header */}
        <div className="px-6 py-5 border-b border-borderline flex items-center justify-between">
          <div>
            <h2 className="text-lg font-bold text-slate-100 flex items-center gap-2">
              <span>Transparent B2B Pricing</span>
              <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-emerald-subtle text-emerald border border-emerald/40">
                14-Day Trial Available
              </span>
            </h2>
            <p className="text-xs text-slate-400 mt-0.5">
              Scale customer support automation with guaranteed accuracy, data isolation, and human escalation.
            </p>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-slate-200 hover:bg-card rounded-md transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Pricing Cards Grid */}
        <div className="p-6 grid grid-cols-1 md:grid-cols-3 gap-4">
          {tiers.map((t, idx) => (
            <div
              key={idx}
              className={`rounded-2xl p-5 flex flex-col justify-between transition-all relative ${
                t.popular
                  ? "bg-card border-2 border-cyan shadow-glow shadow-cyan/10"
                  : "bg-card/70 border border-cardborder shadow-highlight hover:border-slate-500"
              }`}
            >
              {t.popular && (
                <div className="absolute -top-3 left-1/2 -translate-x-1/2 px-3 py-0.5 rounded-full bg-cyan text-slate-950 font-bold text-[10px] tracking-wider uppercase shadow-md">
                  Recommended
                </div>
              )}

              <div className="space-y-4">
                <div>
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-bold text-slate-100">{t.name}</span>
                    <span className="text-[10px] font-semibold text-slate-400">{t.badge}</span>
                  </div>
                  <div className="mt-2 flex items-baseline gap-1">
                    <span className="text-2xl font-black text-slate-100 font-mono">{t.price}</span>
                    <span className="text-xs text-slate-400 font-medium">{t.period}</span>
                  </div>
                  <p className="mt-2 text-xs text-slate-300 leading-relaxed font-normal">
                    {t.description}
                  </p>
                </div>

                <div className="pt-3 border-t border-borderline space-y-2">
                  <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                    Included Capabilities
                  </div>
                  <ul className="space-y-2">
                    {t.features.map((f, fIdx) => (
                      <li key={fIdx} className="flex items-start gap-2 text-xs text-slate-200">
                        <Check className="w-3.5 h-3.5 text-emerald shrink-0 mt-0.5" />
                        <span className="leading-snug">{f}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              </div>

              <div className="pt-5">
                <button
                  type="button"
                  onClick={onClose}
                  className={`w-full py-2.5 rounded-xl font-bold text-xs flex items-center justify-center gap-1.5 transition-all ${
                    t.popular
                      ? "bg-cyan hover:bg-cyan/90 text-slate-950 shadow-md shadow-cyan/20"
                      : "bg-surface hover:bg-cardhover text-slate-200 hover:text-white border border-cardborder shadow-highlight"
                  }`}
                >
                  <span>{t.cta}</span>
                  <ArrowRight className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>
          ))}
        </div>

        {/* Security & Isolation Callout */}
        <div className="px-6 py-3.5 border-t border-borderline bg-canvas/60 flex items-center justify-between text-xs text-slate-400">
          <div className="flex items-center gap-2">
            <Shield className="w-4 h-4 text-emerald" />
            <span className="font-medium text-slate-300">
              Enterprise Commitment: Zero customer data is ever retained for public LLM training.
            </span>
          </div>
          <span className="font-mono text-[11px] text-slate-400">SOC 2 & GDPR Aligned</span>
        </div>
      </div>
    </div>
  );
};
