"use client";

import { useEffect, useRef, useState } from "react";
import mermaid from "mermaid";
import { ShieldIcon } from "./Icons";

const SCENARIOS = [
  {
    id: "login",
    label: "User Login",
    color: "#3B82F6",
    description: "OAuth 2.0 Authorization Code Flow with PKCE, IBM Verify + Vault dynamic client secret",
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
    Note over N: Generate PKCE: code_verifier (random) + code_challenge (S256)<br/>Set httpOnly pkce_verifier cookie (5 min TTL)
    N->>IV: 302 /oauth2/authorize
    Note over IV: scope: openid profile email agentic<br/>code_challenge_method=S256<br/>authorization_details: [{type: "environment"}]
    IV-->>U: IBM Verify login page
    U->>IV: Enter credentials
    IV-->>U: 302 /api/auth/callback?code=AUTH_CODE

    U->>N: GET /api/auth/callback?code=AUTH_CODE
    Note over N: Read pkce_verifier from cookie
    N->>V: getSecrets() — resolve oidc-smt credential
    V->>V: GET /v1/ibm-verify/creds/oidc-smt
    V-->>N: client_secret (cached 1hr)
    N->>IV: POST /oauth2/token<br/>grant_type=authorization_code + code_verifier (PKCE)

    alt CSIAQ0155E — stale Vault-rotated secret
        IV-->>N: Error CSIAQ0155E
        N->>N: invalidateSecretCache()
        N->>V: getSecrets() — fetch fresh secret
        V-->>N: new client_secret
        N->>IV: POST /oauth2/token (retry with new secret)
    end

    IV-->>N: access_token + id_token
    N->>N: parseIdToken — extract uniqueSecurityName claim
    N->>N: clearSession(uniqueSecurityName) — drop stale agent state
    N->>N: setAuthCookies() — access_token, id_token (httpOnly)
    N->>N: delete pkce_verifier cookie
    N-->>U: 302 to / with Set-Cookie

    U->>E: GET / (with cookies)
    E->>E: access_token present — allow
    E-->>N: NextResponse.next() + no-cache headers
    N->>N: Server Component reads cookies, initializes per-user data store
    N-->>U: Dashboard rendered`,
  },
  {
    id: "balances",
    label: "Account Balances",
    color: "#22C55E",
    description: "Read-only tool call — introspection + RAR token exchange, no step-up (bypass path)",
    diagram: `sequenceDiagram
    participant U as User (Browser)
    participant N as Next.js (Vercel)
    participant V as HCP Vault
    participant IV as IBM Verify
    participant G as Gemini (LLM)

    U->>N: POST /api/agent/chat (SSE stream)
    Note over N: "What are my account balances?"

    Note over N: Guardrails: injection, off-topic, cross-user — all pass
    Note over N,G: Gemini API key cached at module level<br/>(Vault GEMINI_API_KEY_SMT, fetched once on cold start)
    N->>G: invoke() with system prompt + 6 tools
    G-->>N: tool_call: get_account_data

    Note over N,IV: STAGE 1 — Token Introspection
    N->>V: getSecrets() — oidc-smt
    V-->>N: client_secret (cached)
    N-->>U: SSE security:vault_fetch_oidc — complete
    N->>IV: POST /oauth2/introspect — validate access_token
    IV-->>N: { active: true }
    N-->>U: SSE security:introspection — complete

    Note over N,IV: STAGE 2 — RAR Token Exchange (no HITL — bypass path)
    N->>V: getExchangeSecret() — token-exchange
    V-->>N: client_secret (cached)
    N-->>U: SSE security:vault_fetch_tokenex — complete
    N->>IV: POST /oauth2/token<br/>grant_type=urn:ietf:params:oauth:grant-type:token-exchange<br/>scope=accounts:read
    IV-->>N: scoped access_token (accounts:read)
    N-->>U: SSE security:token_exchange — complete

    Note over N: STAGE 4 — Tool Execution
    N->>N: get_account_data() — in-memory store lookup
    N-->>U: SSE security:tool_execute — complete

    N->>G: Summarize tool output for user
    G-->>N: Friendly account summary
    N-->>U: SSE delta + end`,
  },
  {
    id: "small-transfer",
    label: "Small Transfer ($50)",
    color: "#EAB308",
    description: "Transfer under user's agenticlimit — IBM Verify policy issues scoped token without step-up",
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

    Note over N,IV: STAGE 1 — Token Introspection
    N->>V: getSecrets() — oidc-smt (cached)
    N->>IV: POST /oauth2/introspect
    IV-->>N: { active: true }

    Note over N: SUSPICIOUS ACTIVITY GUARD
    N->>N: resolveAccount(toAccountId) — known internal account?
    Note over N: "savings" is a known account → pass<br/>(unknown destinations would revoke session)

    Note over N,IV: STAGE 2 — RAR Token Exchange
    N->>V: getExchangeSecret() — token-exchange (cached)
    N->>IV: POST /oauth2/token — grant_type=token-exchange
    Note over IV: scope=transfer:all<br/>authorization_details: [{type:"transfer_funds",<br/>instructedAmount:{amount:"50",currency:"USD"}}]
    Note over IV: Policy: int(amount=50) >= agenticlimit(1000)?<br/>FALSE → no step-up required (bypass path)
    IV-->>N: scoped access_token (transfer:all)

    Note over N: STAGE 4 — Tool Execution
    N->>N: transferFunds(checking → savings, $50)
    N-->>U: SSE security:tool_execute — complete
    N-->>U: SSE data_updated (refresh dashboard)
    N->>G: Summarize result
    G-->>N: Transfer confirmation
    N-->>U: SSE delta + end`,
  },
  {
    id: "large-transfer",
    label: "Large Transfer ($5K) — HITL",
    color: "#EF4444",
    description: "Transfer over agenticlimit triggers IBM Verify push auth — approve or session is revoked",
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

    Note over N,IV: STAGE 1 — Token Introspection
    N->>V: getSecrets() — oidc-smt (cached)
    N->>IV: POST /oauth2/introspect
    IV-->>N: { active: true }

    Note over N: SUSPICIOUS ACTIVITY GUARD
    N->>N: "savings" is internal — pass

    Note over N,IV: STAGE 2 — RAR Token Exchange — MFA Challenge!
    N->>V: getExchangeSecret() — token-exchange (cached)
    N->>IV: POST /oauth2/token — grant_type=token-exchange
    Note over IV: scope=transfer:all<br/>authorization_details: [{type:"transfer_funds",<br/>instructedAmount:{amount:"5000",currency:"USD"}}]
    Note over IV: Policy: int(amount=5000) >= agenticlimit(1000)?<br/>TRUE → step-up required
    IV-->>N: { scope:"mfa_challenge", access_token: mfa_challenge_token }

    Note over N,IV: STAGE 3 — HITL Push Authorization
    N->>IV: GET /v2.0/factors (Bearer mfa_challenge_token)
    IV-->>N: factors[] — find type=signature, subType=userPresence
    N->>IV: POST /v1.0/authenticators/{id}/verifications
    Note over IV: pushNotification.message: "Approve transfer of $5,000.00"<br/>expiresIn: 120s
    IV-->>N: { transactionUri }
    N-->>U: SSE push_auth_pending — check your device
    IV-->>U: Push notification to mobile device

    loop Poll every 3s (max 50s — under Vercel 60s limit)
        N->>IV: GET {transactionUri}?returnJwt=true
        N-->>U: SSE push_auth_polling (attempt N)
        IV-->>N: { state: "PENDING" }
    end

    alt User APPROVES on device
        U->>IV: Tap Approve on IBM Verify app
        N->>IV: GET {transactionUri}?returnJwt=true
        IV-->>N: { state: "VERIFY_SUCCESS", assertion: JWT }
        N-->>U: SSE push_auth_approved
        Note over N: CAEP: assurance-level-change aal1 → aal2

        Note over N,IV: STAGE 3 (cont.) — Exchange assertion for scoped token
        Note over N: Reuses cached token-exchange secret (no new Vault fetch)
        N-->>U: SSE security:vault_fetch_assertion — complete
        N->>IV: POST /oauth2/token<br/>grant_type=urn:ietf:params:oauth:grant-type:jwt-bearer<br/>assertion=JWT, scope=transfer:all
        IV-->>N: scoped access_token (transfer:all)
        N-->>U: SSE security:hitl_result — complete

        Note over N: STAGE 4 — Tool Execution
        N->>N: transferFunds(checking → savings, $5,000)
        N-->>U: SSE security:tool_execute — complete
        N-->>U: SSE data_updated (refresh dashboard)
        N->>G: Summarize result
        G-->>N: Transfer confirmation
        N-->>U: SSE delta + end

    else User DENIES (or push expires)
        U->>IV: Tap Deny on IBM Verify app
        N->>IV: GET {transactionUri}?returnJwt=true
        IV-->>N: { state: "USER_DENIED" }
        N-->>U: SSE push_auth_denied (poll exits immediately on deny)
        Note over N: CAEP: session-revoked — push auth denied
        N-->>U: SSE session_revoked
        Note over U: Client auto-redirects to /api/auth/logout after 2s<br/>Token revoked at IBM Verify, cookies cleared, full logout
    end`,
  },
  {
    id: "reports-mfa",
    label: "Reports (Email OTP)",
    color: "#A855F7",
    description: "Sensitive report tool — gated by email OTP MFA via the agentic-api Vault credential",
    diagram: `sequenceDiagram
    participant U as User (Browser)
    participant N as Next.js (Vercel)
    participant V as HCP Vault
    participant IV as IBM Verify
    participant G as Gemini (LLM)

    Note over U,G: Two-message flow: trigger MFA → user enters code → resume

    U->>N: POST /api/agent/chat — "show me the quarterly report"
    N->>N: Guardrails — all pass
    N->>G: invoke()
    G-->>N: tool_call: get_report_data

    Note over N,IV: STAGE 1 — Token Introspection (passes)
    Note over N,IV: STAGE 2 — RAR Token Exchange (scope=reports:read, passes)

    Note over N: MFA gate: get_report_data requires email OTP step-up
    N->>V: getVaultSecret('agentic-api', 'client_id')
    N->>V: getVaultSecret('agentic-api', 'client_secret')
    V-->>N: agentic-api credentials (cached 1hr)
    N->>IV: POST /v1.0/endpoint/default/token<br/>grant_type=client_credentials
    IV-->>N: api_token (for MFA admin endpoints)
    N->>IV: POST /v2.0/factors/emailotp/transient/verifications<br/>{ emailAddress, correlation: "Agentic" }
    IV-->>N: { id: pendingMFAId }
    IV-->>U: 📧 Email with 6-digit OTP (correlation prefix "Agentic-")
    N->>N: pendingMFA.set(sessionId, {id})
    N-->>U: SSE delta — "Enter the 6-digit code from your email"
    Note over N: Original tool call paused — chat history retains the request

    U->>N: POST /api/agent/chat — "Agentic-123456"
    N->>N: hasPendingMFA(sessionId) === true → validateMFA branch
    N->>IV: POST /v2.0/factors/emailotp/transient/verifications/{id}?returnJwt=true<br/>Bearer api_token, body: { otp }

    alt Code valid
        IV-->>N: 200 OK
        N->>N: pendingMFA.delete(sessionId)
        Note over N: CAEP: assurance-level-change aal1 → aal2
        N-->>U: SSE delta — "MFA verified! Fetching report data now..."

        Note over N: Resume original request — fall through to tool execution
        N->>N: get_report_data() — in-memory lookup
        N->>G: Summarize report
        G-->>N: Report summary
        N-->>U: SSE delta + end

    else Code invalid
        IV-->>N: 4xx error
        Note over N: CAEP: assurance-level unchanged (aal1)
        N-->>U: SSE delta — "Invalid MFA code. Please try again."
        N-->>U: end (pendingMFA still set — user can retry)
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
              CDL <span className="font-light text-navy-300">Bank</span>
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
