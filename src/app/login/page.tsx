"use client";

import { useSearchParams } from "next/navigation";
import { Suspense } from "react";
import { ShieldIcon } from "@/components/Icons";

function LoginContent() {
  const searchParams = useSearchParams();
  const error = searchParams.get("error");
  const reason = searchParams.get("reason");

  const errorMessages: Record<string, string> = {
    session_expired: "Your session has expired. Please log in again.",
    missing_code: "Authentication failed — missing authorization code.",
    token_exchange_failed: "Authentication failed — could not complete login.",
    logout_failed: "Logout encountered an issue, but your session has been cleared.",
  };

  const displayError = error ? errorMessages[error] ?? "An error occurred." : null;
  const displayReason = reason === "session_expired" ? errorMessages.session_expired : null;

  return (
    <div className="min-h-screen flex items-center justify-center bg-navy-950 px-4">
      <div className="w-full max-w-sm">
        {/* Logo */}
        <div className="flex flex-col items-center mb-10">
          <div className="w-14 h-14 bg-gold rounded-2xl flex items-center justify-center mb-4 shadow-lg">
            <ShieldIcon className="w-7 h-7 text-navy-950" />
          </div>
          <h1 className="text-2xl font-semibold text-white tracking-tight">
            DDR <span className="font-light text-navy-400">Bank</span>
          </h1>
          <p className="text-sm text-navy-500 mt-1">Secure Digital Banking</p>
        </div>

        {/* Error message */}
        {(displayError || displayReason) && (
          <div className="mb-6 px-4 py-3 rounded-xl bg-danger/10 border border-danger/20 text-sm text-danger">
            {displayError || displayReason}
          </div>
        )}

        {/* Login card */}
        <div className="bg-navy-900 rounded-2xl border border-navy-800 p-8 shadow-xl">
          <h2 className="text-lg font-semibold text-white mb-2">Welcome back</h2>
          <p className="text-sm text-navy-400 mb-8">
            Sign in with your IBM Verify account to access your dashboard.
          </p>

          <a
            href="/api/auth/redirect"
            className="w-full flex items-center justify-center gap-3 px-5 py-3 bg-blue-electric hover:bg-blue-electric-dark text-white text-sm font-medium rounded-xl transition-colors duration-200 shadow-md hover:shadow-lg"
          >
            <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
              <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
              <path d="M7 11V7a5 5 0 0 1 10 0v4" />
            </svg>
            Login with IBM Verify
          </a>

          <div className="mt-6 flex items-center gap-3">
            <div className="flex-1 h-px bg-navy-800" />
            <span className="text-[11px] text-navy-600 uppercase tracking-wider">Secured by</span>
            <div className="flex-1 h-px bg-navy-800" />
          </div>

          <div className="mt-4 flex items-center justify-center gap-6 text-navy-500">
            <div className="flex items-center gap-1.5 text-[11px]">
              <ShieldIcon className="w-3.5 h-3.5" />
              <span>IBM Verify</span>
            </div>
            <div className="w-px h-4 bg-navy-800" />
            <div className="flex items-center gap-1.5 text-[11px]">
              <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
                <path d="M21 2l-2 2m-7.61 7.61a5.5 5.5 0 1 1-7.778 7.778 5.5 5.5 0 0 1 7.777-7.777zm0 0L15.5 7.5m0 0l3 3L22 7l-3-3m-3.5 3.5L19 4" />
              </svg>
              <span>HashiCorp Vault</span>
            </div>
          </div>
        </div>

        <p className="text-center text-[11px] text-navy-600 mt-6">
          Agentic AI Runtime Security Demo
        </p>
      </div>
    </div>
  );
}

export default function LoginPage() {
  return (
    <Suspense>
      <LoginContent />
    </Suspense>
  );
}
