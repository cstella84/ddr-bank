import { getVaultSecret } from '@/lib/server/vault';

interface TokenExchangeResult {
  access_token: string;
  scope: string;
  token_type: string;
  expires_in: number;
}

// Cache the exchange client secret
let cachedExchangeSecret: string | null = null;
let exchangeSecretExpiry = 0;
const EXCHANGE_SECRET_TTL_MS = 60 * 60 * 1000; // 1 hour

export async function getExchangeSecret(): Promise<string> {
  if (cachedExchangeSecret && Date.now() < exchangeSecretExpiry) {
    return cachedExchangeSecret;
  }
  cachedExchangeSecret = await getVaultSecret('token-exchange', 'client_secret');
  exchangeSecretExpiry = Date.now() + EXCHANGE_SECRET_TTL_MS;
  console.log('[Vault] Exchange client secret retrieved (secret/token-exchange)');
  return cachedExchangeSecret;
}

/**
 * RFC 8693 Token Exchange with IBM Verify.
 * Uses a dedicated exchange client (EXCHANGE_CLIENT_ID) to exchange
 * the user's access token for a scoped token with only the required permissions.
 * For transfer_funds, includes authorization_details with the exact transfer amount.
 *
 * Returns the scoped token, or throws if the exchange fails.
 * If IBM Verify returns scope=mfa_challenge, the caller must handle HITL push auth.
 */
export async function exchangeToken(
  subjectToken: string,
  scope: string,
  amount?: number
): Promise<TokenExchangeResult> {
  const clientSecret = await getExchangeSecret();

  const params: Record<string, string> = {
    grant_type: 'urn:ietf:params:oauth:grant-type:token-exchange',
    subject_token: subjectToken,
    subject_token_type: 'urn:ietf:params:oauth:token-type:access_token',
    scope,
    client_id: process.env.EXCHANGE_CLIENT_ID!,
    client_secret: clientSecret,
  };

  // For transfers, include Rich Authorization Request details
  if (scope === 'transfer:all' && amount != null) {
    params.authorization_details = JSON.stringify([
      {
        type: 'transfer_funds',
        instructedAmount: {
          amount: amount.toString(),
          currency: 'USD',
        },
      },
    ]);
  }

  const res = await fetch(`${process.env.OIDC_BASE_URI}/oauth2/token`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams(params),
  });

  if (!res.ok) {
    const errText = await res.text();
    console.error(`[TokenExchange] Failed (${res.status}):`, errText);
    throw new Error(`Token exchange failed: ${res.status}`);
  }

  const result = await res.json();

  // If scope is mfa_challenge, IBM Verify requires step-up authentication (HITL)
  if (result.scope === 'mfa_challenge') {
    const err = new Error('MFA challenge required') as Error & {
      mfaChallenge: true;
      mfaToken: string;
    };
    (err as any).mfaChallenge = true;
    (err as any).mfaToken = result.access_token;
    throw err;
  }

  return result;
}
