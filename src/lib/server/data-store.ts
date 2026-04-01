/**
 * Per-session in-memory data store.
 * Each user gets a cloned copy of template data on first access.
 * State persists within a single serverless function instance
 * but resets on cold starts — acceptable for demo purposes.
 */

export interface Account {
  id: string;
  name: string;
  owner: string;
  type: 'checking' | 'savings';
  balance: number;
}

export interface Transaction {
  id: string;
  accountId: string;
  owner: string;
  amount: number;
  type: 'transfer_in' | 'transfer_out';
  description: string;
  status: 'pending' | 'approved';
  createdAt: string;
}

export interface Report {
  id: string;
  title: string;
  department: string;
  sensitivity: 'low' | 'medium' | 'high';
  content: string;
}

export interface Task {
  id: string;
  description: string;
  assignedTo: string;
  status: 'open' | 'in-progress' | 'done';
}

export interface UserRecord {
  username: string;
  displayName: string;
  role: string;
  department: string;
}

interface SessionData {
  user: UserRecord;
  accounts: Account[];
  transactions: Transaction[];
  reports: Report[];
  tasks: Task[];
  nextTransactionId: number;
}

// Template data — cloned for each new session
function createTemplate(username: string, displayName: string): SessionData {
  const friendlyName = displayName || username.split('@')[0];
  return {
    user: {
      username,
      displayName: friendlyName,
      role: 'user',
      department: 'general',
    },
    accounts: [
      {
        id: '1',
        name: `${friendlyName}'s Checking Account`,
        owner: username,
        type: 'checking',
        balance: 12000,
      },
      {
        id: '2',
        name: `${friendlyName}'s Savings Account`,
        owner: username,
        type: 'savings',
        balance: 80000,
      },
    ],
    transactions: [],
    reports: [
      {
        id: '1',
        title: 'Q1 Financial Overview',
        department: 'finance',
        sensitivity: 'high',
        content:
          'Revenue increased 12% YoY. Operating expenses remained flat. Net income margin improved to 18.4%. Key growth drivers: digital banking adoption (+34%), reduced branch overhead. Risk areas: rising interest rate exposure on variable-rate portfolio.',
      },
      {
        id: '2',
        title: 'Engineering OKRs — Q2',
        department: 'engineering',
        sensitivity: 'medium',
        content:
          'Objective 1: Improve platform reliability to 99.95% uptime. Objective 2: Reduce API latency p99 to under 200ms. Objective 3: Complete SOC 2 Type II audit remediation.',
      },
    ],
    tasks: [
      { id: '1', description: 'Review Q1 expense reports', assignedTo: username, status: 'open' },
      { id: '2', description: 'Approve vendor payment batch', assignedTo: username, status: 'open' },
      { id: '3', description: 'Complete compliance training', assignedTo: username, status: 'in-progress' },
    ],
    nextTransactionId: 1,
  };
}

// Session store — keyed by uniqueSecurityName (consistent per user)
const sessions = new Map<string, SessionData>();

export function getOrCreateSession(sessionId: string, username: string, displayName: string): SessionData {
  let session = sessions.get(sessionId);
  if (!session) {
    session = createTemplate(username, displayName);
    sessions.set(sessionId, session);
    console.log(`[DataStore] Created session for "${username}"`);
  }
  return session;
}

export function getSession(sessionId: string): SessionData | undefined {
  return sessions.get(sessionId);
}

export function getAccounts(sessionId: string): Account[] {
  return sessions.get(sessionId)?.accounts ?? [];
}

export function getTransactions(sessionId: string): Transaction[] {
  return sessions.get(sessionId)?.transactions ?? [];
}

export function getReports(sessionId: string): Report[] {
  return sessions.get(sessionId)?.reports ?? [];
}

export function getTasks(sessionId: string): Task[] {
  return sessions.get(sessionId)?.tasks ?? [];
}

export function getUserInfo(sessionId: string): UserRecord | undefined {
  return sessions.get(sessionId)?.user;
}

/** Resolve an account by ID, type, or name substring. */
export function resolveAccount(sessionId: string, identifier: string): Account | undefined {
  const accounts = getAccounts(sessionId);
  // Try exact ID
  let match = accounts.find((a) => a.id === identifier);
  if (match) return match;
  // Try type (case-insensitive)
  match = accounts.find((a) => a.type.toLowerCase() === identifier.toLowerCase());
  if (match) return match;
  // Try name substring
  match = accounts.find((a) => a.name.toLowerCase().includes(identifier.toLowerCase()));
  return match;
}

/** Execute a fund transfer between two accounts. */
export function transferFunds(
  sessionId: string,
  fromId: string,
  toId: string,
  amount: number
): { success: boolean; error?: string; fromBalance?: number; toBalance?: number } {
  const session = sessions.get(sessionId);
  if (!session) return { success: false, error: 'Session not found' };

  const from = session.accounts.find((a) => a.id === fromId);
  const to = session.accounts.find((a) => a.id === toId);

  if (!from || !to) return { success: false, error: 'Account not found' };
  if (from.id === to.id) return { success: false, error: 'Cannot transfer to the same account' };
  if (amount <= 0) return { success: false, error: 'Amount must be positive' };
  if (from.balance < amount) return { success: false, error: 'Insufficient funds' };

  // Update balances
  from.balance -= amount;
  to.balance += amount;

  const txnId = String(session.nextTransactionId++);
  const now = new Date().toISOString();

  // Create transaction records
  session.transactions.unshift(
    {
      id: txnId,
      accountId: from.id,
      owner: session.user.username,
      amount: -amount,
      type: 'transfer_out',
      description: `Transfer to ${to.name}`,
      status: 'approved',
      createdAt: now,
    },
    {
      id: String(session.nextTransactionId++),
      accountId: to.id,
      owner: session.user.username,
      amount,
      type: 'transfer_in',
      description: `Transfer from ${from.name}`,
      status: 'approved',
      createdAt: now,
    }
  );

  return { success: true, fromBalance: from.balance, toBalance: to.balance };
}

export function clearSession(sessionId: string): void {
  sessions.delete(sessionId);
  console.log(`[DataStore] Cleared session "${sessionId}"`);
}
