import { NextRequest, NextResponse } from 'next/server';
import { getSecrets, invalidateSecretCache } from '@/lib/server/vault';
import { setAuthCookies, parseIdToken } from '@/lib/server/auth';
import { clearSession } from '@/lib/server/data-store';

export async function GET(req: NextRequest) {
  // Check if IBM Verify returned an error
  const error = req.nextUrl.searchParams.get('error');
  if (error) {
    const errorDesc = req.nextUrl.searchParams.get('error_description') || error;
    console.error('[Callback] IBM Verify error:', error, errorDesc);
    return NextResponse.redirect(new URL(`/login?error=token_exchange_failed`, req.url));
  }

  const code = req.nextUrl.searchParams.get('code');
  if (!code) {
    console.error('[Callback] No code in callback. Params:', req.nextUrl.searchParams.toString());
    return NextResponse.redirect(new URL('/login?error=missing_code', req.url));
  }

  // Retrieve PKCE verifier from cookie
  const codeVerifier = req.cookies.get('pkce_verifier')?.value;
  if (!codeVerifier) {
    console.error('[Callback] Missing PKCE verifier cookie');
    return NextResponse.redirect(new URL('/login?error=missing_code', req.url));
  }

  async function exchangeCode(clientSecret: string) {
    return fetch(`${process.env.OIDC_BASE_URI}/oauth2/token`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        grant_type: 'authorization_code',
        code: code!,
        redirect_uri: process.env.REDIRECT_URI!,
        client_id: process.env.OIDC_CLIENT_ID!,
        client_secret: clientSecret,
        code_verifier: codeVerifier,
      }),
    });
  }

  let secret = await getSecrets();
  let tokenRes = await exchangeCode(secret);

  // If stale secret (CSIAQ0155E), invalidate cache and retry once
  if (!tokenRes.ok) {
    const errText = await tokenRes.text();
    if (errText.includes('CSIAQ0155E')) {
      console.log('[Callback] CSIAQ0155E — retrying with fresh secret');
      invalidateSecretCache();
      secret = await getSecrets();
      tokenRes = await exchangeCode(secret);
    }
    if (!tokenRes.ok) {
      const retryErr = tokenRes.bodyUsed ? errText : await tokenRes.text();
      console.error('Callback Failed:', retryErr);
      return NextResponse.redirect(new URL('/login?error=token_exchange_failed', req.url));
    }
  }

  const tokens = await tokenRes.json();

  // Clear any stale agent/data session from a previous login
  if (tokens.id_token) {
    try {
      const claims = parseIdToken(tokens.id_token);
      clearSession(claims.uniqueSecurityName);
    } catch {
      // Non-fatal
    }
  }

  // Set cookies and redirect to dashboard
  const response = NextResponse.redirect(new URL('/', req.url));
  // Clear the PKCE verifier cookie
  response.cookies.delete('pkce_verifier');
  return setAuthCookies(response, tokens);
}
