"use client";

import React, { useState, useEffect } from "react";
import { Sidebar } from "@/components/Sidebar";
import { Header } from "@/components/Header";
import { ChatCanvas } from "@/components/ChatCanvas";
import { Composer } from "@/components/Composer";
import { ArtifactDrawer } from "@/components/ArtifactDrawer";
import { ConnectModal } from "@/components/ConnectModal";
import { SignInModal } from "@/components/SignInModal";
import { PricingModal } from "@/components/PricingModal";
import { CookieModal } from "@/components/CookieModal";
import { DEFAULT_WORKSPACES, API_BASE_URL } from "@/lib/constants";
import { Workspace, ChatMessage, DrawerContent } from "@/types";

export default function Home() {
  const [workspaces, setWorkspaces] = useState<Workspace[]>(DEFAULT_WORKSPACES);
  const [activeWorkspaceId, setActiveWorkspaceId] = useState<string>("retail_ops");
  const [sidebarOpen, setSidebarOpen] = useState<boolean>(true);
  const [drawerContent, setDrawerContent] = useState<DrawerContent>(null);
  const [connectModalOpen, setConnectModalOpen] = useState<boolean>(false);
  const [signInModalOpen, setSignInModalOpen] = useState<boolean>(false);
  const [pricingModalOpen, setPricingModalOpen] = useState<boolean>(false);
  const [cookieModalOpen, setCookieModalOpen] = useState<boolean>(false);
  const [theme, setTheme] = useState<"dark" | "light">("dark");
  const [recentSessions, setRecentSessions] = useState<string[]>([]);
  const [activeSessionId, setActiveSessionId] = useState<string>(() => `sess_${Date.now().toString(36)}`);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [apiHealthy, setApiHealthy] = useState<boolean | null>(null);

  // Active workspace object
  const activeWorkspace =
    workspaces.find((w) => w.id === activeWorkspaceId) || workspaces[0];

  // Initialize theme from localStorage or default to dark
  useEffect(() => {
    const savedTheme = (localStorage.getItem("nexusdesk_theme") as "dark" | "light") || "dark";
    setTheme(savedTheme);
    if (savedTheme === "light") {
      document.documentElement.classList.remove("dark");
      document.documentElement.classList.add("light");
    } else {
      document.documentElement.classList.remove("light");
      document.documentElement.classList.add("dark");
    }
  }, []);

  const handleToggleTheme = () => {
    const nextTheme = theme === "dark" ? "light" : "dark";
    setTheme(nextTheme);
    localStorage.setItem("nexusdesk_theme", nextTheme);
    if (nextTheme === "light") {
      document.documentElement.classList.remove("dark");
      document.documentElement.classList.add("light");
    } else {
      document.documentElement.classList.remove("light");
      document.documentElement.classList.add("dark");
    }
  };

  // Probe API health on mount
  useEffect(() => {
    const checkHealth = async () => {
      try {
        const res = await fetch(`${API_BASE_URL}/api/health`, {
          method: "GET",
          headers: { "Content-Type": "application/json" }
        });
        if (res.ok) {
          setApiHealthy(true);
        } else {
          setApiHealthy(false);
        }
      } catch (e) {
        setApiHealthy(false);
      }
    };
    checkHealth();
    const interval = setInterval(checkHealth, 30000);
    return () => clearInterval(interval);
  }, []);

  // Fetch verified knowledge metadata for all workspaces to hydrate counters accurately
  useEffect(() => {
    const fetchAllKnowledge = async () => {
      for (const ws of workspaces) {
        try {
          const res = await fetch(`${API_BASE_URL}/api/knowledge?workspace_id=${ws.id}`);
          if (res.ok) {
            const data = await res.json();
            setWorkspaces((prev) =>
              prev.map((w) =>
                w.id === ws.id
                  ? { ...w, totalChunks: data.total_chunks, hasCatalog: data.has_catalog }
                  : w
              )
            );
          }
        } catch (e) {
          // Keep null if unreached
        }
      }
    };
    fetchAllKnowledge();
  }, [workspaces.length, activeWorkspaceId]);

  // Handle sending a message
  const handleSendMessage = async (queryText: string) => {
    if (!queryText.trim() || isLoading) return;

    const userMsg: ChatMessage = {
      id: `usr_${Date.now()}`,
      role: "user",
      content: queryText.trim(),
      timestamp: new Date().toISOString(),
      workspaceId: activeWorkspaceId
    };

    setMessages((prev) => [...prev, userMsg]);
    setIsLoading(true);

    // Track active session in recent list
    setRecentSessions((prev) => {
      if (!prev.includes(activeSessionId)) {
        return [activeSessionId, ...prev.slice(0, 7)];
      }
      return prev;
    });

    try {
      const res = await fetch(`${API_BASE_URL}/api/chat`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          query: queryText.trim(),
          session_id: activeSessionId,
          workspace_id: activeWorkspaceId
        })
      });

      if (!res.ok) {
        throw new Error(`API responded with status ${res.status}`);
      }

      const data = await res.json();
      const assistantMsg: ChatMessage = {
        id: `ast_${Date.now()}`,
        role: "assistant",
        content: data.answer || "No response provided.",
        timestamp: new Date().toISOString(),
        executionTrace: data.execution_trace || [],
        products: data.products || [],
        sources: data.sources || [],
        confidenceScore: data.confidence_score,
        escalation: data.escalation,
        workspaceId: activeWorkspaceId
      };

      setMessages((prev) => [...prev, assistantMsg]);
    } catch (err: any) {
      const errorMsg: ChatMessage = {
        id: `ast_err_${Date.now()}`,
        role: "assistant",
        content: `Error connecting to NexusDesk agent (${err.message}). Please verify the backend service is running.`,
        timestamp: new Date().toISOString(),
        workspaceId: activeWorkspaceId
      };
      setMessages((prev) => [...prev, errorMsg]);
    } finally {
      setIsLoading(false);
    }
  };

  // Switch workspace
  const handleSelectWorkspace = (id: string) => {
    setActiveWorkspaceId(id);
    setMessages([]);
    setDrawerContent(null);
    setActiveSessionId(`sess_${Date.now().toString(36)}`);
  };

  // Start new conversation session
  const handleNewSession = () => {
    setActiveSessionId(`sess_${Date.now().toString(36)}`);
    setMessages([]);
    setDrawerContent(null);
  };

  // Custom workspace created callback
  const handleWorkspaceCreated = (id: string, name: string, totalChunks: number) => {
    const newWs: Workspace = {
      id,
      name,
      industry: "Custom Client",
      icon: "Building2",
      description: `Custom knowledge base with ${totalChunks} indexed chunks.`,
      seedPrompts: [
        "What are the main policies and procedures outlined?",
        "Can you summarize the indexed documentation?",
        "How do I request support or submit a request?"
      ],
      totalChunks,
      hasCatalog: false
    };

    setWorkspaces((prev) => [...prev.filter((w) => w.id !== id), newWs]);
    setActiveWorkspaceId(id);
    setMessages([]);
    setDrawerContent(null);
  };

  return (
    <div className="flex h-screen w-screen overflow-hidden bg-canvas font-sans relative">
      {/* Collapsible Left Sidebar */}
      <Sidebar
        workspaces={workspaces}
        activeWorkspaceId={activeWorkspaceId}
        onSelectWorkspace={handleSelectWorkspace}
        onOpenConnectModal={() => setConnectModalOpen(true)}
        isOpen={sidebarOpen}
        onToggle={() => setSidebarOpen((prev) => !prev)}
        recentSessions={recentSessions}
        activeSessionId={activeSessionId}
        onSelectSession={(sid) => setActiveSessionId(sid)}
        onNewSession={handleNewSession}
        apiHealthy={apiHealthy}
      />

      {/* Main Column */}
      <div className="flex-1 flex flex-col h-full min-w-0 relative">
        <Header
          sidebarOpen={sidebarOpen}
          onToggleSidebar={() => setSidebarOpen(true)}
          activeWorkspace={activeWorkspace}
          workspaces={workspaces}
          onSelectWorkspace={handleSelectWorkspace}
          onResetChat={handleNewSession}
          apiHealthy={apiHealthy}
          theme={theme}
          onToggleTheme={handleToggleTheme}
          onOpenSignIn={() => setSignInModalOpen(true)}
        />

        {/* Centered Chat Canvas */}
        <ChatCanvas
          messages={messages}
          activeWorkspace={activeWorkspace}
          onSendStarterPrompt={handleSendMessage}
          onOpenDrawer={(content) => setDrawerContent(content)}
          isLoading={isLoading}
        />

        {/* Floating Bottom Composer with B2B Compliance Footer */}
        <Composer
          onSendMessage={handleSendMessage}
          isLoading={isLoading}
          onOpenConnectModal={() => setConnectModalOpen(true)}
          workspaceName={activeWorkspace.name}
          onOpenPricing={() => setPricingModalOpen(true)}
          onOpenCookies={() => setCookieModalOpen(true)}
        />
      </div>

      {/* Slide-Over Right Artifact Drawer */}
      <ArtifactDrawer
        content={drawerContent}
        onClose={() => setDrawerContent(null)}
      />

      {/* Connect Website / Company Modal */}
      <ConnectModal
        isOpen={connectModalOpen}
        onClose={() => setConnectModalOpen(false)}
        onWorkspaceCreated={handleWorkspaceCreated}
      />

      {/* Team Sign In Modal */}
      <SignInModal
        isOpen={signInModalOpen}
        onClose={() => setSignInModalOpen(false)}
        activeWorkspaceName={activeWorkspace.name}
      />

      {/* Transparent B2B Pricing Modal */}
      <PricingModal
        isOpen={pricingModalOpen}
        onClose={() => setPricingModalOpen(false)}
      />

      {/* EU GDPR Cookie Settings Modal */}
      <CookieModal
        isOpen={cookieModalOpen}
        onClose={() => setCookieModalOpen(false)}
      />
    </div>
  );
}
