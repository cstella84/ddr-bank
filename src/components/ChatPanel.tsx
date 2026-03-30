"use client";

import { useState } from "react";
import { BotIcon, SendIcon, XIcon, LockIcon } from "./Icons";

type Message = {
  role: "assistant" | "user";
  content: string;
  secureCard?: boolean;
};

const initialMessages: Message[] = [
  {
    role: "assistant",
    content:
      "Hi Sarah! I can help you check balances, review transactions, or transfer funds. What can I help with?",
  },
  {
    role: "user",
    content: "What's my checking balance?",
  },
  {
    role: "assistant",
    content:
      "Your checking account (••••4821) has a current balance of $12,847.53. Would you like to do anything else?",
  },
  {
    role: "user",
    content: "Transfer $500 from checking to savings",
  },
  {
    role: "assistant",
    content: "",
    secureCard: true,
  },
];

interface ChatPanelProps {
  isOpen: boolean;
  onClose: () => void;
  onViewSecurityFlow: () => void;
}

export default function ChatPanel({ isOpen, onClose, onViewSecurityFlow }: ChatPanelProps) {
  const [messages] = useState<Message[]>(initialMessages);
  const [input, setInput] = useState("");

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
              <span className="w-1.5 h-1.5 rounded-full bg-success inline-block" />
              Online
            </p>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-lg hover:bg-navy-100 flex items-center justify-center transition-colors"
          >
            <XIcon className="w-4 h-4 text-navy-500" />
          </button>
        </div>

        {/* Messages */}
        <div className="flex-1 overflow-y-auto px-5 py-4 space-y-4">
          {messages.map((msg, i) => (
            <div key={i} className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}>
              {msg.secureCard ? (
                <div className="max-w-[320px]">
                  <SecureTransferCard onViewFlow={onViewSecurityFlow} />
                </div>
              ) : (
                <div
                  className={`max-w-[300px] px-4 py-2.5 rounded-2xl text-sm leading-relaxed ${
                    msg.role === "user"
                      ? "bg-blue-electric text-white rounded-br-md"
                      : "bg-navy-100 text-navy-900 rounded-bl-md"
                  }`}
                >
                  {msg.content}
                </div>
              )}
            </div>
          ))}
        </div>

        {/* Input */}
        <div className="border-t border-navy-200 p-4 flex-shrink-0">
          <div className="flex items-center gap-2 bg-navy-50 rounded-xl px-4 py-2.5 border border-navy-200 focus-within:border-blue-electric focus-within:ring-2 focus-within:ring-blue-electric/20 transition-all">
            <input
              type="text"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="Ask me anything about your account..."
              className="flex-1 bg-transparent text-sm text-navy-900 placeholder:text-navy-400 outline-none"
            />
            <button className="w-8 h-8 rounded-lg bg-blue-electric text-white flex items-center justify-center hover:bg-blue-electric-dark transition-colors flex-shrink-0">
              <SendIcon className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>
    </>
  );
}

function SecureTransferCard({ onViewFlow }: { onViewFlow: () => void }) {
  return (
    <div className="bg-gradient-to-br from-navy-950 to-navy-900 rounded-2xl p-4 text-white shadow-lg rounded-bl-md">
      <div className="flex items-center gap-2 mb-3">
        <div className="w-7 h-7 rounded-lg bg-gold/20 flex items-center justify-center">
          <LockIcon className="w-3.5 h-3.5 text-gold" />
        </div>
        <span className="text-sm font-semibold">Secure Transfer Initiated</span>
      </div>
      <p className="text-xs text-navy-300 leading-relaxed mb-3">
        To authorize this transfer, I&apos;m verifying your identity and securing a short-lived credential. You can watch this process in real time.
      </p>

      {/* Progress indicator */}
      <div className="flex items-center gap-2 mb-3">
        <div className="flex-1 h-1.5 bg-navy-800 rounded-full overflow-hidden">
          <div className="h-full w-2/3 bg-gradient-to-r from-blue-electric to-gold rounded-full transition-all duration-1000" />
        </div>
        <span className="text-[10px] text-navy-400 font-mono">Processing</span>
      </div>

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
