import { createVaultClient } from '@hashicorp/vault-runtime-credential-sdk';

// Vault client — created once at module load, credential cache persists across warm invocations.
// On Vercel (no SPIFFE), uses environment-only chain with VAULT_KEY.
const vault = createVaultClient({
  address: process.env.VAULT_BASE_URI!,
  chain: {
    environment: { variableName: 'VAULT_KEY' },
  },
});

// OIDC client secret from IBM Verify Vault plugin.
// The plugin rotates the secret on every read, so we cache to avoid constant rotation.
let cachedOidcSecret: string | null = null;
let oidcSecretExpiry = 0;
const OIDC_SECRET_TTL_MS = 60 * 60 * 1000; // 1 hour

async function fetchSecretFromVault(): Promise<string> {
  const { token } = await vault.resolveCredential();

  // Try the IBM Verify plugin first (production), fall back to KV2 (dev)
  let secret: string | undefined;

  try {
    const pluginResp = await fetch(`${process.env.VAULT_BASE_URI}/v1/ibm-verify/creds/oidc-smt`, {
      headers: { 'X-Vault-Token': token },
    });
    if (pluginResp.ok) {
      const json = await pluginResp.json();
      secret = json.data.client_secret;
      console.log('[Vault] OIDC secret retrieved via IBM Verify plugin (oidc-smt)');
    }
  } catch {
    // Plugin not available — fall through to KV
  }

  if (!secret) {
    const kvResp = await fetch(`${process.env.VAULT_BASE_URI}/v1/secret/data/oidc-smt`, {
      headers: { 'X-Vault-Token': token },
    });
    if (!kvResp.ok) {
      const text = await kvResp.text();
      throw new Error(`Vault KV read failed (${kvResp.status}): ${text}`);
    }
    const json = await kvResp.json();
    secret = json.data.data.client_secret;
    console.log('[Vault] OIDC secret retrieved via KV2 (secret/oidc-smt)');
  }

  if (!secret) throw new Error('No OIDC secret found in Vault');

  cachedOidcSecret = secret;
  oidcSecretExpiry = Date.now() + OIDC_SECRET_TTL_MS;
  return secret;
}

/** Get the OIDC client secret, using cache if still valid. */
export async function getSecrets(): Promise<string> {
  if (cachedOidcSecret && Date.now() < oidcSecretExpiry) {
    return cachedOidcSecret;
  }
  try {
    return await fetchSecretFromVault();
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : String(error);
    console.error('[Vault] Error retrieving secret:', msg);
    throw new Error(msg);
  }
}

/** Invalidate cached secret (call when CSIAQ0155E indicates rotation). */
export function invalidateSecretCache(): void {
  cachedOidcSecret = null;
  oidcSecretExpiry = 0;
  console.log('[Vault] OIDC secret cache invalidated');
}

/**
 * Introspect a token with automatic retry on CSIAQ0155E (stale client secret).
 * If the cached secret was rotated by another process, this invalidates
 * the cache, fetches a fresh secret, and retries once.
 */
export async function introspectToken(accessToken: string): Promise<Record<string, unknown>> {
  const secret = await getSecrets();

  const doIntrospect = async (clientSecret: string) => {
    const res = await fetch(`${process.env.OIDC_BASE_URI}/oauth2/introspect`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        client_id: process.env.OIDC_CLIENT_ID!,
        client_secret: clientSecret,
        token: accessToken,
      }),
    });
    return res.json();
  };

  const result = await doIntrospect(secret);

  const isAuthError =
    result.messageId?.startsWith('CSIAQ0155E') ||
    (result.error_description && result.error_description.includes('CSIAQ0155E'));

  if (isAuthError) {
    console.log('[Vault] Introspection failed with CSIAQ0155E — retrying with fresh secret');
    invalidateSecretCache();
    const freshSecret = await getSecrets();
    return doIntrospect(freshSecret);
  }

  return result;
}

/** Read a KV2 secret field from Vault. */
export async function getVaultSecret(path: string, field: string): Promise<string> {
  const { token } = await vault.resolveCredential();
  const resp = await fetch(`${process.env.VAULT_BASE_URI}/v1/secret/data/${path}`, {
    headers: { 'X-Vault-Token': token },
  });
  if (!resp.ok) {
    throw new Error(`Vault KV2 read failed for ${path}: ${resp.status}`);
  }
  const json = await resp.json();
  return json?.data?.data?.[field];
}

export { vault };
