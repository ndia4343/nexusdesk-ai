"use client";

import React, { useState, useRef, useEffect } from "react";
import Link from "next/link";
import { ArrowUp, Plus, Loader2 } from "lucide-react";

interface ComposerProps {
  onSendMessage: (query: string) => void;
  isLoading: boolean;
  onOpenConnectModal: () => void;
  workspaceName: string;
  onOpenPricing: () => void;
  onOpenCookies: () => void;
}

export const Composer: React.FC<ComposerProps> = ({
  onSendMessage,
  isLoading,
  onOpenConnectModal,
  workspaceName,
  onOpenPricing,
  onOpenCookies
}) => {
  const [input, setInput] = useState("");
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // Auto-resize textarea based on content
  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = "auto";
      textareaRef.current.style.height = `${Math.min(textareaRef.current.scrollHeight, 180)}px`;
    }
  }, [input]);

  const handleSubmit = (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!input.trim() || isLoading) return;
    onSendMessage(input.trim());
    setInput("");
    if (textareaRef.current) {
      textareaRef.current.style.height = "auto";
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSubmit();
    }
  };

  return (
    <div className="fixed bottom-0 inset-x-0 bg-gradient-to-t from-canvas via-canvas/95 to-transparent pt-6 pb-3 px-4 pointer-events-none z-20">
      <div className="max-w-3xl mx-auto w-full pointer-events-auto">
        <form
          onSubmit={handleSubmit}
          className="relative bg-card rounded-2xl border border-cardborder focus-within:border-cyan/60 focus-within:ring-2 focus-within:ring-cyan/20 transition-all shadow-highlight shadow-2xl flex flex-col p-2.5"
        >
          <div className="flex items-end gap-2">
            {/* Inline Attachment / Connect Button */}
            <button
              type="button"
              onClick={onOpenConnectModal}
              className="p-2 text-slate-300 hover:text-cyan hover:bg-cardhover rounded-xl transition-colors mb-0.5 shrink-0"
              title="Add company URL or document"
            >
              <Plus className="w-5 h-5" />
            </button>

            {/* Expanding Textarea */}
            <textarea
              ref={textareaRef}
              rows={1}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder={`Ask ${workspaceName}... (e.g. policies, catalog search, specs)`}
              disabled={isLoading}
              className="flex-1 bg-transparent border-0 resize-none text-sm text-slate-100 placeholder-slate-400 focus:outline-none focus:ring-0 py-2.5 max-h-44 leading-relaxed font-sans font-normal"
            />

            {/* Fast Send Button */}
            <button
              type="submit"
              disabled={!input.trim() || isLoading}
              className="w-9 h-9 rounded-xl bg-cyan hover:bg-cyan/90 text-slate-950 flex items-center justify-center shrink-0 mb-0.5 transition-all disabled:opacity-30 disabled:hover:bg-cyan shadow-md shadow-cyan/20 font-bold"
              title="Send message"
            >
              {isLoading ? (
                <Loader2 className="w-4 h-4 animate-spin text-slate-950" />
              ) : (
                <ArrowUp className="w-4 h-4 stroke-[2.5]" />
              )}
            </button>
          </div>
        </form>

        {/* Compact B2B Footer */}
        <div className="mt-2.5 flex flex-col sm:flex-row items-center justify-between gap-1 text-[11px] text-slate-400 font-medium px-1">
          <div>
            NexusDesk AI synthesizes verified catalog & policy data. Multi-workspace isolation active.
          </div>
          <div className="flex items-center gap-2.5 text-[11px] text-slate-400">
            <button
              type="button"
              onClick={onOpenPricing}
              className="hover:text-cyan transition-colors"
            >
              Pricing
            </button>
            <span className="text-slate-600">•</span>
            <Link href="/privacy" className="hover:text-cyan transition-colors">
              Privacy Policy
            </Link>
            <span className="text-slate-600">•</span>
            <Link href="/terms" className="hover:text-cyan transition-colors">
              Terms
            </Link>
            <span className="text-slate-600">•</span>
            <button
              type="button"
              onClick={onOpenCookies}
              className="hover:text-cyan transition-colors"
            >
              Cookie Settings
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
