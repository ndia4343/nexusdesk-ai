"use client";

import React from "react";
import {
  X,
  BookOpen,
  ShoppingBag,
  AlertTriangle,
  Star,
  CheckCircle2,
  Clock,
  Send,
  ExternalLink,
  ShieldCheck
} from "lucide-react";
import { DrawerContent } from "@/types";

interface ArtifactDrawerProps {
  content: DrawerContent;
  onClose: () => void;
}

export const ArtifactDrawer: React.FC<ArtifactDrawerProps> = ({ content, onClose }) => {
  if (!content) return null;

  return (
    <div className="fixed inset-y-0 right-0 w-80 sm:w-96 bg-surface border-l border-borderline shadow-2xl z-40 flex flex-col transition-all duration-300 animate-in slide-in-from-right">
      {/* Drawer Header */}
      <div className="h-16 px-4 border-b border-borderline flex items-center justify-between">
        <div className="flex items-center gap-2">
          {content.type === "citation" && (
            <>
              <BookOpen className="w-4 h-4 text-cyan" />
              <span className="font-semibold text-sm text-slate-100">Verified Knowledge Source</span>
            </>
          )}
          {content.type === "product" && (
            <>
              <ShoppingBag className="w-4 h-4 text-cyan" />
              <span className="font-semibold text-sm text-slate-100">Catalog Product Details</span>
            </>
          )}
          {content.type === "escalation" && (
            <>
              <AlertTriangle className="w-4 h-4 text-amber" />
              <span className="font-semibold text-sm text-slate-100">Escalation Audit Trail</span>
            </>
          )}
        </div>

        <button
          onClick={onClose}
          className="p-1.5 text-slate-400 hover:text-slate-100 hover:bg-card rounded-md transition-colors"
          title="Close Drawer"
        >
          <X className="w-4 h-4" />
        </button>
      </div>

      {/* Drawer Body */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {/* CITATION VIEW */}
        {content.type === "citation" && (
          <div className="space-y-4">
            <div className="p-3 rounded-lg bg-card border border-borderline space-y-2">
              <div className="text-xs font-semibold text-slate-200">
                {content.data.title}
              </div>
              <div className="flex items-center justify-between text-[11px] text-slate-400">
                <span>Vector Semantic Relevance</span>
                <span className="font-mono text-cyan font-semibold">
                  {(content.data.relevance * 100).toFixed(1)}%
                </span>
              </div>
              <div className="w-full bg-borderline h-1.5 rounded-full overflow-hidden">
                <div
                  className="bg-cyan h-full rounded-full transition-all duration-500"
                  style={{ width: `${Math.min(100, Math.max(10, content.data.relevance * 100))}%` }}
                />
              </div>
            </div>

            <div>
              <div className="text-[10px] font-bold uppercase tracking-wider text-slate-500 mb-1.5">
                Indexed Snippet Content
              </div>
              <div className="p-3 rounded-lg bg-card/60 border border-borderline font-mono text-xs text-slate-300 leading-relaxed whitespace-pre-wrap">
                {content.data.snippet}
              </div>
            </div>

            <div className="p-3 rounded-lg bg-emerald-subtle border border-emerald/20 flex items-start gap-2.5">
              <ShieldCheck className="w-4 h-4 text-emerald shrink-0 mt-0.5" />
              <div className="text-xs text-slate-300">
                <span className="font-semibold text-emerald">Grounded Verification</span>: This source was retrieved during the semantic RAG execution stage and scored above the confidence threshold.
              </div>
            </div>
          </div>
        )}

        {/* PRODUCT VIEW */}
        {content.type === "product" && (
          <div className="space-y-4">
            <div className="p-4 rounded-xl bg-card border border-borderline space-y-3">
              <div className="flex items-start justify-between gap-2">
                <div className="text-sm font-semibold text-slate-100">
                  {content.data.name}
                </div>
                <div className="text-sm font-mono font-bold text-cyan">
                  ${content.data.price.toFixed(2)}
                </div>
              </div>

              <div className="flex items-center gap-2">
                <span className="px-2 py-0.5 rounded text-[10px] font-medium bg-borderline text-slate-300">
                  {content.data.category}
                </span>
                {content.data.discount && content.data.discount !== "None" && (
                  <span className="px-2 py-0.5 rounded text-[10px] font-semibold bg-emerald-subtle text-emerald border border-emerald/30">
                    {content.data.discount}
                  </span>
                )}
              </div>

              <div className="flex items-center gap-1 text-amber">
                {[...Array(5)].map((_, i) => (
                  <Star
                    key={i}
                    className={`w-3.5 h-3.5 ${
                      i < Math.floor(content.data.rating)
                        ? "fill-amber text-amber"
                        : "text-slate-600"
                    }`}
                  />
                ))}
                <span className="text-xs font-mono text-slate-300 ml-1.5">
                  {content.data.rating} / 5.0
                </span>
              </div>
            </div>

            <div className="p-3 rounded-lg bg-card/60 border border-borderline space-y-2 text-xs text-slate-300">
              <div className="font-semibold text-slate-200">Catalog Engine Guarantee</div>
              <p className="leading-relaxed">
                Retrieved directly from the DuckDB structured catalog index. All pricing and numerical filtering constraints are mathematically guaranteed accurate without model hallucinations.
              </p>
            </div>
          </div>
        )}

        {/* ESCALATION VIEW */}
        {content.type === "escalation" && (
          <div className="space-y-4">
            <div className="p-4 rounded-xl bg-card border border-amber/30 space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-amber uppercase tracking-wider">
                  Support Ticket
                </span>
                <span className="font-mono text-xs font-bold px-2 py-0.5 rounded bg-amber/15 text-amber border border-amber/30">
                  #{content.data.escalation.ticket_id}
                </span>
              </div>

              <div className="space-y-1">
                <div className="text-[11px] text-slate-400">Customer Inquiry</div>
                <div className="text-xs text-slate-200 font-medium italic">
                  &ldquo;{content.data.query}&rdquo;
                </div>
              </div>

              <div className="pt-2 border-t border-borderline flex items-center justify-between text-[11px]">
                <span className="text-slate-400 flex items-center gap-1">
                  <Clock className="w-3 h-3" /> Timestamp
                </span>
                <span className="font-mono text-slate-300">
                  {new Date(content.data.timestamp).toLocaleTimeString()}
                </span>
              </div>

              <div className="flex items-center justify-between text-[11px]">
                <span className="text-slate-400 flex items-center gap-1">
                  <Send className="w-3 h-3" /> n8n Webhook Status
                </span>
                <span
                  className={`font-mono font-medium ${
                    content.data.escalation.n8n_status === "sent"
                      ? "text-emerald"
                      : "text-amber"
                  }`}
                >
                  {content.data.escalation.n8n_status}
                </span>
              </div>
            </div>

            <div className="p-3 rounded-lg bg-card/60 border border-borderline space-y-2 text-xs text-slate-300">
              <div className="font-semibold text-slate-200">Autonomous Workflow Action</div>
              <p className="leading-relaxed">
                The cyclic grader determined human intervention was required. A structured payload was automatically dispatched to the configured n8n customer support workflow, notifying on-call specialists.
              </p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
