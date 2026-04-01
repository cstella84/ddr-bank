import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import crypto from 'crypto';

function generateCodeVerifier(): string {
  return crypto.randomBytes(32).toString('base64url');
}

function generateCodeChallenge(verifier: string): string {
  return crypto.createHash('sha256').update(verifier).digest('base64url');
}

export async function GET() {
  const redirectUri = encodeURIComponent(process.env.REDIRECT_URI!);
  const authMethod = process.env.AUTH_METHOD || 'environment';
  const authorizationDetails = encodeURIComponent(
    JSON.stringify([{ type: authMethod }])
  );

  // PKCE: generate verifier and challenge
  const codeVerifier = generateCodeVerifier();
  const codeChallenge = generateCodeChallenge(codeVerifier);

  // Store verifier in a cookie so the callback can use it
  const cookieStore = await cookies();
  cookieStore.set('pkce_verifier', codeVerifier, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/',
    maxAge: 300, // 5 minutes
  });

  const state = crypto.randomBytes(16).toString('base64url');

  const url =
    `${process.env.OIDC_BASE_URI}/oauth2/authorize` +
    `?scope=openid%20profile%20email%20agentic` +
    `&client_id=${process.env.OIDC_CLIENT_ID}` +
    `&response_type=code` +
    `&redirect_uri=${redirectUri}` +
    `&state=${state}` +
    `&code_challenge=${codeChallenge}` +
    `&code_challenge_method=S256` +
    `&authorization_details=${authorizationDetails}`;

  return NextResponse.redirect(url);
}
