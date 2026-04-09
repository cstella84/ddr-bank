import { getVaultSecret } from '@/lib/server/vault';
import { emitAssuranceLevelChange } from './caep';

type SendFn = (data: Record<string, unknown>) => void;

// Pending MFA challenges — keyed by sessionId
const pendingMFA = new Map<string, { id: string }>();

// Cache the agentic API credentials from Vault
let cachedAgenticId: string | null = null;
let cachedAgenticSecret: string | null = null;
let agenticCredsExpiry = 0;
const AGENTIC_CREDS_TTL_MS = 60 * 60 * 1000; // 1 hour

async function getAgenticCredentials(): Promise<{ id: string; secret: string }> {
  if (cachedAgenticId && cachedAgenticSecret && Date.now() < agenticCredsExpiry) {
    return { id: cachedAgenticId, secret: cachedAgenticSecret };
  }
  cachedAgenticId = await getVaultSecret('agentic-api', 'client_id');
  cachedAgenticSecret = await getVaultSecret('agentic-api', 'client_secret');
  agenticCredsExpiry = Date.now() + AGENTIC_CREDS_TTL_MS;
  console.log('[Vault] Agentic API credentials retrieved (secret/agentic-api)');
  return { id: cachedAgenticId, secret: cachedAgenticSecret };
}

/** Get the API token for IBM Verify operations (MFA, push auth). */
let apiToken: string | null = null;
let apiTokenExpiry = 0;

async function getAPIToken(): Promise<string> {
  if (apiToken && Date.now() < apiTokenExpiry) return apiToken;

  const { id, secret } = await getAgenticCredentials();

  const res = await fetch(`${process.env.OIDC_BASE_URI}/v1.0/endpoint/default/token`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type: 'client_credentials',
      client_id: id,
      client_secret: secret,
    }),
  });

  if (!res.ok) throw new Error(`API token request failed: ${res.status}`);
  const data = await res.json();
  apiToken = data.access_token;
  apiTokenExpiry = Date.now() + (data.expires_in - 60) * 1000;
  return apiToken!;
}

/** Trigger MFA by sending an OTP email to the user. */
export async function triggerMFA(
  email: string,
  sessionId: string,
  send: SendFn
): Promise<void> {
  const token = await getAPIToken();

  const res = await fetch(
    `${process.env.OIDC_BASE_URI}/v2.0/factors/emailotp/transient/verifications`,
    {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
        Accept: 'application/json',
      },
      body: JSON.stringify({
        emailAddress: email,
        correlation: 'Agentic',
      }),
    }
  );

  if (!res.ok) {
    const errText = await res.text();
    console.error('[MFA] Trigger failed:', errText);
    throw new Error('Failed to send MFA code');
  }

  const data = await res.json();
  pendingMFA.set(sessionId, { id: data.id });

  send({
    role: 'ai',
    content: 'An MFA verification code has been sent to your email. Please enter the 6-digit code (it will be prefixed with "Agentic-").',
    type: 'delta',
  });
}

/** Validate an MFA OTP code. */
export async function validateMFA(
  otp: string,
  sessionId: string,
  email: string,
  verifyUserId: string | null,
  send: SendFn
): Promise<boolean> {
  const pending = pendingMFA.get(sessionId);
  if (!pending) return false;

  const token = await getAPIToken();

  const res = await fetch(
    `${process.env.OIDC_BASE_URI}/v2.0/factors/emailotp/transient/verifications/${pending.id}?returnJwt=true`,
    {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
        Accept: 'application/json',
      },
      body: JSON.stringify({ otp }),
    }
  );

  if (!res.ok) {
    await emitAssuranceLevelChange(email, verifyUserId, 'aal1', 'aal1', {
      reasonAdmin: { en: 'MFA validation failed — incorrect code' },
      initiatingEntity: 'user',
    });
    send({ role: 'ai', content: 'Invalid MFA code. Please try again.', type: 'delta' });
    return false;
  }

  // MFA succeeded
  pendingMFA.delete(sessionId);
  await emitAssuranceLevelChange(email, verifyUserId, 'aal1', 'aal2', {
    reasonAdmin: { en: 'MFA email OTP verified successfully' },
    initiatingEntity: 'user',
  });
  return true;
}

export function hasPendingMFA(sessionId: string): boolean {
  return pendingMFA.has(sessionId);
}

export function clearPendingMFA(sessionId: string): void {
  pendingMFA.delete(sessionId);
}

export { getAPIToken };
