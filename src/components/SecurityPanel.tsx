"use client";

import { useEffect, useState } from "react";
import { XIcon, BotIcon, ShieldCheckIcon, KeyIcon, DatabaseIcon, CheckCircleIcon } from "./Icons";

export interface SecurityEvent {
  type: string;        // 'security:token_exchange', 'security:vault_fetch', etc.
  node: string;        // 'agent' | 'verify' | 'vault' | 'api'
  status: string;      // 'active' | 'complete' | 'error'
  message: string;     // Human-readable log line
  timestamp: string;   // ISO timestamp
}

interface SecurityPanelProps {
  isOpen: boolean;
  onClose: () => void;
  events?: SecurityEvent[];
}

type NodeStatus = "complete" | "active" | "pending";

interface NodeDef {
  id: string;
  label: string;
  sublabel?: string;
  caption: string;
  Icon: typeof BotIcon;
  status: NodeStatus;
}

// Default static nodes (used when no live events)
const defaultNodes: NodeDef[] = [
  {
    id: "agent",
    label: "DDR Bank AI Agent",
    caption: "Receives natural language transfer request",
    Icon: BotIcon,
    status: "complete",
  },
  {
    id: "verify",
    label: "IBM Verify",
    sublabel: "Identity & Policy Engine",
    caption: "Evaluates risk, enforces adaptive access policy, issues authorization decision",
    Icon: ShieldCheckIcon,
    status: "complete",
  },
  {
    id: "vault",
    label: "HashiCorp Vault",
    sublabel: "Secrets & Credential Broker",
    caption: "Generates short-lived, scoped credential for the transfer API",
    Icon: KeyIcon,
    status: "active",
  },
  {
    id: "api",
    label: "Core Banking API",
    caption: "Executes the $500 transfer with the ephemeral credential",
    Icon: DatabaseIcon,
    status: "pending",
  },
];

const defaultLogEntries = [
  { time: "14:32:01", text: "AI Agent parsed transfer intent: $500 Checking → Savings", level: "info" },
  { time: "14:32:01", text: "Identity verification requested from IBM Verify", level: "info" },
  { time: "14:32:02", text: "IBM Verify — Adaptive risk score: LOW — Authorization: GRANTED", level: "success" },
  { time: "14:32:02", text: "Vault — Generating scoped credential (TTL: 30s, policy: transfer-only)", level: "info" },
  { time: "14:32:03", text: "Vault — Credential issued. Scope: write:transfers, Max: $500", level: "success" },
  { time: "14:32:03", text: "Executing transfer via Core Banking API…", level: "pending" },
];

function StatusDot({ status }: { status: NodeStatus }) {
  if (status === "complete") {
    return <CheckCircleIcon className="w-4 h-4 text-success" />;
  }
  if (status === "active") {
    return (
      <div className="w-4 h-4 rounded-full border-2 border-blue-electric flex items-center justify-center">
        <div className="w-2 h-2 rounded-full bg-blue-electric animate-pulse" />
      </div>
    );
  }
  return <div className="w-4 h-4 rounded-full border-2 border-navy-600" />;
}

function FlowArrow({ active }: { active?: boolean }) {
  return (
    <div className="flex items-center mx-1 flex-shrink-0">
      <svg width="48" height="24" viewBox="0 0 48 24" className="overflow-visible">
        <line
          x1="0"
          y1="12"
          x2="40"
          y2="12"
          stroke={active ? "#3B82F6" : "#334155"}
          strokeWidth="2"
          strokeDasharray="6 4"
          className={active ? "animate-flow-dash" : ""}
        />
        <polygon
          points="38,7 48,12 38,17"
          fill={active ? "#3B82F6" : "#334155"}
        />
      </svg>
    </div>
  );
}

export default function SecurityPanel({ isOpen, onClose, events = [] }: SecurityPanelProps) {
  const [visibleLogs, setVisibleLogs] = useState(0);

  // Derive node statuses from live events (if any), otherwise use defaults
  const hasLiveEvents = events.length > 0;

  const nodes: NodeDef[] = hasLiveEvents
    ? defaultNodes.map((node) => {
        const nodeEvents = events.filter((e) => e.node === node.id);
        const lastEvent = nodeEvents[nodeEvents.length - 1];
        let status: NodeStatus = "pending";
        if (lastEvent) {
          status = lastEvent.status as NodeStatus;
        }
        const caption = lastEvent?.message ?? node.caption;
        return { ...node, status, caption };
      })
    : defaultNodes;

  const logEntries = hasLiveEvents
    ? events.map((e) => ({
        time: new Date(e.timestamp).toLocaleTimeString("en-US", { hour12: false }),
        text: e.message,
        level: e.status === "complete" ? "success" : e.status === "error" ? "danger" : "info",
      }))
    : defaultLogEntries;

  useEffect(() => {
    if (isOpen) {
      setVisibleLogs(0);
      const interval = setInterval(() => {
        setVisibleLogs((prev) => {
          if (prev >= logEntries.length) {
            clearInterval(interval);
            return prev;
          }
          return prev + 1;
        });
      }, 400);
      return () => clearInterval(interval);
    }
  }, [isOpen, logEntries.length]);

  return (
    <>
      {/* Backdrop */}
      <div
        className={`fixed inset-0 bg-navy-950/60 backdrop-blur-sm z-50 transition-opacity duration-300 ${
          isOpen ? "opacity-100" : "opacity-0 pointer-events-none"
        }`}
        onClick={onClose}
      />

      {/* Panel */}
      <div
        className={`fixed inset-4 z-50 bg-navy-900 rounded-2xl shadow-2xl flex flex-col overflow-hidden transition-all duration-500 ${
          isOpen ? "opacity-100 scale-100" : "opacity-0 scale-95 pointer-events-none"
        }`}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-8 py-5 border-b border-navy-800">
          <div>
            <h2 className="text-lg font-semibold text-white flex items-center gap-2">
              <div className="w-2 h-2 rounded-full bg-blue-electric animate-pulse" />
              Security Flow — {hasLiveEvents ? "Live View" : "Demo View"}
            </h2>
            <p className="text-sm text-navy-400 mt-0.5">
              See how HashiCorp Vault and IBM Verify protect this transaction in real time.
            </p>
          </div>
          <button
            onClick={onClose}
            className="w-9 h-9 rounded-lg bg-navy-800 hover:bg-navy-700 flex items-center justify-center transition-colors"
          >
            <XIcon className="w-4 h-4 text-navy-400" />
          </button>
        </div>

        {/* Flow Diagram */}
        <div className="flex-1 overflow-auto">
          <div className="px-8 py-8">
            {/* Nodes */}
            <div className="flex items-start justify-center gap-0">
              {nodes.map((node, i) => {
                const Icon = node.Icon;
                const isActive = node.status === "active";
                const isComplete = node.status === "complete";

                return (
                  <div key={node.id} className="flex items-start">
                    <div
                      className={`relative rounded-xl border-2 p-4 w-[260px] transition-all duration-500 ${
                        isActive
                          ? "border-blue-electric bg-blue-electric/5 animate-node-glow"
                          : isComplete
                          ? "border-success/30 bg-success/5"
                          : "border-navy-700 bg-navy-800/50"
                      }`}
                    >
                      {/* Status */}
                      <div className="absolute -top-2 -right-2">
                        <StatusDot status={node.status} />
                      </div>

                      <div className="flex items-center gap-3 mb-3">
                        <div
                          className={`w-10 h-10 rounded-lg flex items-center justify-center ${
                            isActive
                              ? "bg-blue-electric/20 text-blue-electric"
                              : isComplete
                              ? "bg-success/20 text-success"
                              : "bg-navy-700 text-navy-400"
                          }`}
                        >
                          <Icon className="w-5 h-5" />
                        </div>
                        <div>
                          <p className={`text-sm font-semibold ${isActive ? "text-white" : isComplete ? "text-navy-200" : "text-navy-400"}`}>
                            {node.label}
                          </p>
                          {node.sublabel && (
                            <p className="text-[10px] text-navy-500 font-medium">{node.sublabel}</p>
                          )}
                        </div>
                      </div>

                      <p className={`text-xs leading-relaxed ${isActive ? "text-navy-300" : "text-navy-500"}`}>
                        {node.caption}
                      </p>

                      {isActive && (
                        <div className="mt-3 flex items-center gap-2">
                          <div className="h-1 flex-1 bg-navy-800 rounded-full overflow-hidden">
                            <div className="h-full w-3/4 bg-blue-electric rounded-full animate-pulse" />
                          </div>
                          <span className="text-[10px] text-blue-electric font-mono">Processing…</span>
                        </div>
                      )}
                    </div>

                    {i < nodes.length - 1 && (
                      <div className="flex items-center self-center mt-6">
                        <FlowArrow active={i < 2} />
                      </div>
                    )}
                  </div>
                );
              })}
            </div>

            {/* Return arrow */}
            <div className="flex justify-center mt-4 px-16">
              <div className="w-full max-w-[850px] relative">
                <svg width="100%" height="40" viewBox="0 0 850 40" preserveAspectRatio="none" className="overflow-visible">
                  <path
                    d="M 820 5 L 820 25 L 30 25 L 30 5"
                    fill="none"
                    stroke="#334155"
                    strokeWidth="1.5"
                    strokeDasharray="6 4"
                  />
                  <polygon points="26,10 30,0 34,10" fill="#334155" />
                  <text x="425" y="22" textAnchor="middle" fontSize="10" fill="#64748B" fontFamily="monospace">
                    Confirmation + credential revocation
                  </text>
                </svg>
              </div>
            </div>
          </div>

          {/* Log Panel */}
          <div className="mx-8 mb-6 rounded-xl bg-[#0C1220] border border-navy-800 overflow-hidden">
            <div className="px-4 py-2.5 border-b border-navy-800 flex items-center gap-2">
              <div className="flex gap-1.5">
                <div className="w-2.5 h-2.5 rounded-full bg-danger/60" />
                <div className="w-2.5 h-2.5 rounded-full bg-warning/60" />
                <div className="w-2.5 h-2.5 rounded-full bg-success/60" />
              </div>
              <span className="text-[11px] text-navy-500 font-mono ml-2">security-event-stream</span>
            </div>
            <div className="p-4 font-mono text-xs space-y-1.5 min-h-[130px]">
              {logEntries.slice(0, visibleLogs).map((entry, i) => (
                <div key={i} className="animate-fade-in-up flex">
                  <span className="text-navy-600 mr-3 flex-shrink-0">[{entry.time}]</span>
                  <span
                    className={
                      entry.level === "success"
                        ? "text-success"
                        : entry.level === "pending" || entry.level === "danger"
                        ? "text-warning"
                        : "text-blue-electric-light"
                    }
                  >
                    {entry.text}
                  </span>
                </div>
              ))}
              {visibleLogs < logEntries.length && (
                <div className="flex items-center gap-1 text-navy-600">
                  <span className="inline-block w-1.5 h-3 bg-navy-500 animate-pulse" />
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="border-t border-navy-800 px-8 py-4 flex items-center justify-between">
          <div className="flex items-center gap-6">
            <div className="flex items-center gap-2">
              <div className="w-7 h-7 rounded bg-navy-800 flex items-center justify-center">
                <KeyIcon className="w-4 h-4 text-gold" />
              </div>
              <div>
                <p className="text-[11px] font-semibold text-navy-300">HashiCorp</p>
                <p className="text-[10px] text-navy-500">Vault</p>
              </div>
            </div>

            <div className="w-px h-8 bg-navy-800" />

            <div className="flex items-center gap-2">
              <div className="w-7 h-7 rounded bg-navy-800 flex items-center justify-center">
                <ShieldCheckIcon className="w-4 h-4 text-blue-electric-light" />
              </div>
              <div>
                <p className="text-[11px] font-semibold text-navy-300">IBM</p>
                <p className="text-[10px] text-navy-500">Verify</p>
              </div>
            </div>

            <div className="w-px h-8 bg-navy-800" />

            <p className="text-[11px] text-navy-500">
              Agentic AI Security — Powered by HashiCorp Vault & IBM Verify
            </p>
          </div>

          <button
            onClick={onClose}
            className="px-4 py-2 text-sm font-medium text-navy-300 bg-navy-800 hover:bg-navy-700 rounded-lg transition-colors"
          >
            Back to Dashboard
          </button>
        </div>
      </div>
    </>
  );
}
