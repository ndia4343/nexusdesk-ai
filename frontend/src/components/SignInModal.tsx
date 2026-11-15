"use client";

import React, { useState } from "react";
import {
  X,
  Lock,
  Building,
  Mail,
  KeyRound,
  ShieldCheck,
  CheckCircle2,
  ArrowRight,
  ArrowLeft,
  UserCheck,
  Plus
} from "lucide-react";
import { AuthUser } from "@/types";

interface SignInModalProps {
  isOpen: boolean;
  onClose: () => void;
  activeWorkspaceName: string;
  onSignInSuccess: (user: AuthUser) => void;
}

export const SignInModal: React.FC<SignInModalProps> = ({
  isOpen,
  onClose,
  activeWorkspaceName,
  onSignInSuccess
}) => {
  const [step, setStep] = useState<"main" | "google_chooser">("main");
  const [email, setEmail] = useState("");
  const [accessCode, setAccessCode] = useState("");
  const [customGoogleEmail, setCustomGoogleEmail] = useState("");
  const [authenticatedUser, setAuthenticatedUser] = useState<AuthUser | null>(null);

  if (!isOpen) return null;

  const handleFinishAuth = (user: AuthUser) => {
    setAuthenticatedUser(user);
    setTimeout(() => {
      onSignInSuccess(user);
      onClose();
      setAuthenticatedUser(null);
      setStep("main");
      setEmail("");
      setAccessCode("");
      setCustomGoogleEmail("");
    }, 1000);
  };

  const handleDirectSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!email) return;
    const name = email.split("@")[0];
    const user: AuthUser = {
      name: name.charAt(0).toUpperCase() + name.slice(1),
      email,
      role: "Workspace Member",
      provider: "custom"
    };
    handleFinishAuth(user);
  };

  const handleCustomGoogleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!customGoogleEmail) return;
    const name = customGoogleEmail.split("@")[0];
    const user: AuthUser = {
      name: name.charAt(0).toUpperCase() + name.slice(1),
      email: customGoogleEmail,
      role: "Workspace Member",
      provider: "google"
    };
    handleFinishAuth(user);
  };

  const googleAccounts: AuthUser[] = [
    {
      name: "Nadia",
      email: "nadia@zavianlabs.com",
      role: "Workspace Owner",
      provider: "google"
    },
    {
      name: "Support Lead",
      email: "ops@company.com",
      role: "Support Lead",
      provider: "google"
    }
  ];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-canvas/80 backdrop-blur-md animate-in fade-in">
      <div className="w-full max-w-md bg-surface border border-cardborder rounded-2xl shadow-2xl overflow-hidden flex flex-col shadow-highlight">
        {/* Header */}
        <div className="px-6 py-4 border-b border-borderline flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-cyan to-indigo flex items-center justify-center text-slate-950 font-bold">
              <Lock className="w-4 h-4 text-slate-950" />
            </div>
            <div>
              <h2 className="text-base font-bold text-slate-900 dark:text-slate-100">
                {step === "google_chooser" ? "Google Account Chooser" : "Workspace Team Sign-In"}
              </h2>
              <p className="text-[11px] text-slate-600 dark:text-slate-400">
                Multi-user tenant access & RBAC controls
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-slate-200 hover:bg-card rounded-md transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Body */}
        <div className="p-6 space-y-4">
          {authenticatedUser ? (
            <div className="py-8 text-center space-y-3 animate-in fade-in">
              <CheckCircle2 className="w-12 h-12 text-emerald mx-auto animate-bounce" />
              <div className="text-base font-bold text-slate-900 dark:text-slate-100">
                Authenticated as {authenticatedUser.name}
              </div>
              <p className="text-xs text-slate-600 dark:text-slate-400">
                Role: <span className="font-semibold text-cyan">{authenticatedUser.role}</span> ({authenticatedUser.email})
              </p>
              <p className="text-[11px] text-slate-500">
                Granting scoped session access to {activeWorkspaceName}...
              </p>
            </div>
          ) : step === "google_chooser" ? (
            <div className="space-y-4 animate-in fade-in">
              <div className="flex items-center gap-2 mb-1">
                <button
                  type="button"
                  onClick={() => setStep("main")}
                  className="p-1 text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-slate-200 rounded-md hover:bg-card transition-colors flex items-center gap-1 text-xs"
                >
                  <ArrowLeft className="w-3.5 h-3.5" />
                  <span>Back</span>
                </button>
              </div>

              <div className="text-center pb-2">
                <div className="inline-flex p-2 rounded-xl bg-card border border-cardborder mb-2 shadow-sm">
                  <svg className="w-6 h-6" viewBox="0 0 24 24">
                    <path
                      fill="#4285F4"
                      d="M23.745 12.27c0-.7-.06-1.4-.19-2.07H12v4.51h6.6c-.29 1.52-1.14 2.8-2.4 3.65v3.05h3.9c2.28-2.1 3.645-5.18 3.645-9.14z"
                    />
                    <path
                      fill="#34A853"
                      d="M12 24c3.24 0 5.95-1.08 7.93-2.91l-3.9-3.05c-1.08.72-2.45 1.16-4.03 1.16-3.1 0-5.74-2.1-6.68-4.93H1.21v3.15C3.25 21.43 7.33 24 12 24z"
                    />
                    <path
                      fill="#FBBC05"
                      d="M5.32 14.27c-.24-.73-.38-1.5-.38-2.27s.14-1.54.38-2.27V6.58H1.21C.44 8.11 0 9.99 0 12s.44 3.89 1.21 5.42l4.11-3.15z"
                    />
                    <path
                      fill="#EA4335"
                      d="M12 4.75c1.77 0 3.35.61 4.6 1.8l3.42-3.42C17.95 1.19 15.24 0 12 0 7.33 0 3.25 2.57 1.21 6.58l4.11 3.15c.94-2.83 3.58-4.98 6.68-4.98z"
                    />
                  </svg>
                </div>
                <h3 className="text-sm font-bold text-slate-900 dark:text-slate-100">
                  Choose an account
                </h3>
                <p className="text-xs text-slate-600 dark:text-slate-400">
                  to continue to <span className="font-semibold text-slate-800 dark:text-slate-200">NexusDesk AI</span>
                </p>
              </div>

              {/* Account list */}
              <div className="space-y-2">
                {googleAccounts.map((account) => (
                  <button
                    key={account.email}
                    type="button"
                    onClick={() => handleFinishAuth(account)}
                    className="w-full p-3 rounded-xl bg-card hover:bg-cardhover border border-cardborder text-left flex items-center justify-between transition-all shadow-sm hover:border-cyan/50 group"
                  >
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-full bg-gradient-to-br from-cyan/30 to-indigo/30 border border-cardborder flex items-center justify-center font-bold text-xs text-slate-900 dark:text-slate-100">
                        {account.name.slice(0, 2).toUpperCase()}
                      </div>
                      <div>
                        <div className="text-xs font-bold text-slate-900 dark:text-slate-100 group-hover:text-cyan transition-colors">
                          {account.name}
                        </div>
                        <div className="text-[11px] text-slate-600 dark:text-slate-400">
                          {account.email}
                        </div>
                      </div>
                    </div>
                    <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-cyan/10 text-cyan border border-cyan/20">
                      {account.role}
                    </span>
                  </button>
                ))}
              </div>

              {/* Use another Google account */}
              <div className="pt-2 border-t border-borderline">
                <label className="block text-[11px] font-bold text-slate-700 dark:text-slate-300 mb-1.5">
                  Use another Google account / work email
                </label>
                <form onSubmit={handleCustomGoogleSubmit} className="flex gap-2">
                  <div className="relative flex-1">
                    <Mail className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
                    <input
                      type="email"
                      required
                      placeholder="your.email@company.com"
                      value={customGoogleEmail}
                      onChange={(e) => setCustomGoogleEmail(e.target.value)}
                      className="w-full pl-9 pr-3 py-2 rounded-xl bg-card border border-cardborder text-xs text-slate-900 dark:text-slate-100 placeholder:text-slate-500 dark:placeholder:text-slate-400 focus:outline-none focus:border-cyan shadow-sm"
                    />
                  </div>
                  <button
                    type="submit"
                    className="px-3 py-2 rounded-xl bg-sky-600 dark:bg-cyan text-white dark:text-slate-950 font-bold text-xs flex items-center justify-center hover:bg-sky-700 dark:hover:bg-cyan/90 transition-colors shadow-sm"
                  >
                    <ArrowRight className="w-4 h-4" />
                  </button>
                </form>
              </div>
            </div>
          ) : (
            <>
              {/* Active Workspace Banner */}
              <div className="p-3 rounded-xl bg-card border border-cardborder flex items-center justify-between text-xs shadow-sm">
                <span className="text-slate-600 dark:text-slate-400 font-medium">Target Workspace:</span>
                <span className="font-bold text-sky-600 dark:text-cyan flex items-center gap-1.5">
                  <Building className="w-3.5 h-3.5" />
                  {activeWorkspaceName}
                </span>
              </div>

              {/* Form */}
              <form onSubmit={handleDirectSubmit} className="space-y-3.5">
                <div>
                  <label className="block text-[11px] font-bold text-slate-800 dark:text-slate-300 uppercase tracking-wider mb-1.5">
                    Corporate Email
                  </label>
                  <div className="relative">
                    <Mail className="w-4 h-4 text-slate-400 absolute left-3 top-3" />
                    <input
                      type="email"
                      required
                      placeholder="name@company.com"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      className="w-full pl-9 pr-3.5 py-2.5 rounded-xl bg-card border border-cardborder text-xs text-slate-900 dark:text-slate-100 placeholder:text-slate-500 dark:placeholder:text-slate-400 focus:outline-none focus:border-cyan shadow-sm font-medium"
                    />
                  </div>
                </div>

                <div>
                  <div className="flex items-center justify-between mb-1.5">
                    <label className="block text-[11px] font-bold text-slate-800 dark:text-slate-300 uppercase tracking-wider">
                      Workspace Access Key / PIN
                    </label>
                    <span className="text-[10px] text-slate-500 dark:text-slate-400 font-mono">Optional for demo</span>
                  </div>
                  <div className="relative">
                    <KeyRound className="w-4 h-4 text-slate-400 absolute left-3 top-3" />
                    <input
                      type="password"
                      placeholder="••••••••••••"
                      value={accessCode}
                      onChange={(e) => setAccessCode(e.target.value)}
                      className="w-full pl-9 pr-3.5 py-2.5 rounded-xl bg-card border border-cardborder text-xs text-slate-900 dark:text-slate-100 placeholder:text-slate-500 dark:placeholder:text-slate-400 focus:outline-none focus:border-cyan shadow-sm font-mono"
                    />
                  </div>
                </div>

                <button
                  type="submit"
                  className="w-full py-2.5 rounded-xl bg-sky-600 dark:bg-cyan hover:bg-sky-700 dark:hover:bg-cyan/90 text-white dark:text-slate-950 font-bold text-xs flex items-center justify-center gap-2 transition-all shadow-md mt-1"
                >
                  <span>Authenticate to Workspace</span>
                  <ArrowRight className="w-4 h-4" />
                </button>
              </form>

              {/* Divider */}
              <div className="relative flex items-center justify-center my-3">
                <div className="border-t border-borderline w-full" />
                <span className="bg-surface px-2 text-[10px] uppercase font-bold text-slate-500 dark:text-slate-400 absolute">
                  Or Enterprise SSO
                </span>
              </div>

              {/* SSO Buttons */}
              <div className="space-y-2">
                <button
                  type="button"
                  onClick={() => setStep("google_chooser")}
                  className="w-full py-2.5 px-3 rounded-xl bg-card hover:bg-cardhover border border-cardborder text-xs font-semibold text-slate-800 dark:text-slate-200 hover:text-slate-950 dark:hover:text-white flex items-center justify-center gap-2 transition-all shadow-sm"
                >
                  <svg className="w-4 h-4" viewBox="0 0 24 24">
                    <path
                      fill="#4285F4"
                      d="M23.745 12.27c0-.7-.06-1.4-.19-2.07H12v4.51h6.6c-.29 1.52-1.14 2.8-2.4 3.65v3.05h3.9c2.28-2.1 3.645-5.18 3.645-9.14z"
                    />
                    <path
                      fill="#34A853"
                      d="M12 24c3.24 0 5.95-1.08 7.93-2.91l-3.9-3.05c-1.08.72-2.45 1.16-4.03 1.16-3.1 0-5.74-2.1-6.68-4.93H1.21v3.15C3.25 21.43 7.33 24 12 24z"
                    />
                    <path
                      fill="#FBBC05"
                      d="M5.32 14.27c-.24-.73-.38-1.5-.38-2.27s.14-1.54.38-2.27V6.58H1.21C.44 8.11 0 9.99 0 12s.44 3.89 1.21 5.42l4.11-3.15z"
                    />
                    <path
                      fill="#EA4335"
                      d="M12 4.75c1.77 0 3.35.61 4.6 1.8l3.42-3.42C17.95 1.19 15.24 0 12 0 7.33 0 3.25 2.57 1.21 6.58l4.11 3.15c.94-2.83 3.58-4.98 6.68-4.98z"
                    />
                  </svg>
                  <span>Continue with Google</span>
                </button>

                <button
                  type="button"
                  onClick={() =>
                    handleFinishAuth({
                      name: "Enterprise Admin",
                      email: "admin@enterprise-saml.com",
                      role: "SAML Admin",
                      provider: "sso"
                    })
                  }
                  className="w-full py-2.5 px-3 rounded-xl bg-card hover:bg-cardhover border border-cardborder text-xs font-semibold text-slate-800 dark:text-slate-200 hover:text-slate-950 dark:hover:text-white flex items-center justify-center gap-2 transition-all shadow-sm"
                >
                  <ShieldCheck className="w-4 h-4 text-indigo" />
                  <span>Sign in with Okta / SAML 2.0</span>
                </button>
              </div>

              {/* Compliance Footer */}
              <div className="pt-2 text-center text-[10px] text-slate-500 dark:text-slate-400 flex items-center justify-center gap-1.5">
                <ShieldCheck className="w-3.5 h-3.5 text-emerald" />
                <span>Zero model training. End-to-end tenant isolated.</span>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
};
