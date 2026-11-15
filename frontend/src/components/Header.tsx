"use client";

import React from "react";
import {
  PanelLeftOpen,
  ShieldCheck,
  ChevronDown,
  RotateCcw,
  Sparkles,
  ShoppingBag,
  Stethoscope,
  Users,
  Building2
} from "lucide-react";
import { Workspace } from "@/types";

interface HeaderProps {
  sidebarOpen: boolean;
  onToggleSidebar: () => void;
  activeWorkspace: Workspace;
  workspaces: Workspace[];
  onSelectWorkspace: (id: string) => void;
  onResetChat: () => void;
  apiHealthy: boolean | null;
}

export const Header: React.FC<HeaderProps> = ({
  sidebarOpen,
  onToggleSidebar,
  activeWorkspace,
  workspaces,
  onSelectWorkspace,
  onResetChat,
  apiHealthy
}) => {
  const getIcon = (iconName: string) => {
    switch (iconName) {
      case "ShoppingBag":
        return <ShoppingBag className="w-3.5 h-3.5 text-cyan" />;
      case "Stethoscope":
        return <Stethoscope className="w-3.5 h-3.5 text-emerald" />;
      case "Users":
        return <Users className="w-3.5 h-3.5 text-indigo" />;
      default:
        return <Building2 className="w-3.5 h-3.5 text-amber" />;
    }
  };

  return (
    <header className="h-16 border-b border-borderline bg-surface/90 backdrop-blur-md px-4 flex items-center justify-between shrink-0 sticky top-0 z-20">
      <div className="flex items-center gap-3">
        {!sidebarOpen && (
          <button
            onClick={onToggleSidebar}
            className="p-1.5 text-slate-400 hover:text-slate-100 hover:bg-card rounded-lg transition-colors border border-borderline/60"
            title="Expand Sidebar"
          >
            <PanelLeftOpen className="w-5 h-5 text-slate-200" />
          </button>
        )}

        <div className="flex items-center gap-2.5">
          <div className="flex items-center gap-2">
            <span className="font-bold text-sm text-slate-100 tracking-tight">
              {activeWorkspace.name}
            </span>
            <span className="px-2.5 py-0.5 rounded-full text-[10px] font-semibold bg-indigo-subtle text-indigo border border-indigo/40">
              {activeWorkspace.industry}
            </span>
          </div>
        </div>
      </div>

      {/* Center / Right controls */}
      <div className="flex items-center gap-2.5">
        {/* Grounded Sources Pill */}
        <div className="hidden sm:flex items-center gap-1.5 px-3 py-1 rounded-full bg-card border border-cardborder text-[11px] text-slate-200 shadow-highlight">
          <ShieldCheck className="w-3.5 h-3.5 text-emerald" />
          <span className="font-medium">Grounded in {activeWorkspace.totalChunks ?? 0} Sources</span>
        </div>

        {/* Quick Industry Switcher Dropdown */}
        <div className="relative group">
          <button className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-card hover:bg-cardhover border border-cardborder text-xs text-slate-200 transition-all shadow-highlight font-medium">
            {getIcon(activeWorkspace.icon)}
            <span className="hidden md:inline">Switch Workspace</span>
            <ChevronDown className="w-3.5 h-3.5 text-slate-400" />
          </button>

          <div className="absolute right-0 mt-1 w-64 rounded-xl bg-surface border border-cardborder shadow-2xl py-1.5 hidden group-hover:block hover:block z-50 animate-in fade-in">
            <div className="px-3 py-1 text-[10px] font-bold text-slate-400 uppercase tracking-wider">
              Select Workspace
            </div>
            {workspaces.map((ws) => (
              <button
                key={ws.id}
                onClick={() => onSelectWorkspace(ws.id)}
                className={`w-full text-left px-3 py-2 flex items-center justify-between text-xs hover:bg-cardhover transition-colors ${
                  ws.id === activeWorkspace.id
                    ? "text-cyan font-semibold bg-cyan/10"
                    : "text-slate-200 font-medium"
                }`}
              >
                <div className="flex items-center gap-2 truncate">
                  {getIcon(ws.icon)}
                  <span className="truncate">{ws.name}</span>
                </div>
                {ws.id === activeWorkspace.id && (
                  <span className="w-1.5 h-1.5 rounded-full bg-cyan shrink-0" />
                )}
              </button>
            ))}
          </div>
        </div>

        {/* Reset Current Chat */}
        <button
          onClick={onResetChat}
          className="p-1.5 text-slate-400 hover:text-slate-200 hover:bg-card rounded-lg transition-colors border border-borderline/60"
          title="Reset Conversation"
        >
          <RotateCcw className="w-4 h-4" />
        </button>
      </div>
    </header>
  );
};
