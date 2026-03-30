"use client";

import { useState } from "react";
import Navbar from "@/components/Navbar";
import Dashboard from "@/components/Dashboard";
import ChatPanel from "@/components/ChatPanel";
import SecurityPanel from "@/components/SecurityPanel";
import { MessageIcon } from "@/components/Icons";

export default function Home() {
  const [chatOpen, setChatOpen] = useState(false);
  const [securityOpen, setSecurityOpen] = useState(false);

  const handleViewSecurityFlow = () => {
    setChatOpen(false);
    setTimeout(() => setSecurityOpen(true), 200);
  };

  return (
    <div className="min-h-screen flex flex-col bg-navy-50">
      <Navbar />
      <Dashboard />

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
      />

      {/* Security Architecture Panel */}
      <SecurityPanel
        isOpen={securityOpen}
        onClose={() => setSecurityOpen(false)}
      />
    </div>
  );
}
