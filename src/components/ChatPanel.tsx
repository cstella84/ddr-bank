"use client";

import { useState, useRef, useEffect } from "react";
import { BotIcon, SendIcon, XIcon, LockIcon, ShieldCheckIcon } from "./Icons";
import { useChat } from "@/lib/hooks/useChat";
import type { SecurityEvent } from "./SecurityPanel";

interface ChatPanelProps {
  isOpen: boolean;
  onClose: () => void;
  onViewSecurityFlow: () => void;
  onSecurityEvent?: (event: SecurityEvent) => void;
  onDataUpdated?: () => void;
}

export default function ChatPanel({ isOpen, onClose, onViewSecurityFlow, onSecurityEvent, onDataUpdated }: ChatPanelProps) {
  const { messages, isStreaming, pushAuthState, pollAttempt, sessionRevoked, sendMessage, clearChat } = useChat(onSecurityEvent, onDataUpdated);
  const [input, setInput] = useState("");
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Auto-scroll to bottom on new messages
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const handleSend = () => {
    if (!input.trim() || isStreaming || sessionRevoked) return;
    sendMessage(input);
    setInput("");
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const isInputDisabled = isStreaming || sessionRevoked || pushAuthState === 'pending' || pushAuthState === 'polling';

  return (
    <>
      {/* Backdrop */}
      <div
        className={`fixed inset-0 bg-black/20 z-30 transition-opacity duration-300 ${
          isOpen ? "opacity-100" : "opacity-0 pointer-events-none"
        }`}
        onClick={onClose}
      />

      {/* Panel */}
      <div
        className={`fixed right-0 top-0 h-full w-[420px] bg-white z-40 shadow-2xl flex flex-col transition-transform duration-300 ease-out ${
          isOpen ? "translate-x-0" : "translate-x-full"
        }`}
      >
        {/* Header */}
        <div className="h-16 border-b border-navy-200 flex items-center px-5 gap-3 flex-shrink-0">
          <div className="w-8 h-8 rounded-full bg-blue-electric/10 flex items-center justify-center">
            <BotIcon className="w-4 h-4 text-blue-electric" />
          </div>
          <div className="flex-1">
            <p className="text-sm font-semibold text-navy-950">DDR Bank AI Assistant</p>
            <p className="text-[11px] text-success flex items-center gap-1">
              <span className={`w-1.5 h-1.5 rounded-full inline-block ${sessionRevoked ? 'bg-danger' : 'bg-success'}`} />
              {sessionRevoked ? "Session Revoked" : "Online"}
            </p>
          </div>
          <button
            onClick={clearChat}
            className="text-[10px] text-navy-400 hover:text-navy-600 transition-colors px-2 py-1 rounded"
            title="Clear chat"
          >
            Clear
          </button>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-lg hover:bg-navy-100 flex items-center justify-center transition-colors"
          >
            <XIcon className="w-4 h-4 text-navy-500" />
          </button>
        </div>

        {/* Session Revoked Banner */}
        {sessionRevoked && (
          <div className="px-5 py-3 bg-danger/10 border-b border-danger/20 flex items-center gap-2">
            <ShieldCheckIcon className="w-4 h-4 text-danger flex-shrink-0" />
            <p className="text-xs text-danger font-medium">Session terminated. Please <a href="/api/auth/logout" className="underline">sign in again</a>.</p>
          </div>
        )}

        {/* Messages */}
        <div className="flex-1 overflow-y-auto px-5 py-4 space-y-3">
          {messages.map((msg) => {
            // Tool planning — collapsible subtle card
            if (msg.type === 'tool_planning') {
              return (
                <div key={msg.id} className="flex justify-start">
                  <div className="max-w-[320px] px-3 py-2 rounded-xl bg-navy-50 border border-navy-200 text-[11px] text-navy-500 italic">
                    {msg.content}
                  </div>
                </div>
              );
            }

            // Tool output — monospace card
            if (msg.type === 'tool_output') {
              return (
                <div key={msg.id} className="flex justify-start">
                  <div className="max-w-[340px] px-3 py-2 rounded-xl bg-navy-900 text-[11px] text-navy-300 font-mono whitespace-pre-wrap border border-navy-700">
                    {msg.content}
                  </div>
                </div>
              );
            }

            // Push auth pending
            if (msg.type === 'push_auth_pending') {
              return (
                <div key={msg.id} className="flex justify-start">
                  <div className="max-w-[320px]">
                    <SecureTransferCard
                      onViewFlow={onViewSecurityFlow}
                      message={msg.content}
                      state={pushAuthState}
                      attempt={pollAttempt}
                    />
                  </div>
                </div>
              );
            }

            // Push auth denied/timeout
            if (msg.type === 'push_auth_denied' || msg.type === 'push_auth_timeout') {
              return (
                <div key={msg.id} className="flex justify-start">
                  <div className="max-w-[300px] px-4 py-2.5 rounded-2xl rounded-bl-md bg-danger/10 border border-danger/20 text-sm text-danger">
                    {msg.content}
                  </div>
                </div>
              );
            }

            // Session revoked
            if (msg.type === 'session_revoked') {
              return (
                <div key={msg.id} className="flex justify-start">
                  <div className="max-w-[300px] px-4 py-2.5 rounded-2xl rounded-bl-md bg-danger/10 border border-danger/20 text-sm text-danger font-medium">
                    {msg.content}
                  </div>
                </div>
              );
            }

            // Error
            if (msg.type === 'error') {
              return (
                <div key={msg.id} className="flex justify-start">
                  <div className="max-w-[300px] px-4 py-2.5 rounded-2xl rounded-bl-md bg-warning/10 border border-warning/20 text-sm text-warning">
                    {msg.content}
                  </div>
                </div>
              );
            }

            // Regular messages (user + assistant)
            return (
              <div key={msg.id} className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}>
                <div
                  className={`max-w-[300px] px-4 py-2.5 rounded-2xl text-sm leading-relaxed whitespace-pre-wrap ${
                    msg.role === "user"
                      ? "bg-blue-electric text-white rounded-br-md"
                      : "bg-navy-100 text-navy-900 rounded-bl-md"
                  }`}
                >
                  {msg.content}
                </div>
              </div>
            );
          })}

          {/* Typing indicator */}
          {isStreaming && (
            <div className="flex justify-start">
              <div className="bg-navy-100 text-navy-900 rounded-2xl rounded-bl-md px-4 py-2.5 text-sm">
                <span className="inline-flex gap-1">
                  <span className="w-1.5 h-1.5 rounded-full bg-navy-400 animate-bounce" style={{ animationDelay: "0ms" }} />
                  <span className="w-1.5 h-1.5 rounded-full bg-navy-400 animate-bounce" style={{ animationDelay: "150ms" }} />
                  <span className="w-1.5 h-1.5 rounded-full bg-navy-400 animate-bounce" style={{ animationDelay: "300ms" }} />
                </span>
              </div>
            </div>
          )}

          <div ref={messagesEndRef} />
        </div>

        {/* Input */}
        <div className="border-t border-navy-200 p-4 flex-shrink-0">
          <div className="flex items-center gap-2 bg-navy-50 rounded-xl px-4 py-2.5 border border-navy-200 focus-within:border-blue-electric focus-within:ring-2 focus-within:ring-blue-electric/20 transition-all">
            <input
              type="text"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder={isInputDisabled ? "Waiting..." : "Ask me anything about your account..."}
              className="flex-1 bg-transparent text-sm text-navy-900 placeholder:text-navy-400 outline-none disabled:opacity-50"
              disabled={isInputDisabled}
            />
            <button
              onClick={handleSend}
              disabled={isInputDisabled || !input.trim()}
              className="w-8 h-8 rounded-lg bg-blue-electric text-white flex items-center justify-center hover:bg-blue-electric-dark transition-colors flex-shrink-0 disabled:opacity-50"
            >
              <SendIcon className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>
    </>
  );
}

function SecureTransferCard({
  onViewFlow,
  message,
  state,
  attempt,
}: {
  onViewFlow: () => void;
  message: string;
  state: string;
  attempt: number;
}) {
  const isPolling = state === 'polling' || state === 'pending';
  const isApproved = state === 'approved';

  return (
    <div className="bg-gradient-to-br from-navy-950 to-navy-900 rounded-2xl p-4 text-white shadow-lg rounded-bl-md">
      <div className="flex items-center gap-2 mb-3">
        <div className={`w-7 h-7 rounded-lg flex items-center justify-center ${isApproved ? 'bg-success/20' : 'bg-gold/20'}`}>
          {isApproved ? (
            <svg className="w-3.5 h-3.5 text-success" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={3}>
              <polyline points="20 6 9 17 4 12" />
            </svg>
          ) : (
            <LockIcon className="w-3.5 h-3.5 text-gold" />
          )}
        </div>
        <span className="text-sm font-semibold">
          {isApproved ? "Transfer Authorized" : "Authorization Required"}
        </span>
      </div>

      <p className="text-xs text-navy-300 leading-relaxed mb-3">
        {message}
      </p>

      {isPolling && (
        <div className="flex items-center gap-2 mb-3">
          <div className="flex-1 h-1.5 bg-navy-800 rounded-full overflow-hidden">
            <div
              className="h-full bg-gradient-to-r from-blue-electric to-gold rounded-full animate-pulse"
              style={{ width: `${Math.min((attempt / 15) * 100, 100)}%` }}
            />
          </div>
          <span className="text-[10px] text-navy-400 font-mono">
            {state === 'polling' ? `Attempt ${attempt}` : 'Waiting...'}
          </span>
        </div>
      )}

      <button
        onClick={onViewFlow}
        className="w-full text-center text-xs font-medium text-blue-electric-light hover:text-white transition-colors flex items-center justify-center gap-1.5 py-1.5"
      >
        View Security Flow
        <svg className="w-3 h-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
          <line x1="5" y1="12" x2="19" y2="12" />
          <polyline points="12 5 19 12 12 19" />
        </svg>
      </button>
    </div>
  );
}
