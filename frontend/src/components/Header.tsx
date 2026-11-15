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
    <header className="h-16 border-b border-borderline bg-surface/80 backdrop-blur-md px-4 flex items-center justify-between shrink-0 sticky top-0 z-20">
      <div className="flex items-center gap-3">
        {!sidebarOpen && (
          <button
            onClick={onToggleSidebar}
            className="p-1.5 text-slate-400 hover:text-slate-200 hover:bg-card rounded-md transition-colors"
            title="Expand Sidebar"
          >
            <PanelLeftOpen className="w-5 h-5 text-slate-300" />
          </button>
        )}

        <div className="flex items-center gap-2.5">
          <div className="flex items-center gap-2">
            <span className="font-semibold text-sm text-slate-100">
              {activeWorkspace.name}
            </span>
            <span className="px-2 py-0.5 rounded text-[10px] font-medium bg-indigo-subtle text-indigo border border-indigo/30">
              {activeWorkspace.industry}
            </span>
          </div>
        </div>
      </div>

      {/* Center / Right controls */}
      <div className="flex items-center gap-2.5">
        {/* Grounded Sources Pill */}
        <div className="hidden sm:flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-card border border-borderline text-[11px] text-slate-300 shadow-sm">
          <ShieldCheck className="w-3.5 h-3.5 text-emerald" />
          <span>Grounded in {activeWorkspace.totalChunks ?? 0} Sources</span>
        </div>

        {/* Quick Industry Switcher Dropdown */}
        <div className="relative group">
          <button className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-card hover:bg-borderline border border-borderline text-xs text-slate-200 transition-colors">
            {getIcon(activeWorkspace.icon)}
            <span className="hidden md:inline font-medium">Switch Workspace</span>
            <ChevronDown className="w-3.5 h-3.5 text-slate-400" />
          </button>

          <div className="absolute right-0 mt-1 w-56 rounded-lg bg-card border border-borderline shadow-xl py-1 hidden group-hover:block hover:block z-50">
            <div className="px-3 py-1 text-[10px] font-bold text-slate-500 uppercase tracking-wider">
              Select Workspace
            </div>
            {workspaces.map((ws) => (
              <button
                key={ws.id}
                onClick={() => onSelectWorkspace(ws.id)}
                className={`w-full text-left px-3 py-1.5 flex items-center justify-between text-xs hover:bg-borderline transition-colors ${
                  ws.id === activeWorkspace.id
                    ? "text-cyan font-medium bg-cyan/5"
                    : "text-slate-300"
                }`}
              >
                <div className="flex items-center gap-2">
                  {getIcon(ws.icon)}
                  <span>{ws.name}</span>
                </div>
                {ws.id === activeWorkspace.id && (
                  <span className="w-1.5 h-1.5 rounded-full bg-cyan" />
                )}
              </button>
            ))}
          </div>
        </div>

        {/* Reset Current Chat */}
        <button
          onClick={onResetChat}
          className="p-1.5 text-slate-400 hover:text-slate-200 hover:bg-card rounded-md transition-colors"
          title="Reset Conversation"
        >
          <RotateCcw className="w-4 h-4" />
        </button>
      </div>
    </header>
  );
};
