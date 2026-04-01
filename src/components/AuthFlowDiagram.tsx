"use client";

import { useEffect, useRef, useState } from "react";
import mermaid from "mermaid";
import { ShieldIcon } from "./Icons";

const SCENARIOS = [
  {
    id: "login",
    label: "User Login",
    color: "#3B82F6",
    description: "OAuth 2.0 Authorization Code Flow with IBM Verify + Vault secret rotation",
    diagram: `sequenceDiagram
    participant U as User (Browser)
    participant E as Edge Middleware
    participant N as Next.js (Vercel)
    participant V as HCP Vault
    participant IV as IBM Verify

    U->>E: GET / (no cookies)
    E->>E: Check access_token cookie
    E-->>U: 302 Redirect to /login
    U->>N: GET /login
    N-->>U: Login page rendered

    U->>N: Click Sign In — GET /api/auth/redirect
    N->>IV: 302 /oauth2/authorize
    Note over IV: scope: openid profile email agentic<br/>authorization_details: [{type: "environment"}]
    IV-->>U: IBM Verify login page
    U->>IV: Enter credentials
    IV-->>U: 302 /api/auth/callback?code=AUTH_CODE

    U->>N: GET /api/auth/callback?code=AUTH_CODE
    N->>V: getSecrets() — resolve Vault credential
    V->>V: GET /v1/ibm-verify/creds/oidc-smt
    V-->>N: client_secret (cached 1hr)
    N->>IV: POST /oauth2/token — grant_type=authorization_code

    alt CSIAQ0155E — stale Vault-rotated secret
        IV-->>N: Error CSIAQ0155E
        N->>N: invalidateSecretCache()
        N->>V: getSecrets() — fetch fresh secret
        V-->>N: new client_secret
        N->>IV: POST /oauth2/token (retry with new secret)
    end

    IV-->>N: access_token + id_token + refresh_token
    N->>N: parseIdToken — uniqueSecurityName
    N->>N: clearSession() + setAuthCookies()
    N-->>U: 302 to / with Set-Cookie: access_token, id_token

    U->>E: GET / (with cookies)
    E->>E: access_token present — allow
    E-->>N: NextResponse.next() + no-cache headers
    N->>N: Server Component reads cookies, init per-user data
    N-->>U: Dashboard rendered`,
  },
  {
    id: "balances",
    label: "Account Balances",
    color: "#22C55E",
    description: "Read-only tool call with token introspection and RAR token exchange",
    diagram: `sequenceDiagram
    participant U as User (Browser)
    participant N as Next.js (Vercel)
    participant V as HCP Vault
    participant IV as IBM Verify
    participant G as Gemini (LLM)

    U->>N: POST /api/agent/chat (SSE stream)
    Note over N: "What are my account balances?"

    Note over N: Guardrails: injection, off-topic, cross-user — all pass

    N->>V: getVaultSecret('GEMINI_API_KEY_SMT')
    V-->>N: Gemini API key
    N->>G: invoke() with system prompt + 6 tools
    G-->>N: tool_call: get_account_data

    Note over N,IV: MIDDLEWARE Step 1 — Token Introspection
    N->>V: getSecrets() — cached client_secret
    N->>IV: POST /oauth2/introspect — validate access_token
    IV-->>N: { active: true }
    N-->>U: SSE security:introspection — active

    Note over N,IV: MIDDLEWARE Step 2 — RAR Token Exchange
    N->>V: getSecrets() — cached
    N-->>U: SSE security:vault_fetch — complete
    N->>IV: POST /oauth2/token — grant_type=token-exchange
    Note over IV: scope=accounts:read
    IV-->>N: scoped access_token (accounts:read)
    N-->>U: SSE security:token_exchange — complete

    Note over N: Tool Execution
    N->>N: get_account_data() — in-memory store lookup
    N-->>U: SSE security:tool_execute — complete

    N->>G: Summarize tool output for user
    G-->>N: Friendly account summary
    N-->>U: SSE ai response + end`,
  },
  {
    id: "small-transfer",
    label: "Small Transfer ($50)",
    color: "#EAB308",
    description: "Transfer with RAR authorization_details — IBM Verify policy approves without step-up",
    diagram: `sequenceDiagram
    participant U as User (Browser)
    participant N as Next.js (Vercel)
    participant V as HCP Vault
    participant IV as IBM Verify
    participant G as Gemini (LLM)

    U->>N: POST /api/agent/chat (SSE stream)
    Note over N: "Transfer $50 from checking to savings"
    N->>N: Guardrails — all pass
    N->>G: invoke() with tools
    G-->>N: tool_call: transfer_funds(checking, savings, 50)

    Note over N,IV: MIDDLEWARE Step 1 — Token Introspection
    N->>IV: POST /oauth2/introspect
    IV-->>N: { active: true }

    Note over N: MIDDLEWARE Step 2 — Suspicious Activity Check
    N->>N: $50 is under $10,000 threshold — OK

    Note over N,IV: MIDDLEWARE Step 3 — RAR Token Exchange
    N->>V: getSecrets()
    V-->>N: client_secret
    N->>IV: POST /oauth2/token — grant_type=token-exchange
    Note over IV: scope=transfer:all<br/>authorization_details:<br/>[{type: transfer, amount: 50, currency: USD}]
    IV-->>N: scoped access_token (transfer:all)
    Note over IV: Policy engine: $50 — no step-up needed

    Note over N: Tool Execution
    N->>N: transfer_funds(checking to savings, $50)
    N-->>U: SSE security:tool_execute — complete
    N->>G: Summarize result
    G-->>N: Transfer confirmation
    N-->>U: SSE ai response + end`,
  },
  {
    id: "large-transfer",
    label: "Large Transfer ($5K)",
    color: "#EF4444",
    description: "Transfer triggers HITL push auth — user must approve on IBM Verify mobile app",
    diagram: `sequenceDiagram
    participant U as User (Browser)
    participant N as Next.js (Vercel)
    participant V as HCP Vault
    participant IV as IBM Verify
    participant G as Gemini (LLM)

    U->>N: POST /api/agent/chat (SSE stream)
    Note over N: "Transfer $5,000 from checking to savings"
    N->>N: Guardrails — all pass
    N->>G: invoke() with tools
    G-->>N: tool_call: transfer_funds(checking, savings, 5000)

    Note over N,IV: MIDDLEWARE Step 1 — Token Introspection
    N->>IV: POST /oauth2/introspect
    IV-->>N: { active: true }

    Note over N: MIDDLEWARE Step 2 — Suspicious Activity Check
    N->>N: $5,000 is under $10,000 — OK

    Note over N,IV: MIDDLEWARE Step 3 — RAR Token Exchange — MFA Challenge!
    N->>V: getSecrets()
    V-->>N: client_secret
    N->>IV: POST /oauth2/token — grant_type=token-exchange
    Note over IV: scope=transfer:all<br/>authorization_details:<br/>[{type: transfer, amount: 5000, currency: USD}]
    IV-->>N: { scope: mfa_challenge, access_token: mfa_token }
    Note over IV: Policy engine: $5,000 requires step-up auth!

    Note over N,IV: MIDDLEWARE Step 4 — HITL Push Authorization
    N->>IV: GET /v2.0/factors — list enrolled authenticators
    IV-->>N: factor: signature / userPresence
    N->>IV: POST /v1.0/authenticators/{id}/verifications
    Note over IV: Push: "Approve transfer of $5,000.00"
    IV-->>N: transactionUri
    N-->>U: SSE push_auth_pending — check your device
    IV-->>U: Push notification to mobile device

    loop Poll every 3s (max 50s — Vercel limit)
        N->>IV: GET /v1.0/authenticators/verifications/{id}
        N-->>U: SSE push_auth_polling (attempt N)
        IV-->>N: { state: PENDING }
    end

    alt User APPROVES on device
        U->>IV: Tap Approve on IBM Verify app
        N->>IV: GET /verifications/{id}
        IV-->>N: { state: VERIFY_SUCCESS, assertion: JWT }
        N-->>U: SSE push_auth_approved

        Note over N,IV: MIDDLEWARE Step 5 — Exchange assertion for scoped token
        N->>V: getSecrets()
        V-->>N: client_secret
        N->>IV: POST /oauth2/token — grant_type=jwt-bearer, assertion=JWT
        IV-->>N: scoped access_token (transfer:all)
        N-->>U: SSE security:hitl_result — complete
        Note over N: CAEP: assurance-level-change aal1 to aal2

        Note over N: Tool Execution
        N->>N: transfer_funds(checking to savings, $5,000)
        N->>G: Summarize result
        G-->>N: Transfer confirmation
        N-->>U: SSE ai response + end

    else User DENIES on device
        U->>IV: Tap Deny on IBM Verify app
        N->>IV: GET /verifications/{id}
        IV-->>N: { state: USER_DENIED }
        N-->>U: SSE push_auth_denied
        N-->>U: SSE security:hitl_result — error
        Note over N: CAEP: session-revoked — push auth denied
        N-->>U: SSE session_revoked — session terminated
    end`,
  },
];

export default function AuthFlowDiagram() {
  const [activeScenario, setActiveScenario] = useState(SCENARIOS[0].id);
  const containerRef = useRef<HTMLDivElement>(null);
  const [rendered, setRendered] = useState(false);

  useEffect(() => {
    mermaid.initialize({
      startOnLoad: false,
      theme: "dark",
      sequence: {
        diagramMarginX: 30,
        diagramMarginY: 20,
        actorMargin: 80,
        width: 180,
        height: 50,
        boxMargin: 10,
        boxTextMargin: 8,
        noteMargin: 12,
        messageMargin: 40,
        mirrorActors: true,
        useMaxWidth: false,
        wrap: true,
        wrapPadding: 15,
      },
      themeVariables: {
        noteBkgColor: "#1e293b",
        noteBorderColor: "#475569",
        noteTextColor: "#e2e8f0",
        actorBkg: "#1e293b",
        actorBorder: "#475569",
        actorTextColor: "#f1f5f9",
        signalColor: "#94a3b8",
        signalTextColor: "#e2e8f0",
        labelBoxBkgColor: "#1e293b",
        labelBoxBorderColor: "#475569",
        labelTextColor: "#e2e8f0",
        loopTextColor: "#e2e8f0",
        activationBorderColor: "#3b82f6",
        activationBkgColor: "#1e3a5f",
        sequenceNumberColor: "#f1f5f9",
      },
    });
    setRendered(true);
  }, []);

  useEffect(() => {
    if (!rendered || !containerRef.current) return;

    const scenario = SCENARIOS.find((s) => s.id === activeScenario);
    if (!scenario) return;

    const renderDiagram = async () => {
      const id = `mermaid-${scenario.id}-${Date.now()}`;
      try {
        const { svg } = await mermaid.render(id, scenario.diagram);
        if (containerRef.current) {
          containerRef.current.innerHTML = svg;
          // Make SVG responsive
          const svgEl = containerRef.current.querySelector("svg");
          if (svgEl) {
            svgEl.style.maxWidth = "100%";
            svgEl.style.height = "auto";
          }
        }
      } catch (err) {
        console.error("Mermaid render error:", err);
        // Clean up any orphaned render container
        const orphan = document.getElementById(id);
        orphan?.remove();
      }
    };

    renderDiagram();
  }, [activeScenario, rendered]);

  const active = SCENARIOS.find((s) => s.id === activeScenario)!;

  return (
    <div className="min-h-screen flex flex-col bg-navy-950">
      {/* Header */}
      <header className="border-b border-navy-800 px-8 py-5 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 bg-gold rounded-lg flex items-center justify-center">
            <ShieldIcon className="w-5 h-5 text-navy-950" />
          </div>
          <div>
            <h1 className="text-lg font-semibold text-white tracking-tight">
              DDR <span className="font-light text-navy-300">Bank</span>
              <span className="text-navy-500 font-normal text-sm ml-3">Authentication Flow</span>
            </h1>
          </div>
        </div>
        <a
          href="/"
          className="text-sm text-navy-400 hover:text-white transition-colors flex items-center gap-2"
        >
          <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
            <path d="M19 12H5" />
            <polyline points="12 19 5 12 12 5" />
          </svg>
          Back to Dashboard
        </a>
      </header>

      {/* Scenario Tabs */}
      <div className="border-b border-navy-800 px-8 py-4">
        <div className="flex gap-3 flex-wrap">
          {SCENARIOS.map((scenario) => (
            <button
              key={scenario.id}
              onClick={() => setActiveScenario(scenario.id)}
              className={`group relative flex items-center gap-2.5 px-5 py-2.5 rounded-xl text-sm font-medium transition-all duration-200 ${
                activeScenario === scenario.id
                  ? "bg-navy-800 text-white shadow-lg"
                  : "bg-navy-900 text-navy-400 hover:text-navy-200 hover:bg-navy-800/60"
              }`}
            >
              <span
                className="w-2.5 h-2.5 rounded-full shrink-0"
                style={{
                  backgroundColor: scenario.color,
                  boxShadow: activeScenario === scenario.id ? `0 0 8px ${scenario.color}60` : "none",
                }}
              />
              {scenario.label}
              {activeScenario === scenario.id && (
                <span
                  className="absolute bottom-0 left-1/2 -translate-x-1/2 translate-y-[calc(100%+1rem)] w-0 h-0 border-l-[6px] border-r-[6px] border-t-[6px] border-transparent"
                  style={{ borderTopColor: scenario.color }}
                />
              )}
            </button>
          ))}
        </div>
      </div>

      {/* Scenario description */}
      <div className="px-8 py-4 border-b border-navy-800/50">
        <div className="flex items-start gap-3">
          <span
            className="mt-0.5 w-3 h-3 rounded-full shrink-0"
            style={{ backgroundColor: active.color }}
          />
          <div>
            <p className="text-sm text-navy-300">{active.description}</p>
          </div>
        </div>
      </div>

      {/* Diagram */}
      <div className="flex-1 overflow-auto p-8">
        <div
          ref={containerRef}
          className="flex justify-center min-w-[800px]"
        />
      </div>

      {/* Footer legend */}
      <footer className="border-t border-navy-800 px-8 py-3 flex items-center justify-between text-[11px] text-navy-600">
        <div className="flex gap-6">
          <span className="flex items-center gap-1.5">
            <svg className="w-3 h-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}><path d="M21 2l-2 2m-7.61 7.61a5.5 5.5 0 1 1-7.778 7.778 5.5 5.5 0 0 1 7.777-7.777zm0 0L15.5 7.5m0 0l3 3L22 7l-3-3m-3.5 3.5L19 4" /></svg>
            HashiCorp Vault
          </span>
          <span className="flex items-center gap-1.5">
            <ShieldIcon className="w-3 h-3" />
            IBM Verify
          </span>
          <span className="flex items-center gap-1.5">
            <svg className="w-3 h-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}><circle cx="12" cy="12" r="10" /><path d="M12 6v6l4 2" /></svg>
            Gemini 2.5 Flash
          </span>
        </div>
        <span>Agentic AI Runtime Security Demo</span>
      </footer>
    </div>
  );
}
