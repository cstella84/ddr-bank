import { NextRequest, NextResponse } from 'next/server';
import { getSecrets, invalidateSecretCache } from '@/lib/server/vault';
import { clearAuthCookies, parseIdToken } from '@/lib/server/auth';
import { clearSession } from '@/lib/server/data-store';

export async function GET(req: NextRequest) {
  const accessToken = req.cookies.get('access_token')?.value ?? '';
  const idToken = req.cookies.get('id_token')?.value;

  // Clear in-memory agent/data session
  if (idToken) {
    try {
      const claims = parseIdToken(idToken);
      clearSession(claims.uniqueSecurityName);
    } catch {
      // Non-fatal
    }
  }

  // Revoke the token at IBM Verify — auto-retry on CSIAQ0155E
  if (accessToken) {
    async function revokeToken(clientSecret: string) {
      return fetch(`${process.env.OIDC_BASE_URI}/oauth2/revoke`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({
          client_id: process.env.OIDC_CLIENT_ID!,
          client_secret: clientSecret,
          token: accessToken,
          token_type_hint: 'access_token',
        }),
      });
    }

    let secret = await getSecrets();
    let revokeRes = await revokeToken(secret);

    if (!revokeRes.ok) {
      const errText = await revokeRes.text();
      if (errText.includes('CSIAQ0155E')) {
        console.log('[Logout] CSIAQ0155E — retrying with fresh secret');
        invalidateSecretCache();
        secret = await getSecrets();
        revokeRes = await revokeToken(secret);
      }
      if (!revokeRes.ok) {
        console.error('Token revocation failed');
      }
    }
  }

  // Clear cookies and redirect to IBM Verify logout
  const logoutUrl = process.env.VERIFY_LOGOUT_URL
    ? process.env.VERIFY_LOGOUT_URL
    : '/login';

  const response = NextResponse.redirect(new URL(logoutUrl, req.url));
  return clearAuthCookies(response);
}
