"use client";

import React, { useState } from "react";
import {
  Sparkles,
  ChevronDown,
  ChevronUp,
  Clock,
  BookOpen,
  ShoppingBag,
  Star,
  AlertTriangle,
  CheckCircle2,
  ShieldCheck,
  Cpu,
  Database,
  Search,
  Send,
  Zap,
  Tag,
  ArrowRight
} from "lucide-react";
import {
  ChatMessage,
  Workspace,
  DrawerContent,
  SourceItem,
  ProductItem,
  EscalationInfo,
  AgenticAction
} from "@/types";
import { MarkdownText } from "./MarkdownText";

interface ChatCanvasProps {
  messages: ChatMessage[];
  activeWorkspace: Workspace;
  onSendStarterPrompt: (prompt: string) => void;
  onOpenDrawer: (content: DrawerContent) => void;
  isLoading: boolean;
  onTriggerAction: (messageId: string, action: AgenticAction, queryText: string) => void;
}

export const ChatCanvas: React.FC<ChatCanvasProps> = ({
  messages,
  activeWorkspace,
  onSendStarterPrompt,
  onOpenDrawer,
  isLoading,
  onTriggerAction
}) => {
  // Store expanded state per message id for Claude-style reasoning accordion
  const [expandedReasoning, setExpandedReasoning] = useState<Record<string, boolean>>({});

  const toggleReasoning = (messageId: string) => {
    setExpandedReasoning((prev) => ({
      ...prev,
      [messageId]: !prev[messageId]
    }));
  };

  const getAgenticActionForMessage = (msg: ChatMessage, wsId: string): AgenticAction | null => {
    // If an escalation ticket is already created in the main response, do not render a duplicate action card
    if (msg.escalation && msg.escalation.triggered) {
      return null;
    }
    if (msg.action) return msg.action;
    const text = (msg.content || "").toLowerCase();

    // 1. Expense Claim / Reimbursement / Per-Diem
    if (
      text.includes("expense") ||
      text.includes("per diem") ||
      text.includes("per-diem") ||
      text.includes("reimburse") ||
      text.includes("receipt") ||
      text.includes("stipend") ||
      text.includes("concur")
    ) {
      return {
        type: "expense_claim",
        title: "Automated Expense Claim Workflow",
        subtitle: "Pre-validates itemized receipts and per-diem thresholds before dispatching to accounting.",
        buttonLabel: "Trigger Workflow / Submit Request"
      };
    }

    // 2. Appointment Booking / Clinical Scheduling
    if (
      text.includes("appointment") ||
      text.includes("consultation") ||
      text.includes("schedule") ||
      text.includes("doctor") ||
      text.includes("clinic") ||
      text.includes("copay") ||
      text.includes("patient")
    ) {
      return {
        type: "appointment_booking",
        title: "Clinical Appointment Booking Dispatch",
        subtitle: "Syncs physician availability and queues biometric intake slot via EHR workflow.",
        buttonLabel: "Trigger Workflow / Submit Request"
      };
    }

    // 3. Return Exception / Warranty RMA
    if (
      text.includes("return") ||
      text.includes("refund") ||
      text.includes("warranty") ||
      text.includes("replacement") ||
      text.includes("rma") ||
      text.includes("defective") ||
      text.includes("damaged")
    ) {
      return {
        type: "return_exception",
        title: "Return Merchandise Authorization (RMA) Dispatch",
        subtitle: "Generates carrier return label and initiates inventory replacement workflow.",
        buttonLabel: "Trigger Workflow / Submit Request"
      };
    }

    // 4. Low-confidence query (only if not already escalated)
    if (msg.confidenceScore !== undefined && msg.confidenceScore < 0.70) {
      return {
        type: "support_escalation",
        title: "Specialist Support Dispatch",
        subtitle: "Dispatches conversational transcript and audit log to on-call support team via n8n.",
        buttonLabel: "Trigger Workflow / Submit Request"
      };
    }

    // 5. General People Operations for hr_ops
    if (wsId === "hr_ops" && (text.includes("leave") || text.includes("pto") || text.includes("holiday") || text.includes("remote") || text.includes("laptop") || text.includes("benefit"))) {
      return {
        type: "hr_ops_request",
        title: "People Operations Ticket Dispatch",
        subtitle: "Securely logs internal HR inquiry to the confidential employee operations queue.",
        buttonLabel: "Trigger Workflow / Submit Request"
      };
    }

    return null;
  };

  return (
    <div className="flex-1 overflow-y-auto px-4 pt-6 pb-40 relative">
      {/* Top ambient radial glow */}
      <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[720px] h-[360px] pointer-events-none bg-[radial-gradient(ellipse_at_top,rgba(56,189,248,0.08),rgba(129,140,248,0.06),transparent_70%)] z-0" />

      <div className="max-w-3xl mx-auto space-y-6 relative z-10">
        {/* WELCOME / EMPTY STATE */}
        {messages.length === 0 && (
          <div className="pt-8 pb-4 text-center space-y-8 animate-in fade-in duration-300">
            <div className="space-y-3">
              <div className="w-12 h-12 rounded-2xl bg-gradient-to-tr from-cyan via-indigo to-slate-900 mx-auto flex items-center justify-center shadow-md border border-cyan/40">
                <Sparkles className="w-6 h-6 text-white" />
              </div>
              <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-slate-900 dark:text-slate-100">
                Welcome to {activeWorkspace.name}
              </h1>
              <p className="text-sm text-slate-600 dark:text-slate-300 max-w-xl mx-auto leading-relaxed font-normal">
                {activeWorkspace.description}
              </p>
            </div>

            {/* Starter Prompt Cards */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3 text-left">
              {activeWorkspace.seedPrompts.map((prompt, idx) => (
                <button
                  key={idx}
                  onClick={() => onSendStarterPrompt(prompt)}
                  className="p-4 rounded-xl bg-card hover:bg-cardhover border border-cardborder hover:border-sky-500 dark:hover:border-cyan/50 text-slate-800 dark:text-slate-200 hover:text-slate-950 dark:hover:text-white transition-all duration-200 flex flex-col justify-between group shadow-sm"
                >
                  <div className="text-xs font-semibold leading-relaxed group-hover:text-sky-600 dark:group-hover:text-cyan transition-colors">
                    &ldquo;{prompt}&rdquo;
                  </div>
                  <div className="mt-3 flex items-center gap-1.5 text-[11px] text-slate-600 dark:text-slate-400 group-hover:text-slate-900 dark:group-hover:text-slate-200 font-medium">
                    <Zap className="w-3 h-3 text-sky-600 dark:text-cyan" />
                    <span>Run Query</span>
                  </div>
                </button>
              ))}
            </div>

            {/* Business Outcome Badges */}
            <div className="pt-4 border-t border-borderline flex flex-wrap items-center justify-center gap-2.5 text-[11px] text-slate-700 dark:text-slate-200">
              <span className="px-3 py-1.5 rounded-full bg-card border border-cardborder shadow-sm flex items-center gap-1.5 font-medium">
                <BookOpen className="w-3.5 h-3.5 text-sky-600 dark:text-cyan" />
                Verified Source Citations
              </span>
              <span className="px-3 py-1.5 rounded-full bg-card border border-cardborder shadow-sm flex items-center gap-1.5 font-medium">
                <Search className="w-3.5 h-3.5 text-indigo" />
                Hybrid Catalog & Policy RAG
              </span>
              <span className="px-3 py-1.5 rounded-full bg-card border border-cardborder shadow-sm flex items-center gap-1.5 font-medium">
                <ShieldCheck className="w-3.5 h-3.5 text-emerald" />
                Confidence Self-Grading
              </span>
              <span className="px-3 py-1.5 rounded-full bg-card border border-cardborder shadow-sm flex items-center gap-1.5 font-medium">
                <Send className="w-3.5 h-3.5 text-amber" />
                Automated n8n Escalation
              </span>
            </div>
          </div>
        )}

        {/* MESSAGE STREAM */}
        {messages.map((msg, idx) => {
          const isUser = msg.role === "user";
          const isReasoningOpen = !!expandedReasoning[msg.id];
          const action = !isUser ? getAgenticActionForMessage(msg, activeWorkspace.id) : null;

          // Find the user's original query that prompted this assistant response
          const userQuery = !isUser
            ? messages
                .slice(0, idx)
                .reverse()
                .find((m) => m.role === "user")?.content || msg.content
            : msg.content;

          return (
            <div
              key={msg.id}
              className={`flex flex-col ${isUser ? "items-end" : "items-start"} space-y-2 animate-in fade-in duration-200`}
            >
              {/* User Message */}
              {isUser ? (
                <div className="max-w-[85%] rounded-2xl rounded-tr-sm bg-slate-100 dark:bg-card border border-slate-300 dark:border-cardborder px-4 py-3 text-sm text-slate-900 dark:text-slate-100 font-medium shadow-sm">
                  {msg.content}
                </div>
              ) : (
                /* Assistant Message */
                <div className="w-full space-y-3">
                  {/* Claude-Style Collapsible Agent Reasoning Accordion */}
                  {msg.executionTrace && msg.executionTrace.length > 0 && (
                    <div className="w-full rounded-xl bg-card border border-cardborder overflow-hidden shadow-sm">
                      <button
                        onClick={() => toggleReasoning(msg.id)}
                        className="w-full px-3.5 py-2.5 flex items-center justify-between text-xs text-slate-700 dark:text-slate-300 hover:text-slate-950 dark:hover:text-white transition-colors bg-card"
                      >
                        <div className="flex items-center gap-2">
                          <Zap className="w-3.5 h-3.5 text-sky-600 dark:text-cyan" />
                          <span className="font-bold text-slate-900 dark:text-slate-200">
                            Agent Reasoning
                          </span>
                          <span className="text-[11px] text-slate-500 dark:text-slate-400 font-mono">
                            ({msg.executionTrace.length} steps)
                          </span>
                          {msg.confidenceScore !== undefined && (
                            <span className="px-2 py-0.5 rounded font-mono text-[10px] bg-emerald-subtle text-emerald border border-emerald/30 font-bold">
                              {(msg.confidenceScore * 100).toFixed(0)}% Grounded
                            </span>
                          )}
                        </div>

                        <div className="flex items-center gap-1 text-[11px] text-slate-500 dark:text-slate-400 font-medium">
                          <span>{isReasoningOpen ? "Hide Trace" : "Show Trace"}</span>
                          {isReasoningOpen ? (
                            <ChevronUp className="w-3.5 h-3.5" />
                          ) : (
                            <ChevronDown className="w-3.5 h-3.5" />
                          )}
                        </div>
                      </button>

                      {/* Expanded Accordion Body */}
                      {isReasoningOpen && (
                        <div className="p-3.5 border-t border-cardborder bg-surface space-y-2 font-mono text-xs">
                          {msg.executionTrace.map((trace, idx) => (
                            <div
                              key={idx}
                              className="flex items-center justify-between p-2.5 rounded-lg bg-card border border-cardborder shadow-sm"
                            >
                              <div className="flex items-center gap-2">
                                <span className="w-1.5 h-1.5 rounded-full bg-sky-500 dark:bg-cyan" />
                                <span className="text-slate-900 dark:text-slate-100 font-medium font-sans">
                                  {trace.step}
                                </span>
                                <span className="text-[11px] text-indigo font-mono bg-indigo-subtle px-2 py-0.5 rounded border border-indigo/20 font-bold">
                                  {trace.tool}
                                </span>
                              </div>
                              <div className="flex items-center gap-3 text-[11px]">
                                <span className="text-slate-600 dark:text-slate-400 font-sans">{trace.status}</span>
                                <span className="text-sky-600 dark:text-cyan font-mono flex items-center gap-1 font-bold">
                                  <Clock className="w-3 h-3" />
                                  {trace.latency_ms}ms
                                </span>
                              </div>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  )}

                  {/* Main Grounded Answer Text */}
                  <div className="p-4 rounded-xl bg-card border border-cardborder shadow-sm text-sm text-slate-900 dark:text-slate-100 leading-relaxed font-sans font-normal">
                    <MarkdownText content={msg.content} />
                  </div>

                  {/* Matching Products Cards (Horizontal Grid) */}
                  {msg.products && msg.products.length > 0 && (
                    <div className="space-y-2 pt-1">
                      <div className="text-[11px] font-bold uppercase tracking-wider text-slate-600 dark:text-slate-400 flex items-center gap-1.5">
                        <ShoppingBag className="w-3.5 h-3.5 text-sky-600 dark:text-cyan" />
                        <span>Matching Catalog Products ({msg.products.length})</span>
                      </div>
                      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-2.5">
                        {msg.products.map((prod, pIdx) => (
                          <button
                            key={pIdx}
                            onClick={() => onOpenDrawer({ type: "product", data: prod })}
                            className="p-3.5 rounded-xl bg-card hover:bg-cardhover border border-cardborder hover:border-sky-500 dark:hover:border-cyan/50 text-left transition-all group flex flex-col justify-between shadow-sm"
                          >
                            <div className="space-y-1">
                              <div className="text-xs font-bold text-slate-900 dark:text-slate-100 group-hover:text-sky-600 dark:group-hover:text-cyan transition-colors line-clamp-1">
                                {prod.name}
                              </div>
                              <div className="text-[10px] text-slate-600 dark:text-slate-400 line-clamp-1 font-medium">
                                {prod.category}
                              </div>
                            </div>

                            <div className="mt-3 pt-2 border-t border-cardborder flex items-center justify-between text-xs">
                              <span className="font-mono font-bold text-sky-600 dark:text-cyan">
                                ${prod.price.toFixed(2)}
                              </span>
                              <div className="flex items-center gap-1 text-amber text-[10px] font-semibold">
                                <Star className="w-3 h-3 fill-amber" />
                                <span>{prod.rating}</span>
                              </div>
                            </div>
                          </button>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Clickable Citation Chips */}
                  {msg.sources && msg.sources.length > 0 && (
                    <div className="space-y-2 pt-1">
                      <div className="text-[11px] font-bold uppercase tracking-wider text-slate-600 dark:text-slate-400 flex items-center gap-1.5">
                        <BookOpen className="w-3.5 h-3.5 text-sky-600 dark:text-cyan" />
                        <span>Verified Citations ({msg.sources.length})</span>
                      </div>
                      <div className="flex flex-wrap gap-2">
                        {msg.sources.map((src, sIdx) => (
                          <button
                            key={sIdx}
                            onClick={() => onOpenDrawer({ type: "citation", data: src })}
                            className="px-3 py-1.5 rounded-lg bg-card hover:bg-cardhover border border-cardborder hover:border-sky-500 dark:hover:border-cyan text-xs text-slate-800 dark:text-slate-200 hover:text-slate-950 dark:hover:text-white transition-all flex items-center gap-2 group shadow-sm font-medium"
                          >
                            <BookOpen className="w-3 h-3 text-sky-600 dark:text-cyan group-hover:scale-110 transition-transform" />
                            <span className="truncate max-w-[220px]">{src.title}</span>
                            <span className="text-[10px] font-mono font-bold text-sky-700 dark:text-cyan bg-sky-100 dark:bg-cyan/10 px-1.5 py-0.5 rounded border border-sky-300 dark:border-cyan/20">
                              {(src.relevance * 100).toFixed(0)}%
                            </span>
                          </button>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Escalation Ticket Alert Card */}
                  {msg.escalation && msg.escalation.triggered && (() => {
                    const formattedTicketId = msg.escalation.ticket_id
                      ? `#${msg.escalation.ticket_id.replace(/^#+/, "")}`
                      : "#ND-UNKNOWN";

                    return (
                      <div className="p-4 rounded-xl bg-card border border-amber/50 shadow-sm flex items-start justify-between gap-3">
                        <div className="flex items-start gap-3">
                          <AlertTriangle className="w-5 h-5 text-amber shrink-0 mt-0.5" />
                          <div>
                            <div className="text-xs font-bold text-amber-900 dark:text-amber">
                              Human Support Ticket Created
                            </div>
                            <div className="text-xs text-slate-800 dark:text-slate-200 mt-1 font-medium">
                              Ticket{" "}
                              <span className="font-mono font-bold text-amber-900 dark:text-amber px-1.5 py-0.5 rounded bg-amber-100 dark:bg-amber/15 border border-amber-300 dark:border-amber/30">
                                {formattedTicketId}
                              </span>{" "}
                              has been dispatched via n8n webhook.
                            </div>
                          </div>
                        </div>

                        <button
                          onClick={() =>
                            onOpenDrawer({
                              type: "escalation",
                              data: {
                                escalation: {
                                  ...msg.escalation!,
                                  ticket_id: formattedTicketId
                                },
                                query: userQuery,
                                timestamp: msg.timestamp
                              }
                            })
                          }
                          className="px-3 py-1.5 rounded-lg bg-amber-100 hover:bg-amber-200 dark:bg-amber/20 dark:hover:bg-amber/30 text-amber-900 dark:text-amber text-xs font-bold transition-colors shrink-0 border border-amber-300 dark:border-amber/40"
                        >
                          View Audit
                        </button>
                      </div>
                    );
                  })()}

                  {/* Interactive Agentic Action Card */}
                  {action && (
                    <div className="p-4 rounded-xl bg-card border border-sky-500/40 dark:border-cyan/40 shadow-sm flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 bg-gradient-to-r from-sky-500/5 to-indigo-500/5 transition-all">
                      <div className="flex items-start gap-3">
                        <div className="w-8 h-8 rounded-lg bg-sky-500/10 dark:bg-cyan/10 border border-sky-500/30 dark:border-cyan/30 flex items-center justify-center shrink-0 mt-0.5 text-sky-600 dark:text-cyan">
                          <Zap className="w-4 h-4 fill-current" />
                        </div>
                        <div>
                          <div className="text-xs font-bold text-slate-900 dark:text-slate-100 flex items-center gap-2">
                            <span>{action.title}</span>
                            {action.dispatched && (
                              <span className="font-mono text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-subtle text-emerald border border-emerald/30 flex items-center gap-1">
                                <CheckCircle2 className="w-3 h-3" />
                                {action.ticketId || "Dispatched"}
                              </span>
                            )}
                          </div>
                          <p className="text-[11px] text-slate-600 dark:text-slate-400 mt-0.5 font-medium">
                            {action.dispatched
                              ? "Operational request recorded in audit database & dispatched via webhook."
                              : action.subtitle}
                          </p>
                        </div>
                      </div>

                      <div className="shrink-0 w-full sm:w-auto">
                        {action.dispatched ? (
                          <button
                            onClick={() => {
                              const formattedActionTicketId = action.ticketId
                                ? `#${action.ticketId.replace(/^#+/, "")}`
                                : "#ND-ACTION";
                              onOpenDrawer({
                                type: "escalation",
                                data: {
                                  escalation: {
                                    triggered: true,
                                    ticket_id: formattedActionTicketId,
                                    status: "OPEN",
                                    webhook_status: "dispatched",
                                    n8n_status: "dispatched"
                                  },
                                  query: userQuery,
                                  timestamp: msg.timestamp
                                }
                              });
                            }}
                            className="w-full sm:w-auto px-3.5 py-2 rounded-xl bg-card hover:bg-cardhover border border-cardborder text-xs font-bold text-sky-600 dark:text-cyan hover:text-sky-700 dark:hover:text-cyan/80 transition-colors shadow-sm flex items-center justify-center gap-1.5"
                          >
                            <span>View Live Ticket</span>
                            <ArrowRight className="w-3.5 h-3.5" />
                          </button>
                        ) : (
                          <button
                            onClick={() => onTriggerAction(msg.id, action, userQuery)}
                            className="w-full sm:w-auto px-3.5 py-2 rounded-xl bg-sky-600 dark:bg-cyan hover:bg-sky-700 dark:hover:bg-cyan/90 text-white dark:text-slate-950 text-xs font-bold transition-all shadow-md flex items-center justify-center gap-2"
                          >
                            <Sparkles className="w-3.5 h-3.5" />
                            <span>{action.buttonLabel}</span>
                          </button>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
          );
        })}

        {/* Live Loading Indicator */}
        {isLoading && (
          <div className="flex items-center gap-3 p-4 rounded-xl bg-card border border-cardborder shadow-sm animate-pulse">
            <div className="w-2.5 h-2.5 rounded-full bg-sky-500 dark:bg-cyan animate-ping" />
            <div className="text-xs text-slate-700 dark:text-slate-200 font-mono font-medium">
              NexusDesk agent executing cyclic LangGraph reasoning...
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
