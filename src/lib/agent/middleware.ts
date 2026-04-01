import { introspectToken } from '@/lib/server/vault';
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
  emitSecurityEvent(send, {
    type: 'introspection',
    node: 'verify',
    status: 'active',
    message: `Validating session token for ${toolName}...`,
  });

  try {
    const introspection = await introspectToken(accessToken);
    if (!(introspection as Record<string, unknown>).active) {
      emitSecurityEvent(send, {
        type: 'introspection',
        node: 'verify',
        status: 'error',
        message: 'Token introspection returned inactive — session revoked',
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
      node: 'verify',
      status: 'complete',
      message: 'Token validated — session is active',
    });
  } catch (err) {
    if ((err as Error).message === 'Session expired or revoked') throw err;
    console.warn('[Introspection] Error (failing open):', (err as Error).message);
  }

  // === 2. SUSPICIOUS ACTIVITY GUARD (transfers > $10k) ===
  if (toolName === 'transfer_funds') {
    const amount = parseFloat(String(toolArgs.amount)) || 0;
    if (amount > 10000) {
      emitSecurityEvent(send, {
        type: 'suspicious_activity',
        node: 'agent',
        status: 'error',
        message: `Suspicious transfer of $${amount.toLocaleString()} — session revoked`,
      });

      await emitSessionRevoked(email, verifyUserId, {
        reasonAdmin: {
          en: `Suspicious: transfer of $${amount} exceeds $10,000 threshold`,
        },
        reasonUser: {
          en: `Your session has been terminated due to a suspicious transfer attempt of $${amount.toLocaleString()}.`,
        },
        initiatingEntity: 'policy',
      });

      send({
        role: 'ai',
        content: `Suspicious activity detected — a transfer of $${amount.toLocaleString()} was attempted. Your session has been revoked.`,
        type: 'session_revoked',
      });
      throw new Error('Suspicious activity — session revoked');
    }
  }

  // === 3. RAR TOKEN EXCHANGE ===
  const requiredScope = TOOL_SCOPES[toolName];
  if (!requiredScope) return null;

  emitSecurityEvent(send, {
    type: 'token_exchange',
    node: 'verify',
    status: 'active',
    message: `Requesting scoped token: ${requiredScope}`,
  });

  emitSecurityEvent(send, {
    type: 'vault_fetch',
    node: 'vault',
    status: 'active',
    message: 'Fetching client credentials from Vault...',
  });

  try {
    const amount = toolName === 'transfer_funds' ? parseFloat(String(toolArgs.amount)) : undefined;
    const tokenResult = await exchangeToken(accessToken, requiredScope, amount);

    emitSecurityEvent(send, {
      type: 'vault_fetch',
      node: 'vault',
      status: 'complete',
      message: 'Client credentials retrieved from Vault',
    });

    emitSecurityEvent(send, {
      type: 'token_exchange',
      node: 'verify',
      status: 'complete',
      message: `Scoped token issued: ${requiredScope}`,
    });

    return tokenResult.access_token;
  } catch (err: unknown) {
    // HITL required — IBM Verify returned mfa_challenge
    if ((err as any)?.mfaChallenge) {
      emitSecurityEvent(send, {
        type: 'hitl_triggered',
        node: 'verify',
        status: 'active',
        message: 'Step-up authorization required — sending push notification',
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
          node: 'verify',
          status: 'complete',
          message: 'Push authorization approved — exchanging assertion for scoped token',
        });

        const scopedToken = await exchangeHITLAssertion(result.assertion, requiredScope);
        return scopedToken;
      }

      // HITL denied — revoke session
      emitSecurityEvent(send, {
        type: 'hitl_result',
        node: 'verify',
        status: 'error',
        message: 'Push authorization denied — session revoked',
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
      node: 'verify',
      status: 'error',
      message: `Token exchange failed: ${(err as Error).message}`,
    });
    throw err;
  }
}
