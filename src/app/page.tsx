import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { parseIdToken } from '@/lib/server/auth';
import { getOrCreateSession } from '@/lib/server/data-store';
import DashboardShell from '@/components/DashboardShell';

export default async function Home() {
  const cookieStore = await cookies();
  const idToken = cookieStore.get('id_token')?.value;

  if (!idToken) {
    redirect('/login');
  }

  let user;
  try {
    user = parseIdToken(idToken);
  } catch {
    redirect('/login?error=invalid_token');
  }

  // Initialize in-memory session with user's data
  const session = getOrCreateSession(
    user.uniqueSecurityName,
    user.preferred_username,
    user.displayName
  );

  // Serialize session data for client components
  const userData = {
    displayName: user.displayName,
    email: user.email,
    initials: user.displayName
      .split(' ')
      .map((n: string) => n[0])
      .join('')
      .toUpperCase()
      .slice(0, 2) || user.displayName.slice(0, 2).toUpperCase(),
  };

  const accounts = session.accounts.map((a) => ({
    id: a.id,
    name: a.name,
    type: a.type,
    balance: a.balance,
  }));

  const transactions = session.transactions.slice(0, 10).map((t) => ({
    id: t.id,
    amount: t.amount,
    type: t.type,
    description: t.description,
    status: t.status,
    createdAt: t.createdAt,
  }));

  return (
    <DashboardShell
      user={userData}
      accounts={accounts}
      transactions={transactions}
    />
  );
}
