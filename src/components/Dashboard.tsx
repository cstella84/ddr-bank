"use client";

import AccountCard from "./AccountCard";
import TransactionsTable from "./TransactionsTable";
import type { UserInfo, AccountInfo, TransactionInfo } from "./DashboardShell";

interface DashboardProps {
  user: UserInfo;
  accounts: AccountInfo[];
  transactions: TransactionInfo[];
}

export default function Dashboard({ user, accounts, transactions }: DashboardProps) {
  const today = new Date().toLocaleDateString("en-US", {
    weekday: "long",
    year: "numeric",
    month: "long",
    day: "numeric",
  });

  const hour = new Date().getHours();
  const greeting = hour < 12 ? "Good morning" : hour < 18 ? "Good afternoon" : "Good evening";

  const firstName = user.displayName.split(" ")[0];

  // Generate sparkline data (decorative — consistent per account type)
  const sparklines: Record<string, number[]> = {
    checking: [40, 35, 50, 45, 60, 55, 48, 52, 58, 42, 50, 55],
    savings: [30, 32, 31, 35, 38, 40, 42, 44, 43, 45, 46, 48],
  };

  return (
    <main className="flex-1 px-8 py-6 max-w-[1200px] mx-auto w-full">
      {/* Greeting */}
      <div className="mb-8">
        <h1 className="text-2xl font-semibold text-navy-950">
          {greeting}, {firstName}
        </h1>
        <p className="text-sm text-navy-500 mt-1">{today}</p>
      </div>

      {/* Account Cards */}
      <div className="grid grid-cols-2 gap-6 mb-8">
        {accounts.map((account) => (
          <AccountCard
            key={account.id}
            type={`${account.type.charAt(0).toUpperCase() + account.type.slice(1)} Account`}
            accountNumber={account.id.padStart(4, '0')}
            balance={account.balance}
            badge={account.type === "checking" ? "Primary" : undefined}
            apy={account.type === "savings" ? "4.15%" : undefined}
            sparklineData={sparklines[account.type] || sparklines.checking}
          />
        ))}
      </div>

      {/* Recent Transactions */}
      <TransactionsTable transactions={transactions} />
    </main>
  );
}
