"use client";

import React, { useState } from "react";
import {
  X,
  Globe,
  UploadCloud,
  FileText,
  Loader2,
  CheckCircle2,
  AlertCircle
} from "lucide-react";
import { API_BASE_URL } from "@/lib/constants";

interface ConnectModalProps {
  isOpen: boolean;
  onClose: () => void;
  onWorkspaceCreated: (workspaceId: string, name: string, totalChunks: number) => void;
}

export const ConnectModal: React.FC<ConnectModalProps> = ({
  isOpen,
  onClose,
  onWorkspaceCreated
}) => {
  const [activeTab, setActiveTab] = useState<"url" | "file" | "text">("url");
  const [workspaceId, setWorkspaceId] = useState("");
  const [companyName, setCompanyName] = useState("");
  const [url, setUrl] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [faqText, setFaqText] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const targetWs = (workspaceId || "custom_client").trim().toLowerCase().replace(/[^a-z0-9_-]/g, "_");
    const name = companyName.trim() || targetWs;

    setError(null);
    setSuccess(null);
    setLoading(true);

    try {
      let res;
      if (activeTab === "file" && file) {
        const formData = new FormData();
        formData.append("workspace_id", targetWs);
        formData.append("file", file);
        res = await fetch(`${API_BASE_URL}/api/ingest`, {
          method: "POST",
          body: formData
        });
      } else if (activeTab === "url") {
        if (!url.trim()) throw new Error("Please enter a valid URL.");
        res = await fetch(`${API_BASE_URL}/api/ingest`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ workspace_id: targetWs, url: url.trim() })
        });
      } else {
        if (!faqText.trim()) throw new Error("Please enter document or FAQ text.");
        res = await fetch(`${API_BASE_URL}/api/ingest`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ workspace_id: targetWs, faq_text: faqText.trim() })
        });
      }

      if (!res.ok) {
        const errData = await res.json().catch(() => ({}));
        throw new Error(errData.detail || `Ingestion failed with status ${res.status}`);
      }

      const data = await res.json();
      setSuccess(`Indexed ${data.new_chunks_indexed || 0} chunks into workspace '${targetWs}'!`);
      setTimeout(() => {
        onWorkspaceCreated(targetWs, name, data.total_chunks || data.new_chunks_indexed || 0);
        onClose();
      }, 1000);
    } catch (err: any) {
      setError(err.message || "Failed to ingest source.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-canvas/80 backdrop-blur-sm animate-in fade-in">
      <div className="w-full max-w-lg bg-surface border border-borderline rounded-2xl shadow-2xl overflow-hidden flex flex-col">
        {/* Header */}
        <div className="px-6 py-4 border-b border-borderline flex items-center justify-between">
          <div>
            <h2 className="text-base font-semibold text-slate-100">
              Connect Website or Company Knowledge
            </h2>
            <p className="text-xs text-slate-400">
              Index custom URLs, policy PDFs, or CSV catalogs into an isolated workspace.
            </p>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-slate-200 hover:bg-card rounded-md transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Tab Selector */}
        <div className="flex border-b border-borderline bg-card/40 px-6 pt-2">
          <button
            type="button"
            onClick={() => setActiveTab("url")}
            className={`pb-2.5 px-3 text-xs font-medium border-b-2 flex items-center gap-1.5 transition-colors ${
              activeTab === "url"
                ? "border-cyan text-cyan"
                : "border-transparent text-slate-400 hover:text-slate-200"
            }`}
          >
            <Globe className="w-3.5 h-3.5" />
            <span>Web Page / URL</span>
          </button>
          <button
            type="button"
            onClick={() => setActiveTab("file")}
            className={`pb-2.5 px-3 text-xs font-medium border-b-2 flex items-center gap-1.5 transition-colors ${
              activeTab === "file"
                ? "border-cyan text-cyan"
                : "border-transparent text-slate-400 hover:text-slate-200"
            }`}
          >
            <UploadCloud className="w-3.5 h-3.5" />
            <span>Document Upload</span>
          </button>
          <button
            type="button"
            onClick={() => setActiveTab("text")}
            className={`pb-2.5 px-3 text-xs font-medium border-b-2 flex items-center gap-1.5 transition-colors ${
              activeTab === "text"
                ? "border-cyan text-cyan"
                : "border-transparent text-slate-400 hover:text-slate-200"
            }`}
          >
            <FileText className="w-3.5 h-3.5" />
            <span>Direct Text / FAQ</span>
          </button>
        </div>

        {/* Form Body */}
        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-[11px] font-semibold text-slate-300 uppercase tracking-wider mb-1">
                Workspace ID
              </label>
              <input
                type="text"
                placeholder="e.g. acme_corp"
                value={workspaceId}
                onChange={(e) => setWorkspaceId(e.target.value)}
                required
                className="w-full px-3 py-2 rounded-lg bg-card border border-borderline text-xs text-slate-100 placeholder-slate-500 focus:outline-none focus:border-cyan"
              />
            </div>
            <div>
              <label className="block text-[11px] font-semibold text-slate-300 uppercase tracking-wider mb-1">
                Display Name
              </label>
              <input
                type="text"
                placeholder="e.g. Acme Corp Support"
                value={companyName}
                onChange={(e) => setCompanyName(e.target.value)}
                className="w-full px-3 py-2 rounded-lg bg-card border border-borderline text-xs text-slate-100 placeholder-slate-500 focus:outline-none focus:border-cyan"
              />
            </div>
          </div>

          {/* Tab 1: URL */}
          {activeTab === "url" && (
            <div>
              <label className="block text-[11px] font-semibold text-slate-300 uppercase tracking-wider mb-1">
                Website or Documentation URL
              </label>
              <input
                type="url"
                placeholder="https://example.com/refund-policy"
                value={url}
                onChange={(e) => setUrl(e.target.value)}
                required={activeTab === "url"}
                className="w-full px-3 py-2 rounded-lg bg-card border border-borderline text-xs text-slate-100 placeholder-slate-500 focus:outline-none focus:border-cyan"
              />
              <p className="mt-1 text-[11px] text-slate-500">
                NexusDesk scrapes main text content cleanly, stripping navbars, scripts, and footers.
              </p>
            </div>
          )}

          {/* Tab 2: File Upload */}
          {activeTab === "file" && (
            <div>
              <label className="block text-[11px] font-semibold text-slate-300 uppercase tracking-wider mb-1">
                Upload File (.pdf, .csv, .md, .txt)
              </label>
              <div className="border-2 border-dashed border-borderline hover:border-cyan/50 rounded-xl p-4 text-center bg-card/40 cursor-pointer relative">
                <input
                  type="file"
                  accept=".pdf,.csv,.md,.txt"
                  onChange={(e) => setFile(e.target.files?.[0] || null)}
                  required={activeTab === "file"}
                  className="absolute inset-0 opacity-0 cursor-pointer"
                />
                <UploadCloud className="w-8 h-8 text-cyan mx-auto mb-2" />
                <div className="text-xs text-slate-200 font-medium">
                  {file ? file.name : "Click to select or drag and drop"}
                </div>
                <div className="text-[11px] text-slate-500 mt-1">
                  PDF policies, CSV product catalogs, Markdown docs
                </div>
              </div>
            </div>
          )}

          {/* Tab 3: Text */}
          {activeTab === "text" && (
            <div>
              <label className="block text-[11px] font-semibold text-slate-300 uppercase tracking-wider mb-1">
                Paste Knowledge or FAQs
              </label>
              <textarea
                rows={5}
                placeholder="## Return Policy&#10;Customers can return items within 30 days..."
                value={faqText}
                onChange={(e) => setFaqText(e.target.value)}
                required={activeTab === "text"}
                className="w-full px-3 py-2 rounded-lg bg-card border border-borderline text-xs text-slate-100 placeholder-slate-500 focus:outline-none focus:border-cyan font-mono"
              />
            </div>
          )}

          {error && (
            <div className="p-3 rounded-lg bg-amber-subtle border border-amber/30 text-amber text-xs flex items-center gap-2">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          {success && (
            <div className="p-3 rounded-lg bg-emerald-subtle border border-emerald/30 text-emerald text-xs flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 shrink-0" />
              <span>{success}</span>
            </div>
          )}

          {/* Actions */}
          <div className="pt-2 flex items-center justify-end gap-2.5">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-lg bg-card hover:bg-borderline text-xs font-medium text-slate-300 transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading}
              className="px-4 py-2 rounded-lg bg-cyan hover:bg-cyan/90 text-slate-950 text-xs font-semibold flex items-center gap-2 transition-all disabled:opacity-50"
            >
              {loading ? (
                <>
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  <span>Indexing Chunks...</span>
                </>
              ) : (
                <span>Ingest & Connect</span>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
