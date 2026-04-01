import { DynamicStructuredTool } from '@langchain/core/tools';
import { z } from 'zod';
import {
  getAccounts,
  getTransactions,
  getReports,
  getTasks,
  getUserInfo,
  resolveAccount,
  transferFunds,
} from '@/lib/server/data-store';

/** Tool-to-scope mapping for RAR (Rich Authorization Requests). */
export const TOOL_SCOPES: Record<string, string> = {
  get_account_data: 'accounts:read',
  get_user_data: 'users:read',
  get_transaction_data: 'transactions:read',
  get_task_data: 'tasks:read',
  get_report_data: 'reports:read',
  transfer_funds: 'transfer:all',
};

/** Create all 6 agent tools for a given session. */
export function createTools(sessionId: string) {
  return [
    new DynamicStructuredTool({
      name: 'get_account_data',
      description: 'Get the user\'s bank account information including balances',
      schema: z.object({}),
      func: async () => {
        const accounts = getAccounts(sessionId);
        if (!accounts.length) return 'No accounts found.';
        const lines = accounts.map(
          (a) =>
            `• ${a.name} (${a.type}) — $${a.balance.toLocaleString('en-US', { minimumFractionDigits: 2 })}`
        );
        return `Accounts:\n${lines.join('\n')}`;
      },
    }),

    new DynamicStructuredTool({
      name: 'get_user_data',
      description: 'Get the current user\'s profile information',
      schema: z.object({}),
      func: async () => {
        const user = getUserInfo(sessionId);
        if (!user) return 'User not found.';
        return `User: ${user.displayName}\nUsername: ${user.username}\nRole: ${user.role}\nDepartment: ${user.department}`;
      },
    }),

    new DynamicStructuredTool({
      name: 'get_transaction_data',
      description: 'Get the user\'s recent transaction history',
      schema: z.object({}),
      func: async () => {
        const txns = getTransactions(sessionId);
        if (!txns.length) return 'No transactions found.';
        const lines = txns.slice(0, 10).map((t) => {
          const sign = t.amount > 0 ? '+' : '';
          return `• ${t.description} — ${sign}$${Math.abs(t.amount).toLocaleString('en-US', { minimumFractionDigits: 2 })} (${t.status})`;
        });
        return `Recent Transactions:\n${lines.join('\n')}`;
      },
    }),

    new DynamicStructuredTool({
      name: 'get_task_data',
      description: 'Get tasks assigned to the user',
      schema: z.object({}),
      func: async () => {
        const tasks = getTasks(sessionId);
        if (!tasks.length) return 'No tasks found.';
        const lines = tasks.map((t) => `• [${t.status}] ${t.description}`);
        return `Tasks:\n${lines.join('\n')}`;
      },
    }),

    new DynamicStructuredTool({
      name: 'get_report_data',
      description: 'Get reports. This tool requires MFA verification — the user will need to enter a code sent to their email.',
      schema: z.object({}),
      func: async () => {
        const reports = getReports(sessionId);
        if (!reports.length) return 'No reports found.';
        const lines = reports.map(
          (r) =>
            `📄 ${r.title}\n   Department: ${r.department} | Sensitivity: ${r.sensitivity}\n   ${r.content}`
        );
        return `Reports:\n\n${lines.join('\n\n')}`;
      },
    }),

    new DynamicStructuredTool({
      name: 'transfer_funds',
      description:
        'Transfer funds between accounts. Specify the source account, destination account, and amount. Accounts can be identified by type (checking, savings) or by name.',
      schema: z.object({
        fromAccountId: z.string().describe('Source account identifier (ID, type like "checking", or name)'),
        toAccountId: z.string().describe('Destination account identifier (ID, type like "savings", or name)'),
        amount: z.number().describe('Amount to transfer in dollars'),
      }),
      func: async ({ fromAccountId, toAccountId, amount }) => {
        const from = resolveAccount(sessionId, fromAccountId);
        const to = resolveAccount(sessionId, toAccountId);

        if (!from) return `Could not find source account: "${fromAccountId}"`;
        if (!to) return `Could not find destination account: "${toAccountId}"`;

        const result = transferFunds(sessionId, from.id, to.id, amount);
        if (!result.success) return `Transfer failed: ${result.error}`;

        return (
          `Transfer of $${amount.toLocaleString('en-US', { minimumFractionDigits: 2 })} from ${from.name} to ${to.name} completed successfully.\n\n` +
          `Updated balances:\n` +
          `• ${from.name}: $${result.fromBalance!.toLocaleString('en-US', { minimumFractionDigits: 2 })}\n` +
          `• ${to.name}: $${result.toBalance!.toLocaleString('en-US', { minimumFractionDigits: 2 })}`
        );
      },
    }),
  ];
}
