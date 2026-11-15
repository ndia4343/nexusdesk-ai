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
import { Workspace, ChatMessage, DrawerContent, AuthUser, ChatSession, AgenticAction } from "@/types";

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
  const [currentUser, setCurrentUser] = useState<AuthUser | null>(null);
  const [recentSessions, setRecentSessions] = useState<ChatSession[]>([]);
  const [activeSessionId, setActiveSessionId] = useState<string>(() => `sess_${Date.now().toString(36)}`);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [apiHealthy, setApiHealthy] = useState<boolean | null>(null);

  // Active workspace object
  const activeWorkspace =
    workspaces.find((w) => w.id === activeWorkspaceId) || workspaces[0];

  // Initialize theme and saved user from localStorage
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

    try {
      const savedUserStr = localStorage.getItem("nexusdesk_user");
      if (savedUserStr) {
        const parsed = JSON.parse(savedUserStr);
        if (parsed && parsed.email) {
          setCurrentUser(parsed);
        }
      }
    } catch (e) {
      // ignore json parse error
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

    // Track active session in recent list with human-readable title (first 36 chars)
    const sessionTitle = queryText.trim().slice(0, 36) + (queryText.trim().length > 36 ? "..." : "");
    setRecentSessions((prev) => {
      const exists = prev.find((s) => s.id === activeSessionId);
      if (!exists) {
        return [
          {
            id: activeSessionId,
            title: sessionTitle,
            firstQuery: queryText.trim(),
            timestamp: new Date().toISOString()
          },
          ...prev.slice(0, 9)
        ];
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

  // Interactive Agentic Action handler
  const handleTriggerAction = async (messageId: string, action: AgenticAction, queryText: string) => {
    try {
      const res = await fetch(`${API_BASE_URL}/api/action`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          workspace_id: activeWorkspaceId,
          session_id: activeSessionId,
          action_type: action.type,
          customer_query: queryText
        })
      });

      let ticketId = `#ND-${Math.random().toString(36).substring(2, 8).toUpperCase()}`;
      let webhookStatus = "queued_offline";
      let timestamp = new Date().toISOString();

      if (res.ok) {
        const data = await res.json();
        const rawTicket = data.ticket_id || ticketId;
        ticketId = `#${rawTicket.replace(/^#+/, "")}`;
        webhookStatus = data.webhook_status || data.n8n_status || "dispatched";
        timestamp = data.timestamp || timestamp;
      }

      setMessages((prev) =>
        prev.map((m) =>
          m.id === messageId
            ? { ...m, action: { ...action, dispatched: true, ticketId } }
            : m
        )
      );

      setDrawerContent({
        type: "escalation",
        data: {
          escalation: {
            triggered: true,
            ticket_id: ticketId,
            status: "OPEN",
            webhook_status: webhookStatus,
            n8n_status: webhookStatus,
            workspace_id: activeWorkspaceId,
            query: queryText,
            timestamp
          },
          query: queryText,
          timestamp
        }
      });
    } catch (e) {
      const fallbackTicket = `#ND-${Math.random().toString(36).substring(2, 8).toUpperCase()}`;
      const ts = new Date().toISOString();
      setMessages((prev) =>
        prev.map((m) =>
          m.id === messageId
            ? { ...m, action: { ...action, dispatched: true, ticketId: fallbackTicket } }
            : m
        )
      );
      setDrawerContent({
        type: "escalation",
        data: {
          escalation: {
            triggered: true,
            ticket_id: fallbackTicket,
            status: "OPEN",
            webhook_status: "queued_offline",
            n8n_status: "queued_offline",
            workspace_id: activeWorkspaceId,
            query: queryText,
            timestamp: ts
          },
          query: queryText,
          timestamp: ts
        }
      });
    }
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
          currentUser={currentUser}
          onSignOut={() => {
            setCurrentUser(null);
            localStorage.removeItem("nexusdesk_user");
          }}
        />

        {/* Centered Chat Canvas */}
        <ChatCanvas
          messages={messages}
          activeWorkspace={activeWorkspace}
          onSendStarterPrompt={handleSendMessage}
          onOpenDrawer={(content) => setDrawerContent(content)}
          isLoading={isLoading}
          onTriggerAction={handleTriggerAction}
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
        onSignInSuccess={(user) => {
          setCurrentUser(user);
          localStorage.setItem("nexusdesk_user", JSON.stringify(user));
        }}
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
