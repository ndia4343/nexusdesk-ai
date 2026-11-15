"use client";

import React, { useState } from "react";
import { X, Cookie, ShieldCheck, Check } from "lucide-react";

interface CookieModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const CookieModal: React.FC<CookieModalProps> = ({ isOpen, onClose }) => {
  const [analytics, setAnalytics] = useState(false);
  const [memory, setMemory] = useState(true);
  const [saved, setSaved] = useState(false);

  if (!isOpen) return null;

  const handleSave = () => {
    setSaved(true);
    setTimeout(() => {
      onClose();
      setSaved(false);
    }, 600);
  };

  const handleAcceptAll = () => {
    setAnalytics(true);
    setMemory(true);
    setSaved(true);
    setTimeout(() => {
      onClose();
      setSaved(false);
    }, 600);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-canvas/80 backdrop-blur-md animate-in fade-in">
      <div className="w-full max-w-lg bg-surface border border-cardborder rounded-2xl shadow-2xl overflow-hidden flex flex-col shadow-highlight">
        {/* Header */}
        <div className="px-6 py-4 border-b border-borderline flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <Cookie className="w-5 h-5 text-amber" />
            <h2 className="text-base font-bold text-slate-900 dark:text-slate-100">
              EU GDPR Cookie & Privacy Preferences
            </h2>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-slate-200 hover:bg-card rounded-md transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Body */}
        <div className="p-6 space-y-4 text-xs">
          <p className="text-slate-700 dark:text-slate-300 leading-relaxed font-medium">
            NexusDesk AI respects your privacy and adheres to the EU General Data Protection Regulation (GDPR) and ePrivacy Directive. We never track cross-site activity or sell personal data.
          </p>

          <div className="space-y-3 pt-1">
            {/* Essential Cookies */}
            <div className="p-3.5 rounded-xl bg-card border border-cardborder flex items-start justify-between gap-3 shadow-sm">
              <div>
                <div className="flex items-center gap-2">
                  <span className="font-bold text-slate-900 dark:text-slate-100">Strictly Necessary Cookies</span>
                  <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-emerald-subtle text-emerald border border-emerald/30">
                    Always Active
                  </span>
                </div>
                <p className="text-[11px] text-slate-600 dark:text-slate-400 mt-1 leading-normal font-medium">
                  Required for multi-workspace routing, authentication tokens, and CSRF protection.
                </p>
              </div>
              <div className="w-9 h-5 bg-emerald/30 rounded-full flex items-center p-0.5 cursor-not-allowed">
                <div className="w-4 h-4 bg-emerald rounded-full translate-x-4 transition-transform" />
              </div>
            </div>

            {/* Conversational Memory */}
            <div className="p-3.5 rounded-xl bg-card border border-cardborder flex items-start justify-between gap-3 shadow-sm">
              <div>
                <div className="flex items-center gap-2">
                  <span className="font-bold text-slate-900 dark:text-slate-100">Stateful Session Memory</span>
                  <span className="text-[10px] font-semibold text-slate-600 dark:text-slate-400">Functional</span>
                </div>
                <p className="text-[11px] text-slate-600 dark:text-slate-400 mt-1 leading-normal font-medium">
                  Maintains context across follow-up queries within an active customer support session.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setMemory(!memory)}
                className={`w-9 h-5 rounded-full flex items-center p-0.5 transition-colors ${
                  memory ? "bg-sky-200 dark:bg-cyan/30" : "bg-borderline"
                }`}
              >
                <div
                  className={`w-4 h-4 rounded-full transition-transform ${
                    memory ? "bg-sky-600 dark:bg-cyan translate-x-4" : "bg-slate-400 translate-x-0"
                  }`}
                />
              </button>
            </div>

            {/* Performance & Analytics */}
            <div className="p-3.5 rounded-xl bg-card border border-cardborder flex items-start justify-between gap-3 shadow-sm">
              <div>
                <div className="flex items-center gap-2">
                  <span className="font-bold text-slate-900 dark:text-slate-100">Anonymous Aggregated Analytics</span>
                  <span className="text-[10px] font-semibold text-slate-600 dark:text-slate-400">Performance</span>
                </div>
                <p className="text-[11px] text-slate-600 dark:text-slate-400 mt-1 leading-normal font-medium">
                  Measures retrieval latency and LangGraph node execution times to optimize engine performance.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setAnalytics(!analytics)}
                className={`w-9 h-5 rounded-full flex items-center p-0.5 transition-colors ${
                  analytics ? "bg-sky-200 dark:bg-cyan/30" : "bg-borderline"
                }`}
              >
                <div
                  className={`w-4 h-4 rounded-full transition-transform ${
                    analytics ? "bg-sky-600 dark:bg-cyan translate-x-4" : "bg-slate-400 translate-x-0"
                  }`}
                />
              </button>
            </div>
          </div>

          {/* Actions */}
          <div className="pt-3 border-t border-borderline flex items-center justify-end gap-2.5">
            <button
              type="button"
              onClick={handleSave}
              className="px-4 py-2 rounded-xl bg-card hover:bg-cardhover border border-cardborder text-xs font-bold text-slate-800 dark:text-slate-300 hover:text-slate-950 dark:hover:text-white transition-colors shadow-sm"
            >
              Save Preferences
            </button>
            <button
              type="button"
              onClick={handleAcceptAll}
              className="px-4 py-2 rounded-xl bg-sky-600 dark:bg-cyan hover:bg-sky-700 dark:hover:bg-cyan/90 text-white dark:text-slate-950 text-xs font-bold transition-all shadow-md"
            >
              Accept All Cookies
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
