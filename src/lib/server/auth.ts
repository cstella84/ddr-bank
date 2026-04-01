import { cookies } from 'next/headers';

export interface UserClaims {
  sub: string;
  email: string;
  preferred_username: string;
  given_name?: string;
  family_name?: string;
  displayName: string;
  uniqueSecurityName: string;
}

/** Parse the JWT payload from an ID token (base64 decode, no signature verification). */
export function parseIdToken(idToken: string): UserClaims {
  const payload = JSON.parse(atob(idToken.split('.')[1]));
  return {
    sub: payload.sub,
    email: payload.email ?? payload.preferred_username ?? '',
    preferred_username: payload.preferred_username ?? payload.email ?? '',
    given_name: payload.given_name,
    family_name: payload.family_name,
    displayName: payload.displayName ?? payload.given_name ?? payload.preferred_username ?? 'User',
    uniqueSecurityName: payload.uniqueSecurityName ?? payload.sub,
  };
}

/** Get the current user from cookies. Returns null if not authenticated. */
export async function getUser(): Promise<UserClaims | null> {
  const cookieStore = await cookies();
  const idToken = cookieStore.get('id_token')?.value;
  if (!idToken) return null;
  try {
    return parseIdToken(idToken);
  } catch {
    return null;
  }
}

/** Get the access token from cookies. */
export async function getAccessToken(): Promise<string | null> {
  const cookieStore = await cookies();
  return cookieStore.get('access_token')?.value ?? null;
}

/** Set auth cookies on a Response. */
export function setAuthCookies(
  response: Response,
  tokens: { access_token: string; id_token?: string; refresh_token?: string; expires_in: number }
): Response {
  const isSecure = process.env.NODE_ENV === 'production';
  const cookieOptions = `Path=/; HttpOnly; SameSite=Lax${isSecure ? '; Secure' : ''}`;

  response.headers.append(
    'Set-Cookie',
    `access_token=${tokens.access_token}; ${cookieOptions}; Max-Age=${tokens.expires_in}`
  );

  if (tokens.id_token) {
    response.headers.append(
      'Set-Cookie',
      `id_token=${tokens.id_token}; ${cookieOptions}; Max-Age=${60 * 60 * 24}`
    );
  }

  if (tokens.refresh_token) {
    response.headers.append(
      'Set-Cookie',
      `refresh_token=${tokens.refresh_token}; ${cookieOptions}; Max-Age=${60 * 60 * 24 * 30}`
    );
  }

  return response;
}

/** Clear all auth cookies on a Response. */
export function clearAuthCookies(response: Response): Response {
  const expired = 'Path=/; HttpOnly; SameSite=Lax; Max-Age=0';
  response.headers.append('Set-Cookie', `access_token=; ${expired}`);
  response.headers.append('Set-Cookie', `id_token=; ${expired}`);
  response.headers.append('Set-Cookie', `refresh_token=; ${expired}`);
  return response;
}
