"use client";

import React from "react";
import {
  PanelLeftOpen,
  ShieldCheck,
  ChevronDown,
  RotateCcw,
  Sun,
  Moon,
  LogIn,
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
  theme: "dark" | "light";
  onToggleTheme: () => void;
  onOpenSignIn: () => void;
}

export const Header: React.FC<HeaderProps> = ({
  sidebarOpen,
  onToggleSidebar,
  activeWorkspace,
  workspaces,
  onSelectWorkspace,
  onResetChat,
  apiHealthy,
  theme,
  onToggleTheme,
  onOpenSignIn
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

  const getIndustryCategory = (id: string) => {
    switch (id) {
      case "retail_ops":
        return "Retail & Catalog";
      case "clinic_ops":
        return "Healthcare & Clinical";
      case "hr_ops":
        return "People & Operations";
      default:
        return "Custom Client";
    }
  };

  return (
    <header className="h-16 border-b border-borderline bg-surface/90 backdrop-blur-md px-4 flex items-center justify-between shrink-0 sticky top-0 z-20">
      {/* Left Column: Sidebar trigger + Single Workspace Title & Category Badge */}
      <div className="flex items-center gap-3">
        {!sidebarOpen && (
          <div className="flex items-center gap-1.5">
            <button
              onClick={onToggleSidebar}
              className="p-1.5 text-slate-400 hover:text-slate-100 hover:bg-card rounded-lg transition-colors border border-borderline/60"
              title="Expand Sidebar"
            >
              <PanelLeftOpen className="w-5 h-5 text-slate-200" />
            </button>

            {/* Compact Workspace Switcher Dropdown ONLY when sidebar is collapsed */}
            <div className="relative group">
              <button
                className="p-1.5 rounded-lg bg-card hover:bg-cardhover border border-cardborder text-slate-200 transition-all shadow-highlight flex items-center gap-1"
                title="Quick Switch Workspace"
              >
                {getIcon(activeWorkspace.icon)}
                <ChevronDown className="w-3 h-3 text-slate-400" />
              </button>

              <div className="absolute left-0 mt-1 w-60 rounded-xl bg-surface border border-cardborder shadow-2xl py-1.5 hidden group-hover:block hover:block z-50 animate-in fade-in">
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
          </div>
        )}

        {/* Active Workspace Title & Category shown ONCE */}
        <div className="flex items-center gap-2.5">
          <span className="font-bold text-sm text-slate-100 tracking-tight">
            {activeWorkspace.name}
          </span>
          <span className="px-2.5 py-0.5 rounded-full text-[10px] font-semibold bg-indigo-subtle text-indigo border border-indigo/40">
            {getIndustryCategory(activeWorkspace.id)}
          </span>
        </div>
      </div>

      {/* Right Column: Grounded Sources Pill, Light/Dark Toggle, Sign In & Reset */}
      <div className="flex items-center gap-2.5">
        {/* Verified Sources Pill (Hydration Safe) */}
        {activeWorkspace.totalChunks === null || activeWorkspace.totalChunks === undefined ? (
          <div className="hidden sm:flex items-center gap-1.5 px-3 py-1 rounded-full bg-card border border-cardborder text-[11px] text-slate-300 shadow-highlight animate-pulse">
            <span className="w-2 h-2 rounded-full bg-cyan animate-ping" />
            <span className="font-medium">Syncing Sources...</span>
          </div>
        ) : (
          <div className="hidden sm:flex items-center gap-1.5 px-3 py-1 rounded-full bg-card border border-cardborder text-[11px] text-slate-200 shadow-highlight">
            <ShieldCheck className="w-3.5 h-3.5 text-emerald" />
            <span className="font-medium">{activeWorkspace.totalChunks} Verified Sources</span>
          </div>
        )}

        {/* Light / Dark Mode Toggle */}
        <button
          onClick={onToggleTheme}
          className="p-1.5 text-slate-300 hover:text-slate-100 hover:bg-card rounded-lg transition-colors border border-borderline/60 shadow-highlight"
          title={theme === "dark" ? "Switch to Light Mode" : "Switch to Dark Mode"}
        >
          {theme === "dark" ? (
            <Sun className="w-4 h-4 text-amber" />
          ) : (
            <Moon className="w-4 h-4 text-slate-700" />
          )}
        </button>

        {/* Team Sign In Button */}
        <button
          onClick={onOpenSignIn}
          className="hidden sm:flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-card hover:bg-cardhover border border-cardborder text-xs text-slate-200 hover:text-white transition-all shadow-highlight font-semibold"
        >
          <LogIn className="w-3.5 h-3.5 text-cyan" />
          <span>Sign In</span>
        </button>

        {/* Reset Current Chat */}
        <button
          onClick={onResetChat}
          className="p-1.5 text-slate-400 hover:text-slate-100 hover:bg-card rounded-lg transition-colors border border-borderline/60"
          title="Reset Conversation"
        >
          <RotateCcw className="w-4 h-4" />
        </button>
      </div>
    </header>
  );
};
