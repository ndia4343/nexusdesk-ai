"use client";

import React from "react";
import {
  ShoppingBag,
  Stethoscope,
  Users,
  Building2,
  PlusCircle,
  MessageSquare,
  PanelLeftClose,
  Sparkles
} from "lucide-react";
import { Workspace, ChatSession } from "@/types";

interface SidebarProps {
  workspaces: Workspace[];
  activeWorkspaceId: string;
  onSelectWorkspace: (id: string) => void;
  onOpenConnectModal: () => void;
  isOpen: boolean;
  onToggle: () => void;
  recentSessions: (ChatSession | string)[];
  activeSessionId: string;
  onSelectSession: (sessionId: string) => void;
  onNewSession: () => void;
  apiHealthy: boolean | null;
}

export const Sidebar: React.FC<SidebarProps> = ({
  workspaces,
  activeWorkspaceId,
  onSelectWorkspace,
  onOpenConnectModal,
  isOpen,
  onToggle,
  recentSessions,
  activeSessionId,
  onSelectSession,
  onNewSession,
  apiHealthy
}) => {
  if (!isOpen) return null;

  const getIcon = (iconName: string) => {
    switch (iconName) {
      case "ShoppingBag":
        return <ShoppingBag className="w-4 h-4 text-sky-600 dark:text-cyan" />;
      case "Stethoscope":
        return <Stethoscope className="w-4 h-4 text-emerald" />;
      case "Users":
        return <Users className="w-4 h-4 text-indigo" />;
      default:
        return <Building2 className="w-4 h-4 text-amber" />;
    }
  };

  const commercialWorkspaces = workspaces.filter((w) =>
    ["retail_ops", "clinic_ops", "hr_ops"].includes(w.id)
  );
  const customWorkspaces = workspaces.filter(
    (w) => !["retail_ops", "clinic_ops", "hr_ops"].includes(w.id)
  );

  return (
    <aside className="w-72 bg-surface border-r border-borderline flex flex-col h-screen shrink-0 select-none z-30 transition-all duration-200">
      {/* Brand Header */}
      <div className="h-16 px-4 border-b border-borderline flex items-center justify-between">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-cyan to-indigo flex items-center justify-center shadow-md">
            <Sparkles className="w-4 h-4 text-slate-950 font-bold" />
          </div>
          <div>
            <div className="font-bold text-sm tracking-wide text-slate-900 dark:text-slate-100 flex items-center gap-1.5">
              NexusDesk AI
              <span className="w-2 h-2 rounded-full bg-sky-500 dark:bg-cyan animate-pulse-subtle" />
            </div>
            <div className="text-[11px] text-slate-600 dark:text-slate-400 font-medium">Agentic RAG Platform</div>
          </div>
        </div>

        <button
          onClick={onToggle}
          className="p-1.5 text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-slate-200 hover:bg-card rounded-md transition-colors"
          title="Collapse Sidebar"
        >
          <PanelLeftClose className="w-4 h-4" />
        </button>
      </div>

      {/* New Chat Button */}
      <div className="p-3">
        <button
          onClick={onNewSession}
          className="w-full py-2.5 px-3 rounded-xl bg-card hover:bg-cardhover text-slate-800 dark:text-slate-200 hover:text-slate-950 dark:hover:text-white border border-cardborder flex items-center justify-center gap-2 text-xs font-bold transition-all shadow-sm group"
        >
          <PlusCircle className="w-4 h-4 text-sky-600 dark:text-cyan group-hover:scale-110 transition-transform" />
          <span>New Conversation</span>
        </button>
      </div>

      {/* Navigation Sections */}
      <div className="flex-1 overflow-y-auto px-3 py-2 space-y-6">
        {/* Commercial Pre-Seeded Workspaces */}
        <div>
          <div className="px-2 mb-2 text-[10px] font-bold uppercase tracking-wider text-slate-600 dark:text-slate-400">
            Commercial Workspaces
          </div>
          <div className="space-y-1">
            {commercialWorkspaces.map((ws) => {
              const isActive = ws.id === activeWorkspaceId;
              return (
                <button
                  key={ws.id}
                  onClick={() => onSelectWorkspace(ws.id)}
                  className={`w-full text-left px-3 py-2.5 rounded-xl flex items-center justify-between text-xs transition-all ${
                    isActive
                      ? "bg-card border-2 border-sky-500 dark:border-cyan text-slate-950 dark:text-white font-bold shadow-sm"
                      : "text-slate-700 dark:text-slate-300 hover:bg-cardhover hover:text-slate-950 dark:hover:text-white font-medium"
                  }`}
                >
                  <div className="flex items-center gap-2.5 truncate">
                    {getIcon(ws.icon)}
                    <span className="truncate">{ws.name}</span>
                  </div>
                  {ws.totalChunks !== undefined && ws.totalChunks !== null ? (
                    <span
                      className={`text-[10px] px-1.5 py-0.5 rounded font-mono font-bold ${
                        isActive
                          ? "bg-sky-100 dark:bg-cyan/20 text-sky-700 dark:text-cyan border border-sky-300 dark:border-cyan/40"
                          : "bg-canvas text-slate-700 dark:text-slate-300 border border-borderline"
                      }`}
                    >
                      {ws.totalChunks}
                    </span>
                  ) : (
                    <span className="w-2 h-2 rounded-full bg-sky-500 dark:bg-cyan/60 animate-pulse" />
                  )}
                </button>
              );
            })}
          </div>
        </div>

        {/* Custom Client Workspaces (if any) */}
        {customWorkspaces.length > 0 && (
          <div>
            <div className="px-2 mb-2 text-[10px] font-bold uppercase tracking-wider text-slate-600 dark:text-slate-400">
              Custom Workspaces
            </div>
            <div className="space-y-1">
              {customWorkspaces.map((ws) => {
                const isActive = ws.id === activeWorkspaceId;
                return (
                  <button
                    key={ws.id}
                    onClick={() => onSelectWorkspace(ws.id)}
                    className={`w-full text-left px-3 py-2.5 rounded-xl flex items-center justify-between text-xs transition-all ${
                      isActive
                        ? "bg-card border-2 border-amber text-slate-950 dark:text-white font-bold shadow-sm"
                        : "text-slate-700 dark:text-slate-300 hover:bg-cardhover hover:text-slate-950 dark:hover:text-white font-medium"
                    }`}
                  >
                    <div className="flex items-center gap-2.5 truncate">
                      {getIcon(ws.icon)}
                      <span className="truncate">{ws.name}</span>
                    </div>
                    {ws.totalChunks !== undefined && ws.totalChunks !== null ? (
                      <span className="text-[10px] px-1.5 py-0.5 rounded font-mono bg-canvas text-slate-700 dark:text-slate-300 border border-borderline font-bold">
                        {ws.totalChunks}
                      </span>
                    ) : (
                      <span className="w-2 h-2 rounded-full bg-amber animate-pulse" />
                    )}
                  </button>
                );
              })}
            </div>
          </div>
        )}

        {/* Connect Company Action */}
        <div className="pt-1">
          <button
            onClick={onOpenConnectModal}
            className="w-full py-2.5 px-3 rounded-xl border border-dashed border-cardborder hover:border-sky-500 dark:hover:border-cyan hover:bg-card/70 text-slate-700 dark:text-slate-300 hover:text-sky-600 dark:hover:text-cyan flex items-center justify-center gap-2 text-xs font-semibold transition-all shadow-sm group"
          >
            <PlusCircle className="w-3.5 h-3.5 text-slate-500 dark:text-slate-400 group-hover:text-sky-600 dark:group-hover:text-cyan transition-colors" />
            <span>Connect Website / Company</span>
          </button>
        </div>

        {/* Recent Conversations */}
        <div>
          <div className="px-2 mb-2 text-[10px] font-bold uppercase tracking-wider text-slate-600 dark:text-slate-400">
            Recent Sessions
          </div>
          <div className="space-y-1">
            {recentSessions.length === 0 ? (
              <div className="px-2 py-2 text-[11px] text-slate-500 italic">
                No previous sessions
              </div>
            ) : (
              recentSessions.map((sess) => {
                const sid = typeof sess === "string" ? sess : sess.id;
                const title = typeof sess === "string" ? sess : (sess.title || sess.firstQuery || sess.id);
                const isActive = sid === activeSessionId;
                return (
                  <button
                    key={sid}
                    onClick={() => onSelectSession(sid)}
                    className={`w-full text-left px-2.5 py-1.5 rounded-lg flex items-center gap-2 text-xs truncate transition-colors ${
                      isActive
                        ? "bg-card text-sky-600 dark:text-cyan font-bold border border-sky-400/40 dark:border-cyan/30"
                        : "text-slate-700 dark:text-slate-300 hover:bg-cardhover hover:text-slate-950 dark:hover:text-white font-medium"
                    }`}
                  >
                    <MessageSquare className="w-3 h-3 shrink-0" />
                    <span className="truncate text-[11px] font-sans font-medium">{title}</span>
                  </button>
                );
              })
            )}
          </div>
        </div>
      </div>

      {/* Footer System Status */}
      <div className="p-3 border-t border-borderline bg-surface flex items-center justify-between text-[11px]">
        <div className="flex items-center gap-2">
          {apiHealthy === true ? (
            <>
              <span className="w-2 h-2 rounded-full bg-emerald" />
              <span className="text-emerald font-bold">Agent Online</span>
            </>
          ) : apiHealthy === false ? (
            <>
              <span className="w-2 h-2 rounded-full bg-amber" />
              <span className="text-amber font-bold">Connecting...</span>
            </>
          ) : (
            <>
              <span className="w-2 h-2 rounded-full bg-slate-400" />
              <span className="text-slate-600 dark:text-slate-300 font-medium">Checking API</span>
            </>
          )}
        </div>
        <div className="text-[10px] font-mono text-slate-500 dark:text-slate-400">v1.0.0</div>
      </div>
    </aside>
  );
};
