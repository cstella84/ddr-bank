import { introspectToken } from '@/lib/server/vault';
import { resolveAccount } from '@/lib/server/data-store';
import { TOOL_SCOPES } from './tools';
import { exchangeToken } from './token-exchange';
import { triggerHITL, pollHITLStatus, exchangeHITLAssertion } from './hitl';
import { emitSessionRevoked } from './caep';
import type { SecurityEvent } from '@/components/SecurityPanel';

type SendFn = (data: Record<string, unknown>) => void;

interface MiddlewareContext {
  sessionId: string;
  accessToken: string;
  email: string;
  verifyUserId: string | null;
  send: SendFn;
}

function emitSecurityEvent(send: SendFn, event: Omit<SecurityEvent, 'timestamp'>) {
  const { type: eventType, ...rest } = event;
  send({
    ...rest,
    type: `security:${eventType}`,
    timestamp: new Date().toISOString(),
  });
}

/**
 * Pre-tool-call middleware. Runs before every tool execution.
 * Handles: token introspection, suspicious activity guard, RAR token exchange, HITL.
 *
 * Returns the scoped token if authorization succeeds, or throws if blocked.
 */
export async function preToolCallMiddleware(
  toolName: string,
  toolArgs: Record<string, unknown>,
  ctx: MiddlewareContext
): Promise<string | null> {
  const { sessionId, accessToken, email, verifyUserId, send } = ctx;

  // === 1. TOKEN INTROSPECTION ===
  // Stage 1 has three tiers: agent-introspect, vault-oidc, verify-introspect
  emitSecurityEvent(send, {
    type: 'introspection',
    node: 'agent-introspect',
    status: 'active',
    message: `Agent validating session for ${toolName}`,
  });
  emitSecurityEvent(send, {
    type: 'vault_fetch_oidc',
    node: 'vault-oidc',
    status: 'active',
    message: 'Fetching oidc-smt client secret',
  });

  try {
    const introspection = await introspectToken(accessToken);

    emitSecurityEvent(send, {
      type: 'vault_fetch_oidc',
      node: 'vault-oidc',
      status: 'complete',
      message: 'oidc-smt secret retrieved',
    });

    emitSecurityEvent(send, {
      type: 'introspection',
      node: 'verify-introspect',
      status: 'active',
      message: 'POST /oauth2/introspect',
    });

    if (!(introspection as Record<string, unknown>).active) {
      emitSecurityEvent(send, {
        type: 'introspection',
        node: 'verify-introspect',
        status: 'error',
        message: 'Token inactive — session revoked',
      });
      emitSecurityEvent(send, {
        type: 'introspection',
        node: 'agent-introspect',
        status: 'error',
        message: 'Session revoked',
      });

      await emitSessionRevoked(email, verifyUserId, {
        reasonAdmin: { en: `Token introspection inactive for tool: ${toolName}` },
        reasonUser: { en: 'Your session has expired or been revoked' },
        initiatingEntity: 'system',
      });

      send({
        role: 'ai',
        content: 'Your session has expired. Please sign in again.',
        type: 'session_revoked',
      });
      throw new Error('Session expired or revoked');
    }

    emitSecurityEvent(send, {
      type: 'introspection',
      node: 'verify-introspect',
      status: 'complete',
      message: 'Token validated — session active',
    });
    emitSecurityEvent(send, {
      type: 'introspection',
      node: 'agent-introspect',
      status: 'complete',
      message: 'Session active',
    });
  } catch (err) {
    if ((err as Error).message === 'Session expired or revoked') throw err;
    console.warn('[Introspection] Error (failing open):', (err as Error).message);
  }

  // === 2. SUSPICIOUS ACTIVITY GUARD (transfers to external accounts) ===
  if (toolName === 'transfer_funds') {
    const toAccountId = String(toolArgs.toAccountId ?? '');
    const toAccount = resolveAccount(sessionId, toAccountId);
    if (!toAccount) {
      const amount = parseFloat(String(toolArgs.amount)) || 0;
      emitSecurityEvent(send, {
        type: 'suspicious_activity',
        node: 'agent-exchange',
        status: 'error',
        message: `Suspicious transfer to "${toAccountId}" — session revoked`,
      });

      await emitSessionRevoked(email, verifyUserId, {
        reasonAdmin: {
          en: `Suspicious: transfer of $${amount} to unrecognized external account "${toAccountId}"`,
        },
        reasonUser: {
          en: `Your session has been terminated due to a suspicious transfer attempt to an external account.`,
        },
        initiatingEntity: 'policy',
      });

      send({
        role: 'ai',
        content: `Suspicious activity detected — a transfer to an external account ("${toAccountId}") was attempted. Your session has been revoked.`,
        type: 'session_revoked',
      });
      throw new Error('Suspicious activity — session revoked');
    }
  }

  // === 3. RAR TOKEN EXCHANGE ===
  // Stage 2 has three tiers: agent-exchange, vault-tokenex, verify-token
  const requiredScope = TOOL_SCOPES[toolName];
  if (!requiredScope) return null;

  emitSecurityEvent(send, {
    type: 'token_exchange',
    node: 'agent-exchange',
    status: 'active',
    message: `Requesting scope: ${requiredScope}`,
  });
  emitSecurityEvent(send, {
    type: 'vault_fetch_tokenex',
    node: 'vault-tokenex',
    status: 'active',
    message: 'Fetching token-exchange client secret',
  });

  try {
    const amount = toolName === 'transfer_funds' ? parseFloat(String(toolArgs.amount)) : undefined;
    const tokenResult = await exchangeToken(accessToken, requiredScope, amount);

    emitSecurityEvent(send, {
      type: 'vault_fetch_tokenex',
      node: 'vault-tokenex',
      status: 'complete',
      message: 'token-exchange secret retrieved',
    });
    emitSecurityEvent(send, {
      type: 'token_exchange',
      node: 'verify-token',
      status: 'active',
      message: 'RFC 8693 token-exchange',
    });
    emitSecurityEvent(send, {
      type: 'token_exchange',
      node: 'verify-token',
      status: 'complete',
      message: `Scoped token issued: ${requiredScope}`,
    });
    emitSecurityEvent(send, {
      type: 'token_exchange',
      node: 'agent-exchange',
      status: 'complete',
      message: `Received scoped token`,
    });

    return tokenResult.access_token;
  } catch (err: unknown) {
    // HITL required — IBM Verify returned mfa_challenge
    if ((err as any)?.mfaChallenge) {
      // Stage 2 completes (exchange succeeded — the mfa_challenge is a valid response)
      emitSecurityEvent(send, {
        type: 'vault_fetch_tokenex',
        node: 'vault-tokenex',
        status: 'complete',
        message: 'token-exchange secret retrieved',
      });
      emitSecurityEvent(send, {
        type: 'token_exchange',
        node: 'verify-token',
        status: 'complete',
        message: 'Policy returned mfa_challenge',
      });
      emitSecurityEvent(send, {
        type: 'token_exchange',
        node: 'agent-exchange',
        status: 'complete',
        message: 'Step-up required',
      });

      // Stage 3: HITL push auth
      emitSecurityEvent(send, {
        type: 'hitl_triggered',
        node: 'agent-hitl',
        status: 'active',
        message: 'Polling for push approval',
      });
      emitSecurityEvent(send, {
        type: 'hitl_triggered',
        node: 'verify-push',
        status: 'active',
        message: 'POST /authenticators/{id}/verifications',
      });

      const mfaToken = (err as any).mfaToken;
      const amount = parseFloat(String(toolArgs.amount)) || 0;

      const { transactionUri } = await triggerHITL(
        mfaToken,
        amount,
        email,
        verifyUserId,
        send
      );

      const result = await pollHITLStatus(
        transactionUri,
        mfaToken,
        email,
        verifyUserId,
        send
      );

      if (result.approved && result.assertion) {
        emitSecurityEvent(send, {
          type: 'hitl_result',
          node: 'verify-push',
          status: 'complete',
          message: 'User approved push',
        });
        // Assertion exchange reuses the token-exchange secret (cached)
        emitSecurityEvent(send, {
          type: 'vault_fetch_assertion',
          node: 'vault-assertion',
          status: 'active',
          message: 'Using token-exchange secret for jwt-bearer',
        });
        emitSecurityEvent(send, {
          type: 'vault_fetch_assertion',
          node: 'vault-assertion',
          status: 'complete',
          message: 'token-exchange secret (cached)',
        });
        emitSecurityEvent(send, {
          type: 'hitl_result',
          node: 'agent-hitl',
          status: 'complete',
          message: 'Exchanging assertion → scoped token',
        });

        const scopedToken = await exchangeHITLAssertion(result.assertion, requiredScope);
        return scopedToken;
      }

      // HITL denied — revoke session
      emitSecurityEvent(send, {
        type: 'hitl_result',
        node: 'verify-push',
        status: 'error',
        message: 'Push denied or timed out',
      });
      emitSecurityEvent(send, {
        type: 'hitl_result',
        node: 'agent-hitl',
        status: 'error',
        message: 'Authorization failed — session revoked',
      });

      await emitSessionRevoked(email, verifyUserId, {
        reasonAdmin: { en: `Push auth denied for transfer of $${toolArgs.amount}` },
        reasonUser: { en: 'Your session has been terminated because the transfer was denied.' },
        initiatingEntity: 'policy',
      });

      send({
        role: 'ai',
        content: 'Transfer authorization was denied. Your session has been revoked.',
        type: 'session_revoked',
      });

      const deniedErr = new Error('HITL denied');
      (deniedErr as any).hitlDenied = true;
      throw deniedErr;
    }

    emitSecurityEvent(send, {
      type: 'token_exchange',
      node: 'verify-token',
      status: 'error',
      message: `Token exchange failed: ${(err as Error).message}`,
    });
    throw err;
  }
}
