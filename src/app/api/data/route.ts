import { NextRequest, NextResponse } from 'next/server';
import { parseIdToken } from '@/lib/server/auth';
import { getOrCreateSession } from '@/lib/server/data-store';

export async function GET(req: NextRequest) {
  const idToken = req.cookies.get('id_token')?.value;
  if (!idToken) {
    return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
  }

  let user;
  try {
    user = parseIdToken(idToken);
  } catch {
    return NextResponse.json({ error: 'Invalid token' }, { status: 401 });
  }

  const session = getOrCreateSession(user.uniqueSecurityName, user.preferred_username, user.displayName);

  return NextResponse.json({
    accounts: session.accounts.map((a) => ({
      id: a.id,
      name: a.name,
      type: a.type,
      balance: a.balance,
    })),
    transactions: session.transactions.slice(0, 10).map((t) => ({
      id: t.id,
      amount: t.amount,
      type: t.type,
      description: t.description,
      status: t.status,
      createdAt: t.createdAt,
    })),
  });
}
