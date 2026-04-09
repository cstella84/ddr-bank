import { getExchangeSecret } from './token-exchange';
import { emitAssuranceLevelChange, emitSessionRevoked } from './caep';

type SendFn = (data: Record<string, unknown>) => void;

const HITL_TIMEOUT_MS = 50_000; // 50 seconds (under Vercel's 60s limit)
const POLL_INTERVAL_MS = 3_000;

interface HITLResult {
  approved: boolean;
  assertion?: string;
}

/**
 * Trigger HITL push auth via IBM Verify.
 * Uses the mfa_challenge token (returned by IBM Verify during RAR token exchange)
 * to list the user's enrolled factors and send a push notification.
 */
export async function triggerHITL(
  mfaChallengeToken: string,
  amount: number,
  email: string,
  verifyUserId: string | null,
  send: SendFn
): Promise<{ transactionUri: string; pushAuthId: string }> {
  // List user's enrolled factors using the mfa_challenge token
  const factorsRes = await fetch(
    `${process.env.OIDC_BASE_URI}/v2.0/factors`,
    {
      headers: { Authorization: `Bearer ${mfaChallengeToken}`, Accept: 'application/json' },
    }
  );

  if (!factorsRes.ok) throw new Error(`Failed to list factors: ${factorsRes.status}`);
  const factors = await factorsRes.json();

  // Find signature/userPresence factor (exclude SDK registrations)
  const factor = factors.factors?.find(
    (f: Record<string, unknown>) =>
      f.type === 'signature' && (f as Record<string, unknown>).subType === 'userPresence' &&
      !(f as Record<string, unknown>).additionalData
  );
  if (!factor) throw new Error('No push-capable authenticator enrolled');

  // Get the authenticator
  const authenticator = (factor.references as Record<string, unknown>[] | undefined)?.[0] ??
    (factor as Record<string, unknown>).references;
  const authenticatorId = (authenticator as Record<string, unknown>)?.authenticatorId;
  if (!authenticatorId) throw new Error('No authenticator found for factor');

  // Send push verification
  const pushRes = await fetch(
    `${process.env.OIDC_BASE_URI}/v1.0/authenticators/${authenticatorId}/verifications`,
    {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${mfaChallengeToken}`,
        'Content-Type': 'application/json',
        Accept: 'application/json',
      },
      body: JSON.stringify({
        transactionData: {
          message: `Authorize AI agent to transfer $${amount.toLocaleString('en-US', { minimumFractionDigits: 2 })}`,
          originIpAddress: '192.168.222.222',
          originUserAgent: 'Mozilla Firefox 11',
        },
        pushNotification: {
          send: true,
          title: 'CDL Bank — Fund Transfer Authorization',
          message: `Approve transfer of $${amount.toLocaleString('en-US', { minimumFractionDigits: 2 })}`,
        },
        authenticationMethods: [{ id: factor.id, methodType: 'signature' }],
        logic: 'OR',
        expiresIn: 120,
      }),
    }
  );

  if (!pushRes.ok) {
    const errText = await pushRes.text();
    console.error('[HITL] Push notification failed:', errText);
    throw new Error('Failed to send push notification');
  }

  const pushData = await pushRes.json();
  const transactionUri = pushData.transactionUri;
  const pushAuthId = pushData.id || transactionUri;

  send({
    role: 'ai',
    content: `A push notification has been sent to your device. Please approve the transfer of $${amount.toLocaleString('en-US', { minimumFractionDigits: 2 })} on your IBM Verify app.`,
    type: 'push_auth_pending',
    pushAuthId,
  });

  return { transactionUri, pushAuthId };
}

/**
 * Poll for HITL push auth result.
 * Uses the mfa_challenge token and the transactionUri (full URL) returned by triggerHITL.
 * Polls every 3 seconds for up to 50 seconds.
 */
export async function pollHITLStatus(
  transactionUri: string,
  mfaChallengeToken: string,
  email: string,
  verifyUserId: string | null,
  send: SendFn
): Promise<HITLResult> {
  const startTime = Date.now();
  let attempts = 0;

  while (Date.now() - startTime < HITL_TIMEOUT_MS) {
    attempts++;
    await new Promise((r) => setTimeout(r, POLL_INTERVAL_MS));

    send({
      role: 'ai',
      content: `Waiting for push verification... (attempt ${attempts})`,
      type: 'push_auth_polling',
      attempt: attempts,
    });

    try {
      const res = await fetch(
        `${transactionUri}?returnJwt=true`,
        {
          headers: { Authorization: `Bearer ${mfaChallengeToken}`, Accept: 'application/json' },
        }
      );

      if (!res.ok) continue;
      const data = await res.json();
      console.log('[HITL] Poll response:', JSON.stringify(data));

      if (data.state === 'VERIFY_SUCCESS') {
        send({ role: 'ai', content: 'Push verification approved!', type: 'push_auth_approved' });

        await emitAssuranceLevelChange(email, verifyUserId, 'aal1', 'aal2', {
          reasonAdmin: { en: 'Push notification approved for transfer' },
          initiatingEntity: 'user',
        });

        return { approved: true, assertion: data.assertion };
      }

      if (data.state === 'USER_DENIED' || data.state === 'EXPIRED') {
        const denied = data.state === 'USER_DENIED';
        send({
          role: 'ai',
          content: denied
            ? 'Transfer authorization was denied.'
            : 'Push verification timed out.',
          type: denied ? 'push_auth_denied' : 'push_auth_timeout',
        });

        await emitAssuranceLevelChange(email, verifyUserId, 'aal1', 'aal1', {
          reasonAdmin: { en: `Push auth ${denied ? 'denied by user' : 'expired'}` },
          initiatingEntity: denied ? 'user' : 'system',
        });

        return { approved: false };
      }
    } catch (err) {
      console.error('[HITL] Poll error:', (err as Error).message);
    }
  }

  // Timeout
  send({
    role: 'ai',
    content: 'Push verification timed out. Please try again.',
    type: 'push_auth_timeout',
  });
  return { approved: false };
}

/**
 * Exchange the HITL assertion for a final scoped token via jwt-bearer grant.
 */
export async function exchangeHITLAssertion(
  assertion: string,
  scope: string
): Promise<string> {
  const clientSecret = await getExchangeSecret();

  const res = await fetch(`${process.env.OIDC_BASE_URI}/oauth2/token`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer',
      assertion,
      client_id: process.env.EXCHANGE_CLIENT_ID!,
      client_secret: clientSecret,
      scope,
    }),
  });

  if (!res.ok) {
    const errText = await res.text();
    throw new Error(`JWT-bearer exchange failed: ${errText}`);
  }

  const data = await res.json();
  return data.access_token;
}
