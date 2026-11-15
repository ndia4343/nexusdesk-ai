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
  Cpu,
  Database,
  Search,
  Send,
  Zap,
  Tag
} from "lucide-react";
import {
  ChatMessage,
  Workspace,
  DrawerContent,
  SourceItem,
  ProductItem,
  EscalationInfo
} from "@/types";

interface ChatCanvasProps {
  messages: ChatMessage[];
  activeWorkspace: Workspace;
  onSendStarterPrompt: (prompt: string) => void;
  onOpenDrawer: (content: DrawerContent) => void;
  isLoading: boolean;
}

export const ChatCanvas: React.FC<ChatCanvasProps> = ({
  messages,
  activeWorkspace,
  onSendStarterPrompt,
  onOpenDrawer,
  isLoading
}) => {
  // Store expanded state per message id for Claude-style reasoning accordion
  const [expandedReasoning, setExpandedReasoning] = useState<Record<string, boolean>>({});

  const toggleReasoning = (messageId: string) => {
    setExpandedReasoning((prev) => ({
      ...prev,
      [messageId]: !prev[messageId]
    }));
  };

  return (
    <div className="flex-1 overflow-y-auto px-4 pt-6 pb-40">
      <div className="max-w-3xl mx-auto space-y-6">
        {/* WELCOME / EMPTY STATE */}
        {messages.length === 0 && (
          <div className="pt-8 pb-4 text-center space-y-8 animate-in fade-in duration-300">
            <div className="space-y-3">
              <div className="w-12 h-12 rounded-2xl bg-gradient-to-tr from-cyan via-indigo to-slate-900 mx-auto flex items-center justify-center shadow-xl shadow-cyan/20 border border-cyan/30">
                <Sparkles className="w-6 h-6 text-white" />
              </div>
              <h1 className="text-2xl font-bold tracking-tight text-slate-100">
                Welcome to {activeWorkspace.name}
              </h1>
              <p className="text-sm text-slate-400 max-w-xl mx-auto leading-relaxed">
                {activeWorkspace.description}
              </p>
            </div>

            {/* Starter Prompt Cards */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3 text-left">
              {activeWorkspace.seedPrompts.map((prompt, idx) => (
                <button
                  key={idx}
                  onClick={() => onSendStarterPrompt(prompt)}
                  className="p-4 rounded-xl bg-card hover:bg-borderline/60 border border-borderline hover:border-cyan/50 text-slate-300 hover:text-white transition-all duration-200 flex flex-col justify-between group shadow-sm"
                >
                  <div className="text-xs font-medium leading-relaxed group-hover:text-cyan transition-colors">
                    &ldquo;{prompt}&rdquo;
                  </div>
                  <div className="mt-3 flex items-center gap-1.5 text-[11px] text-slate-500 group-hover:text-slate-400">
                    <Zap className="w-3 h-3 text-cyan" />
                    <span>Run Query</span>
                  </div>
                </button>
              ))}
            </div>

            {/* Architectural Badges */}
            <div className="pt-4 border-t border-borderline/50 flex flex-wrap items-center justify-center gap-2 text-[11px] text-slate-400">
              <span className="px-2.5 py-1 rounded-full bg-card border border-borderline flex items-center gap-1.5">
                <Cpu className="w-3.5 h-3.5 text-indigo" />
                LangGraph Cyclic StateGraph
              </span>
              <span className="px-2.5 py-1 rounded-full bg-card border border-borderline flex items-center gap-1.5">
                <Database className="w-3.5 h-3.5 text-cyan" />
                DuckDB SQL Engine
              </span>
              <span className="px-2.5 py-1 rounded-full bg-card border border-borderline flex items-center gap-1.5">
                <Search className="w-3.5 h-3.5 text-emerald" />
                Semantic FAISS Retrieval
              </span>
              <span className="px-2.5 py-1 rounded-full bg-card border border-borderline flex items-center gap-1.5">
                <Send className="w-3.5 h-3.5 text-amber" />
                n8n Webhook Dispatch
              </span>
            </div>
          </div>
        )}

        {/* MESSAGE STREAM */}
        {messages.map((msg) => {
          const isUser = msg.role === "user";
          const isReasoningOpen = !!expandedReasoning[msg.id];

          return (
            <div
              key={msg.id}
              className={`flex flex-col ${isUser ? "items-end" : "items-start"} space-y-2 animate-in fade-in duration-200`}
            >
              {/* User Message */}
              {isUser ? (
                <div className="max-w-[85%] rounded-2xl rounded-tr-sm bg-card border border-borderline px-4 py-3 text-sm text-slate-100 shadow-md">
                  {msg.content}
                </div>
              ) : (
                /* Assistant Message */
                <div className="w-full space-y-3">
                  {/* Claude-Style Collapsible Agent Reasoning Accordion */}
                  {msg.executionTrace && msg.executionTrace.length > 0 && (
                    <div className="w-full rounded-xl bg-card/70 border border-borderline overflow-hidden shadow-sm">
                      <button
                        onClick={() => toggleReasoning(msg.id)}
                        className="w-full px-3.5 py-2.5 flex items-center justify-between text-xs text-slate-400 hover:text-slate-200 transition-colors bg-card/40"
                      >
                        <div className="flex items-center gap-2">
                          <Zap className="w-3.5 h-3.5 text-cyan" />
                          <span className="font-semibold text-slate-300">
                            Agent Reasoning
                          </span>
                          <span className="text-[11px] text-slate-500 font-mono">
                            ({msg.executionTrace.length} steps)
                          </span>
                          {msg.confidenceScore !== undefined && (
                            <span className="px-1.5 py-0.5 rounded font-mono text-[10px] bg-emerald-subtle text-emerald border border-emerald/30 font-semibold">
                              {(msg.confidenceScore * 100).toFixed(0)}% Grounded
                            </span>
                          )}
                        </div>

                        <div className="flex items-center gap-1 text-[11px]">
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
                        <div className="p-3.5 border-t border-borderline bg-canvas/60 space-y-2.5 font-mono text-xs">
                          {msg.executionTrace.map((trace, idx) => (
                            <div
                              key={idx}
                              className="flex items-center justify-between p-2 rounded-lg bg-card/60 border border-borderline/60"
                            >
                              <div className="flex items-center gap-2">
                                <span className="w-1.5 h-1.5 rounded-full bg-cyan" />
                                <span className="text-slate-200 font-medium font-sans">
                                  {trace.step}
                                </span>
                                <span className="text-[11px] text-indigo font-mono bg-indigo-subtle px-1.5 py-0.5 rounded">
                                  {trace.tool}
                                </span>
                              </div>
                              <div className="flex items-center gap-3 text-[11px]">
                                <span className="text-slate-400">{trace.status}</span>
                                <span className="text-cyan font-mono flex items-center gap-1">
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
                  <div className="p-4 rounded-xl bg-surface/50 border border-borderline/60 text-sm text-slate-200 leading-relaxed whitespace-pre-wrap font-sans">
                    {msg.content}
                  </div>

                  {/* Matching Products Cards (Horizontal Grid) */}
                  {msg.products && msg.products.length > 0 && (
                    <div className="space-y-2 pt-1">
                      <div className="text-[11px] font-bold uppercase tracking-wider text-slate-500 flex items-center gap-1.5">
                        <ShoppingBag className="w-3.5 h-3.5 text-cyan" />
                        <span>Matching Catalog Products ({msg.products.length})</span>
                      </div>
                      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-2.5">
                        {msg.products.map((prod, pIdx) => (
                          <button
                            key={pIdx}
                            onClick={() => onOpenDrawer({ type: "product", data: prod })}
                            className="p-3 rounded-lg bg-card hover:bg-borderline/70 border border-borderline text-left transition-all group flex flex-col justify-between"
                          >
                            <div className="space-y-1">
                              <div className="text-xs font-semibold text-slate-100 group-hover:text-cyan transition-colors line-clamp-1">
                                {prod.name}
                              </div>
                              <div className="text-[10px] text-slate-400 line-clamp-1">
                                {prod.category}
                              </div>
                            </div>

                            <div className="mt-2.5 pt-2 border-t border-borderline flex items-center justify-between text-xs">
                              <span className="font-mono font-bold text-cyan">
                                ${prod.price.toFixed(2)}
                              </span>
                              <div className="flex items-center gap-1 text-amber text-[10px]">
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
                      <div className="text-[11px] font-bold uppercase tracking-wider text-slate-500 flex items-center gap-1.5">
                        <BookOpen className="w-3.5 h-3.5 text-cyan" />
                        <span>Verified Citations ({msg.sources.length})</span>
                      </div>
                      <div className="flex flex-wrap gap-2">
                        {msg.sources.map((src, sIdx) => (
                          <button
                            key={sIdx}
                            onClick={() => onOpenDrawer({ type: "citation", data: src })}
                            className="px-2.5 py-1.5 rounded-lg bg-card hover:bg-borderline border border-borderline hover:border-cyan/40 text-xs text-slate-300 hover:text-white transition-all flex items-center gap-2 group"
                          >
                            <BookOpen className="w-3 h-3 text-cyan group-hover:scale-110 transition-transform" />
                            <span className="truncate max-w-[200px]">{src.title}</span>
                            <span className="text-[10px] font-mono font-semibold text-cyan">
                              {(src.relevance * 100).toFixed(0)}%
                            </span>
                          </button>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Escalation Ticket Alert Card */}
                  {msg.escalation && msg.escalation.triggered && (
                    <div className="p-3.5 rounded-xl bg-amber-subtle border border-amber/30 flex items-start justify-between gap-3">
                      <div className="flex items-start gap-2.5">
                        <AlertTriangle className="w-4 h-4 text-amber shrink-0 mt-0.5" />
                        <div>
                          <div className="text-xs font-semibold text-amber">
                            Human Support Ticket Created
                          </div>
                          <div className="text-xs text-slate-300 mt-0.5">
                            Ticket <span className="font-mono font-bold text-amber">#{msg.escalation.ticket_id}</span> has been dispatched via n8n webhook.
                          </div>
                        </div>
                      </div>

                      <button
                        onClick={() =>
                          onOpenDrawer({
                            type: "escalation",
                            data: {
                              escalation: msg.escalation!,
                              query: msg.content,
                              timestamp: msg.timestamp
                            }
                          })
                        }
                        className="px-2.5 py-1 rounded-md bg-amber/20 hover:bg-amber/30 text-amber text-[11px] font-semibold transition-colors shrink-0"
                      >
                        View Audit
                      </button>
                    </div>
                  )}
                </div>
              )}
            </div>
          );
        })}

        {/* Live Loading Indicator */}
        {isLoading && (
          <div className="flex items-center gap-3 p-4 rounded-xl bg-card/60 border border-borderline animate-pulse">
            <div className="w-2.5 h-2.5 rounded-full bg-cyan animate-ping" />
            <div className="text-xs text-slate-300 font-mono">
              NexusDesk agent executing cyclic LangGraph reasoning...
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
