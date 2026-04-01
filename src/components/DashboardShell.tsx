"use client";

import { useState, useCallback } from "react";
import Navbar from "@/components/Navbar";
import Dashboard from "@/components/Dashboard";
import ChatPanel from "@/components/ChatPanel";
import SecurityPanel from "@/components/SecurityPanel";
import { MessageIcon } from "@/components/Icons";
import type { SecurityEvent } from "@/components/SecurityPanel";

export interface UserInfo {
  displayName: string;
  email: string;
  initials: string;
}

export interface AccountInfo {
  id: string;
  name: string;
  type: string;
  balance: number;
}

export interface TransactionInfo {
  id: string;
  amount: number;
  type: string;
  description: string;
  status: string;
  createdAt: string;
}

interface DashboardShellProps {
  user: UserInfo;
  accounts: AccountInfo[];
  transactions: TransactionInfo[];
}

export default function DashboardShell({ user, accounts: initialAccounts, transactions: initialTransactions }: DashboardShellProps) {
  const [chatOpen, setChatOpen] = useState(false);
  const [securityOpen, setSecurityOpen] = useState(false);
  const [securityEvents, setSecurityEvents] = useState<SecurityEvent[]>([]);
  const [accounts, setAccounts] = useState(initialAccounts);
  const [transactions, setTransactions] = useState(initialTransactions);

  const handleViewSecurityFlow = () => {
    setChatOpen(false);
    setTimeout(() => setSecurityOpen(true), 200);
  };

  const handleSecurityEvent = (event: SecurityEvent) => {
    setSecurityEvents((prev) => [...prev, event]);
  };

  const handleDataUpdated = useCallback(async () => {
    try {
      const res = await fetch('/api/data');
      if (res.ok) {
        const data = await res.json();
        setAccounts(data.accounts);
        setTransactions(data.transactions);
      }
    } catch {
      // Non-fatal — dashboard will show stale data
    }
  }, []);

  return (
    <div className="min-h-screen flex flex-col bg-navy-50">
      <Navbar user={user} />
      <Dashboard user={user} accounts={accounts} transactions={transactions} />

      {/* Floating AI Assistant Button */}
      <button
        onClick={() => setChatOpen(true)}
        className={`fixed bottom-8 right-8 z-20 flex items-center gap-2.5 px-5 py-3 bg-blue-electric hover:bg-blue-electric-dark text-white rounded-full shadow-lg hover:shadow-xl transition-all duration-200 animate-pulse-glow ${
          chatOpen ? "opacity-0 pointer-events-none" : "opacity-100"
        }`}
      >
        <MessageIcon className="w-5 h-5" />
        <span className="text-sm font-medium">AI Assistant</span>
      </button>

      {/* Chat Panel */}
      <ChatPanel
        isOpen={chatOpen}
        onClose={() => setChatOpen(false)}
        onViewSecurityFlow={handleViewSecurityFlow}
        onSecurityEvent={handleSecurityEvent}
        onDataUpdated={handleDataUpdated}
      />

      {/* Security Architecture Panel */}
      <SecurityPanel
        isOpen={securityOpen}
        onClose={() => setSecurityOpen(false)}
        events={securityEvents}
      />
    </div>
  );
}
