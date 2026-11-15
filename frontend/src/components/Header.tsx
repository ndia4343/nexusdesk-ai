"use client";

import React, { useState, useRef, useEffect } from "react";
import {
  PanelLeftOpen,
  ShieldCheck,
  ChevronDown,
  RotateCcw,
  Sun,
  Moon,
  LogIn,
  LogOut,
  ShoppingBag,
  Stethoscope,
  Users,
  Building2,
  UserCheck,
  Shield
} from "lucide-react";
import { Workspace, AuthUser } from "@/types";

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
  currentUser: AuthUser | null;
  onSignOut: () => void;
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
  onOpenSignIn,
  currentUser,
  onSignOut
}) => {
  const [userMenuOpen, setUserMenuOpen] = useState(false);
  const userMenuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (userMenuRef.current && !userMenuRef.current.contains(event.target as Node)) {
        setUserMenuOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

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

  const getUserInitials = (name: string) => {
    if (!name) return "U";
    const parts = name.trim().split(" ");
    if (parts.length >= 2) {
      return (parts[0][0] + parts[1][0]).toUpperCase();
    }
    return name.slice(0, 2).toUpperCase();
  };

  return (
    <header className="h-16 border-b border-borderline bg-surface/95 backdrop-blur-md px-4 flex items-center justify-between shrink-0 sticky top-0 z-20">
      {/* Left Column: Sidebar trigger + Single Workspace Title & Category Badge */}
      <div className="flex items-center gap-3">
        {!sidebarOpen && (
          <div className="flex items-center gap-1.5">
            <button
              onClick={onToggleSidebar}
              className="p-1.5 text-slate-600 hover:text-slate-900 dark:text-slate-400 dark:hover:text-slate-100 hover:bg-card rounded-lg transition-colors border border-borderline"
              title="Expand Sidebar"
            >
              <PanelLeftOpen className="w-5 h-5" />
            </button>

            {/* Compact Workspace Switcher Dropdown ONLY when sidebar is collapsed */}
            <div className="relative group">
              <button
                className="p-1.5 rounded-lg bg-card hover:bg-cardhover border border-cardborder text-slate-800 dark:text-slate-200 transition-all shadow-sm flex items-center gap-1"
                title="Quick Switch Workspace"
              >
                {getIcon(activeWorkspace.icon)}
                <ChevronDown className="w-3 h-3 text-slate-500 dark:text-slate-400" />
              </button>

              <div className="absolute left-0 mt-1 w-60 rounded-xl bg-surface border border-cardborder shadow-2xl py-1.5 hidden group-hover:block hover:block z-50 animate-in fade-in">
                <div className="px-3 py-1 text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                  Select Workspace
                </div>
                {workspaces.map((ws) => (
                  <button
                    key={ws.id}
                    onClick={() => onSelectWorkspace(ws.id)}
                    className={`w-full text-left px-3 py-2 flex items-center justify-between text-xs hover:bg-cardhover transition-colors ${
                      ws.id === activeWorkspace.id
                        ? "text-sky-600 dark:text-cyan font-bold bg-sky-50 dark:bg-cyan/10"
                        : "text-slate-800 dark:text-slate-200 font-medium"
                    }`}
                  >
                    <div className="flex items-center gap-2 truncate">
                      {getIcon(ws.icon)}
                      <span className="truncate">{ws.name}</span>
                    </div>
                    {ws.id === activeWorkspace.id && (
                      <span className="w-1.5 h-1.5 rounded-full bg-sky-600 dark:bg-cyan shrink-0" />
                    )}
                  </button>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* Active Workspace Title & Category shown ONCE */}
        <div className="flex items-center gap-2.5">
          <span className="font-bold text-sm text-slate-900 dark:text-slate-100 tracking-tight">
            {activeWorkspace.name}
          </span>
          <span className="px-2.5 py-0.5 rounded-full text-[10px] font-semibold bg-indigo-subtle text-indigo border border-indigo/40">
            {getIndustryCategory(activeWorkspace.id)}
          </span>
        </div>
      </div>

      {/* Right Column: Grounded Sources Pill, Light/Dark Toggle, Sign In / User Profile & Reset */}
      <div className="flex items-center gap-2.5">
        {/* Verified Sources Pill (Hydration Safe) */}
        {activeWorkspace.totalChunks === null || activeWorkspace.totalChunks === undefined ? (
          <div className="hidden sm:flex items-center gap-1.5 px-3 py-1 rounded-full bg-card border border-cardborder text-[11px] text-slate-600 dark:text-slate-300 shadow-sm animate-pulse">
            <span className="w-2 h-2 rounded-full bg-sky-500 dark:bg-cyan animate-ping" />
            <span className="font-medium">Syncing Sources...</span>
          </div>
        ) : (
          <div className="hidden sm:flex items-center gap-1.5 px-3 py-1 rounded-full bg-card border border-cardborder text-[11px] text-slate-700 dark:text-slate-200 shadow-sm">
            <ShieldCheck className="w-3.5 h-3.5 text-emerald" />
            <span className="font-medium">{activeWorkspace.totalChunks} Verified Sources</span>
          </div>
        )}

        {/* Light / Dark Mode Toggle */}
        <button
          onClick={onToggleTheme}
          className="p-1.5 text-slate-700 hover:text-slate-900 dark:text-slate-300 dark:hover:text-slate-100 hover:bg-card rounded-lg transition-colors border border-borderline shadow-sm"
          title={theme === "dark" ? "Switch to Light Mode" : "Switch to Dark Mode"}
        >
          {theme === "dark" ? (
            <Sun className="w-4 h-4 text-amber" />
          ) : (
            <Moon className="w-4 h-4 text-slate-700" />
          )}
        </button>

        {/* Signed In User Pill OR Sign In Button */}
        {currentUser ? (
          <div className="relative" ref={userMenuRef}>
            <button
              onClick={() => setUserMenuOpen(!userMenuOpen)}
              className="flex items-center gap-2 pl-2 pr-2.5 py-1 rounded-xl bg-card hover:bg-cardhover border border-cardborder transition-all shadow-sm"
            >
              <div className="w-6 h-6 rounded-full bg-gradient-to-tr from-cyan to-indigo text-slate-950 font-extrabold text-[10px] flex items-center justify-center">
                {getUserInitials(currentUser.name)}
              </div>
              <div className="flex flex-col text-left">
                <span className="text-xs font-bold text-slate-900 dark:text-slate-100 leading-tight max-w-[100px] truncate">
                  {currentUser.name}
                </span>
                <span className="text-[10px] font-semibold text-sky-600 dark:text-cyan leading-tight">
                  {currentUser.role}
                </span>
              </div>
              <ChevronDown className="w-3 h-3 text-slate-500 dark:text-slate-400" />
            </button>

            {/* Dropdown Menu */}
            {userMenuOpen && (
              <div className="absolute right-0 mt-2 w-64 rounded-xl bg-surface border border-cardborder shadow-2xl py-2 z-50 animate-in fade-in">
                <div className="px-3 py-2 border-b border-borderline">
                  <div className="text-xs font-bold text-slate-900 dark:text-slate-100">
                    {currentUser.name}
                  </div>
                  <div className="text-[11px] text-slate-600 dark:text-slate-400 truncate">
                    {currentUser.email}
                  </div>
                  <div className="mt-1 flex items-center gap-1.5">
                    <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-cyan/10 text-sky-700 dark:text-cyan border border-cyan/20">
                      {currentUser.role}
                    </span>
                    <span className="text-[10px] text-slate-500 capitalize">
                      via {currentUser.provider}
                    </span>
                  </div>
                </div>

                <div className="py-1">
                  <div className="px-3 py-1.5 flex items-center justify-between text-xs text-slate-700 dark:text-slate-300">
                    <span className="flex items-center gap-2">
                      <Shield className="w-3.5 h-3.5 text-indigo" />
                      Workspace RBAC
                    </span>
                    <span className="text-[10px] font-semibold text-emerald bg-emerald/10 px-1.5 py-0.5 rounded">
                      Enforced
                    </span>
                  </div>
                </div>

                <div className="pt-1 border-t border-borderline">
                  <button
                    onClick={() => {
                      setUserMenuOpen(false);
                      onSignOut();
                    }}
                    className="w-full text-left px-3 py-1.5 text-xs text-rose-600 dark:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-500/10 flex items-center gap-2 transition-colors font-medium"
                  >
                    <LogOut className="w-3.5 h-3.5" />
                    <span>Sign Out</span>
                  </button>
                </div>
              </div>
            )}
          </div>
        ) : (
          <button
            onClick={onOpenSignIn}
            className="hidden sm:flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-card hover:bg-cardhover border border-cardborder text-xs text-slate-800 dark:text-slate-200 hover:text-slate-950 dark:hover:text-white transition-all shadow-sm font-semibold"
          >
            <LogIn className="w-3.5 h-3.5 text-sky-600 dark:text-cyan" />
            <span>Sign In</span>
          </button>
        )}

        {/* Reset Current Chat */}
        <button
          onClick={onResetChat}
          className="p-1.5 text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-slate-100 hover:bg-card rounded-lg transition-colors border border-borderline shadow-sm"
          title="Reset Conversation"
        >
          <RotateCcw className="w-4 h-4" />
        </button>
      </div>
    </header>
  );
};
