@AGENTS.md

# DDR Bank — Agentic Runtime Security Demo

## What This App Is

A SaaS demo banking application showcasing agentic runtime security using IBM Verify + HCP Vault. Built with Next.js 16 (App Router), deployed to Vercel. Multiple concurrent users access it during demos.

## Architecture

```
Browser → Next.js (Vercel) → IBM Verify (OIDC, token exchange, MFA, push auth)
                            → HCP Vault (secrets management)
                            → Google Gemini (LLM via LangChain)
                            → Antenna (CAEP/SSF events, optional)
```

- **Auth**: OAuth 2.0 Authorization Code Flow via IBM Verify OIDC
- **Secrets**: HCP Vault with IBM Verify plugin for dynamic OIDC secret rotation
- **Agent**: LangChain + Gemini 2.5 Flash with 6 embedded DynamicStructuredTools
- **Data**: Per-user in-memory state (no database) — Map keyed by `uniqueSecurityName` from ID token
- **Streaming**: Server-Sent Events (SSE) via ReadableStream in Route Handlers
- **Security**: Per-tool RAR token exchange, MFA (email OTP), HITL (push auth, 50s timeout), guardrails, abuse detection

## Key Directories

```
src/
  app/
    page.tsx                    # Server Component — reads cookies, initializes session
    login/page.tsx              # Login page with IBM Verify redirect
    api/auth/                   # redirect, callback, logout routes
    api/agent/                  # chat (SSE streaming), clear routes
  lib/
    server/
      vault.ts                  # Vault client, getSecrets(), introspectToken()
      auth.ts                   # Cookie/JWT helpers, parseIdToken()
      data-store.ts             # Per-session in-memory store (accounts, transactions, etc.)
    agent/
      index.ts                  # runAgent() — main entry point
      tools.ts                  # 6 DynamicStructuredTools + TOOL_SCOPES
      middleware.ts             # Pre-tool: introspection, suspicious activity, RAR, HITL
      token-exchange.ts         # RFC 8693 token exchange with authorization_details
      hitl.ts                   # Push auth trigger/poll/assertion exchange
      mfa.ts                    # Email OTP trigger/validate
      guardrails.ts             # Injection, off-topic, cross-user detection
      abuse.ts                  # Violation tracking, session revocation
      caep.ts                   # CAEP event emission (Antenna + webhook)
      sessions.ts               # Agent session Map (chat history, state)
      system-prompt.ts          # SEDA system prompt
    hooks/
      useChat.ts                # Client SSE consumer, message state, push auth state
  components/
    DashboardShell.tsx          # Client boundary — manages chat/security panel state
    ChatPanel.tsx               # Chat UI with SSE streaming, push auth cards
    SecurityPanel.tsx           # Live security flow visualization
    Dashboard.tsx               # Account cards, transactions (accepts props)
    Navbar.tsx                  # Dynamic user info, logout
middleware.ts                   # Edge Middleware — route protection via access_token cookie
```

## Important Patterns

- **CSIAQ0155E retry**: When IBM Verify returns this error code, it means the Vault-rotated client secret is stale. Invalidate the cache and retry once with a fresh secret. This pattern appears in callback, logout, introspectToken, and token exchange.
- **Server/Client split**: `page.tsx` is a Server Component that reads cookies and fetches data. `DashboardShell.tsx` is the client boundary.
- **Security events**: The agent middleware emits `security:*` SSE events that flow from agent → useChat hook → DashboardShell → SecurityPanel for live visualization.
- **Tool authorization flow**: Every tool call goes through `preToolCallMiddleware()` → introspection → suspicious activity check → RAR token exchange → (possibly HITL) → tool execution.
- **Session revocation**: Triggers include: inactive token, suspicious transfer (>$10K), HITL denied, abuse threshold (5 violations). All emit CAEP session-revoked events.

## Environment Variables

See `.env.example` for the full list. Key ones:
- `OIDC_BASE_URI`, `OIDC_CLIENT_ID`, `REDIRECT_URI` — IBM Verify OIDC
- `VAULT_BASE_URI`, `VAULT_KEY` — HCP Vault
- `GEMINI_API_KEY` — Fallback; production reads from Vault
- `AGENTIC_API_ID`, `AGENTIC_API_SECRET` — IBM Verify API (MFA/HITL)
- `AUTH_METHOD=environment` — Authorization details type for RAR

## Derived From

This app derives concepts from two sibling repos:
- `../AgenticAiDemo-live` — SvelteKit version with full agent, SPIFFE auth, FIDO2
- `../ibm-verify-login` — Original IBM Verify OIDC login demo

## Tech Stack

- Next.js 16 (App Router, Server Components)
- TypeScript
- Tailwind CSS v4
- LangChain (@langchain/core, @langchain/google-genai)
- @hashicorp/vault-runtime-credential-sdk
- Deployed to Vercel (60s serverless limit, no persistent processes)
