import { NextRequest, NextResponse } from 'next/server';
import { parseIdToken } from '@/lib/server/auth';
import { clearSession } from '@/lib/server/data-store';
import { clearAgentSession } from '@/lib/agent/sessions';
import { clearViolations } from '@/lib/agent/abuse';

export async function POST(req: NextRequest) {
  const idToken = req.cookies.get('id_token')?.value;
  if (!idToken) {
    return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
  }

  try {
    const user = parseIdToken(idToken);
    const sessionId = user.uniqueSecurityName;

    clearSession(sessionId);
    clearAgentSession(sessionId);
    clearViolations(sessionId);

    return NextResponse.json({ success: true });
  } catch {
    return NextResponse.json({ error: 'Invalid token' }, { status: 401 });
  }
}
