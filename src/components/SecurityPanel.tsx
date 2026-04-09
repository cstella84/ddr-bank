"use client";

import { useEffect, useState, useRef, type ComponentType, type SVGProps } from "react";
import { XIcon, BotIcon, ShieldCheckIcon, KeyIcon, DatabaseIcon, LockIcon, CheckCircleIcon } from "./Icons";

export interface SecurityEvent {
  type: string;
  node: string;
  status: string;
  message: string;
  timestamp: string;
}

interface SecurityPanelProps {
  isOpen: boolean;
  onClose: () => void;
  events?: SecurityEvent[];
  /** When true, the chat panel is open on the right — shrink the overlay to leave room for it. */
  chatOpen?: boolean;
}

type NodeStatus = "complete" | "active" | "pending" | "error";
type Tier = "agent" | "vault" | "verify";

interface TierNodeDef {
  id: string;
  tier: Tier;
  label: string;
  sublabel?: string;
  defaultCaption: string;
  Icon: ComponentType<SVGProps<SVGSVGElement>>;
}

interface Stage {
  id: string;
  number: number;
  title: string;
  nodes: TierNodeDef[];
}

const STAGES: Stage[] = [
  {
    id: "introspect",
    number: 1,
    title: "Introspect",
    nodes: [
      {
        id: "agent-introspect",
        tier: "agent",
        label: "Agent",
        sublabel: "Middleware",
        defaultCaption: "Validate session token",
        Icon: BotIcon,
      },
      {
        id: "vault-oidc",
        tier: "vault",
        label: "Vault",
        sublabel: "oidc-smt",
        defaultCaption: "OIDC client secret",
        Icon: KeyIcon,
      },
      {
        id: "verify-introspect",
        tier: "verify",
        label: "IBM Verify",
        sublabel: "/oauth2/introspect",
        defaultCaption: "Token validation",
        Icon: ShieldCheckIcon,
      },
    ],
  },
  {
    id: "exchange",
    number: 2,
    title: "Token Exchange",
    nodes: [
      {
        id: "agent-exchange",
        tier: "agent",
        label: "Agent",
        sublabel: "RFC 8693",
        defaultCaption: "Request scoped token",
        Icon: BotIcon,
      },
      {
        id: "vault-tokenex",
        tier: "vault",
        label: "Vault",
        sublabel: "token-exchange",
        defaultCaption: "Exchange client secret",
        Icon: KeyIcon,
      },
      {
        id: "verify-token",
        tier: "verify",
        label: "IBM Verify",
        sublabel: "/oauth2/token",
        defaultCaption: "RAR + policy eval",
        Icon: ShieldCheckIcon,
      },
    ],
  },
  {
    id: "stepup",
    number: 3,
    title: "Step-up MFA",
    nodes: [
      {
        id: "agent-hitl",
        tier: "agent",
        label: "Agent",
        sublabel: "Poll + assertion",
        defaultCaption: "Await push approval",
        Icon: BotIcon,
      },
      {
        id: "verify-push",
        tier: "verify",
        label: "IBM Verify",
        sublabel: "factors + push",
        defaultCaption: "Send + verify push",
        Icon: LockIcon,
      },
      {
        id: "vault-assertion",
        tier: "vault",
        label: "Vault",
        sublabel: "token-exchange",
        defaultCaption: "jwt-bearer credential",
        Icon: KeyIcon,
      },
    ],
  },
  {
    id: "execute",
    number: 4,
    title: "Execute",
    nodes: [
      {
        id: "agent-execute",
        tier: "agent",
        label: "Agent",
        sublabel: "Tool invoke",
        defaultCaption: "Call banking tool",
        Icon: BotIcon,
      },
      {
        id: "core-api",
        tier: "verify",
        label: "Core Banking",
        sublabel: "API",
        defaultCaption: "Execute with scoped token",
        Icon: DatabaseIcon,
      },
    ],
  },
];

interface LiveNode extends TierNodeDef {
  status: NodeStatus;
  caption: string;
}

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
  if (status === "error") {
    return <div className="w-4 h-4 rounded-full border-2 border-danger bg-danger/20" />;
  }
  return <div className="w-4 h-4 rounded-full border-2 border-navy-600" />;
}

function TierCard({ node, dimmed }: { node: LiveNode; dimmed?: boolean }) {
  const Icon = node.Icon;
  const isActive = node.status === "active";
  const isComplete = node.status === "complete";
  const isError = node.status === "error";

  return (
    <div
      className={`relative rounded-xl border-2 p-3 transition-all duration-500 ${
        dimmed
          ? "border-navy-800 bg-navy-900/40 opacity-40"
          : isError
          ? "border-danger bg-danger/10"
          : isActive
          ? "border-blue-electric bg-blue-electric/5 animate-node-glow"
          : isComplete
          ? "border-success/30 bg-success/5"
          : "border-navy-700 bg-navy-800/50"
      }`}
    >
      <div className="absolute -top-2 -right-2">
        <StatusDot status={node.status} />
      </div>

      <div className="flex items-center gap-2 mb-1.5">
        <div
          className={`w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 ${
            isError
              ? "bg-danger/20 text-danger"
              : isActive
              ? "bg-blue-electric/20 text-blue-electric"
              : isComplete
              ? "bg-success/20 text-success"
              : "bg-navy-700 text-navy-400"
          }`}
        >
          <Icon className="w-4 h-4" />
        </div>
        <div className="min-w-0 flex-1">
          <p
            className={`text-xs font-semibold leading-tight truncate ${
              isActive ? "text-white" : isComplete ? "text-navy-200" : isError ? "text-danger" : "text-navy-400"
            }`}
          >
            {node.label}
          </p>
          {node.sublabel && (
            <p className="text-[9px] text-navy-500 font-mono leading-tight truncate">{node.sublabel}</p>
          )}
        </div>
      </div>

      <p
        className={`text-[10px] leading-snug ${
          isActive ? "text-navy-300" : isError ? "text-danger/80" : "text-navy-500"
        }`}
      >
        {node.caption}
      </p>

      {isActive && (
        <div className="mt-1.5 h-0.5 w-full bg-navy-800 rounded-full overflow-hidden">
          <div className="h-full w-2/3 bg-blue-electric rounded-full animate-pulse" />
        </div>
      )}
    </div>
  );
}

/** Arrow connecting adjacent stages (or between tiers within a stage). */
function VerticalArrow({ active, dimmed }: { active?: boolean; dimmed?: boolean }) {
  const color = dimmed ? "#1E293B" : active ? "#3B82F6" : "#334155";
  return (
    <div className="flex justify-center h-5">
      <svg width="24" height="20" viewBox="0 0 24 20" className="overflow-visible">
        <line
          x1="12"
          y1="0"
          x2="12"
          y2="13"
          stroke={color}
          strokeWidth="2"
          strokeDasharray="4 3"
          className={active && !dimmed ? "animate-flow-dash" : ""}
        />
        <polygon points="7,12 12,20 17,12" fill={color} />
      </svg>
    </div>
  );
}

/**
 * Bypass arc — curved SVG path that arches from the top of Stage 2's column
 * over Stage 3 and down to the top of Stage 4's column. Rendered as an absolute
 * overlay above the stage grid.
 */
function BypassArc({ active, dimmed }: { active: boolean; dimmed: boolean }) {
  const color = dimmed ? "#1E293B" : active ? "#3B82F6" : "#334155";
  return (
    <div className="absolute inset-x-0 -top-2 h-16 pointer-events-none">
      <svg
        width="100%"
        height="100%"
        viewBox="0 0 100 40"
        preserveAspectRatio="none"
        className="overflow-visible"
      >
        {/* Curve from ~37.5% (middle of stage 2 col) to ~87.5% (middle of stage 4 col) */}
        <path
          d="M 37.5 38 Q 62.5 -14, 87.5 38"
          fill="none"
          stroke={color}
          strokeWidth="1.2"
          strokeDasharray="1.2 0.9"
          className={active && !dimmed ? "animate-flow-dash" : ""}
          vectorEffect="non-scaling-stroke"
        />
      </svg>
      {/* Label anchored over the arc's apex */}
      <div
        className="absolute left-[62.5%] -translate-x-1/2 top-0 text-[10px] font-mono"
        style={{ color }}
      >
        bypass · no step-up
      </div>
    </div>
  );
}

function StageColumn({
  stage,
  liveNodes,
  dimmed,
}: {
  stage: Stage;
  liveNodes: Record<string, LiveNode>;
  dimmed: boolean;
}) {
  const nodes = stage.nodes.map((def) => liveNodes[def.id] ?? { ...def, status: "pending" as NodeStatus, caption: def.defaultCaption });

  return (
    <div className={`flex flex-col gap-0 min-w-0 transition-opacity duration-500 ${dimmed ? "opacity-50" : "opacity-100"}`}>
      {/* Stage header */}
      <div className="mb-3 flex items-center gap-2">
        <div
          className={`w-6 h-6 rounded-md flex items-center justify-center text-[11px] font-bold ${
            dimmed ? "bg-navy-800 text-navy-600" : "bg-blue-electric/20 text-blue-electric"
          }`}
        >
          {stage.number}
        </div>
        <p className={`text-xs font-semibold ${dimmed ? "text-navy-600" : "text-white"}`}>{stage.title}</p>
      </div>

      {/* Tier cards with vertical arrows between */}
      {nodes.map((node, i) => {
        const prevActive = i > 0 ? nodes[i - 1].status === "complete" || nodes[i - 1].status === "active" : false;
        return (
          <div key={node.id}>
            {i > 0 && <VerticalArrow active={prevActive} dimmed={dimmed} />}
            <TierCard node={node} dimmed={dimmed} />
          </div>
        );
      })}
    </div>
  );
}

export default function SecurityPanel({ isOpen, onClose, events = [], chatOpen = false }: SecurityPanelProps) {
  const [visibleLogs, setVisibleLogs] = useState(0);
  const logRef = useRef<HTMLDivElement>(null);

  // Build a live node map from the event stream — last event per node wins.
  const liveNodes: Record<string, LiveNode> = {};
  for (const stage of STAGES) {
    for (const def of stage.nodes) {
      liveNodes[def.id] = {
        ...def,
        status: "pending",
        caption: def.defaultCaption,
      };
    }
  }
  for (const event of events) {
    const node = liveNodes[event.node];
    if (node) {
      node.status = (event.status as NodeStatus) || "pending";
      node.caption = event.message;
    }
  }

  // Bypass arc is active when stage 2 finished without HITL ever firing
  const stage2Nodes = STAGES[1].nodes.map((n) => liveNodes[n.id]);
  const stage3Nodes = STAGES[2].nodes.map((n) => liveNodes[n.id]);

  const stage2Complete = stage2Nodes.every((n) => n.status === "complete");
  const stage3Touched = stage3Nodes.some((n) => n.status === "active" || n.status === "complete" || n.status === "error");
  const bypassActive = stage2Complete && !stage3Touched;

  const logEntries = events.map((e) => ({
    time: new Date(e.timestamp).toLocaleTimeString("en-US", { hour12: false }),
    text: e.message,
    level: e.status === "complete" ? "success" : e.status === "error" ? "danger" : "info",
  }));

  // Progressive log reveal
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
      }, 250);
      return () => clearInterval(interval);
    }
  }, [isOpen, logEntries.length]);

  useEffect(() => {
    if (logRef.current) {
      logRef.current.scrollTop = logRef.current.scrollHeight;
    }
  }, [visibleLogs]);

  const hasLiveEvents = events.length > 0;

  return (
    <>
      {/* Backdrop — clipped to leave the chat panel (420px right edge) interactive when open */}
      <div
        className={`fixed top-0 bottom-0 left-0 bg-navy-950/80 backdrop-blur-sm z-30 transition-opacity duration-300 ${
          isOpen ? "opacity-100" : "opacity-0 pointer-events-none"
        }`}
        style={{ right: chatOpen ? "420px" : 0 }}
        onClick={onClose}
      />

      {/* Overlay — full-screen, or left of the chat panel when chat is open */}
      <div
        className={`fixed top-4 bottom-4 left-4 right-4 md:top-8 md:bottom-8 md:left-8 md:right-8 z-50 flex flex-col overflow-hidden rounded-2xl bg-navy-900 border border-navy-800 shadow-2xl transition-all duration-300 ease-out ${
          isOpen ? "opacity-100 scale-100" : "opacity-0 scale-95 pointer-events-none"
        }`}
        style={{ right: chatOpen ? "436px" : undefined }}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-navy-800 flex-shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-2 h-2 rounded-full bg-blue-electric animate-pulse" />
            <h2 className="text-sm font-semibold text-white">
              Security Flow — {hasLiveEvents ? "Live" : "Idle"}
            </h2>
            <div className="hidden md:flex items-center gap-3 ml-4 text-[10px] text-navy-500 font-mono">
              <span>
                <span className="text-blue-electric-light">●</span> agent
              </span>
              <span>
                <span className="text-gold">●</span> vault
              </span>
              <span>
                <span className="text-blue-electric-light">●</span> verify
              </span>
            </div>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-lg bg-navy-800 hover:bg-navy-700 flex items-center justify-center transition-colors"
          >
            <XIcon className="w-3.5 h-3.5 text-navy-400" />
          </button>
        </div>

        {/* Diagram */}
        <div className="flex-1 overflow-auto px-6 py-8">
          <div className="relative max-w-6xl mx-auto">
            {/* Bypass arc overlay */}
            <BypassArc active={bypassActive} dimmed={stage3Touched} />

            {/* Stage grid — horizontal connectors removed; bypass arc remains */}
            <div className="grid grid-cols-4 gap-x-6 pt-10">
              <StageColumn stage={STAGES[0]} liveNodes={liveNodes} dimmed={false} />
              <StageColumn stage={STAGES[1]} liveNodes={liveNodes} dimmed={false} />
              <StageColumn stage={STAGES[2]} liveNodes={liveNodes} dimmed={false} />
              <StageColumn stage={STAGES[3]} liveNodes={liveNodes} dimmed={false} />
            </div>
          </div>
        </div>

        {/* Log Panel */}
        <div className="mx-6 mb-4 rounded-xl bg-[#0C1220] border border-navy-800 overflow-hidden flex-shrink-0">
          <div className="px-3 py-2 border-b border-navy-800 flex items-center gap-2">
            <div className="flex gap-1.5">
              <div className="w-2 h-2 rounded-full bg-danger/60" />
              <div className="w-2 h-2 rounded-full bg-warning/60" />
              <div className="w-2 h-2 rounded-full bg-success/60" />
            </div>
            <span className="text-[10px] text-navy-500 font-mono ml-1">security-event-stream</span>
          </div>
          <div ref={logRef} className="p-3 font-mono text-[10px] space-y-1 max-h-[140px] min-h-[80px] overflow-y-auto">
            {logEntries.slice(0, visibleLogs).map((entry, i) => (
              <div key={i} className="animate-fade-in-up flex">
                <span className="text-navy-600 mr-2 flex-shrink-0">[{entry.time}]</span>
                <span
                  className={
                    entry.level === "success"
                      ? "text-success"
                      : entry.level === "danger"
                      ? "text-danger"
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
    </>
  );
}
