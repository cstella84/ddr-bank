"use client";

import AccountCard from "./AccountCard";
import TransactionsTable from "./TransactionsTable";

export default function Dashboard() {
  const today = new Date().toLocaleDateString("en-US", {
    weekday: "long",
    year: "numeric",
    month: "long",
    day: "numeric",
  });

  const hour = new Date().getHours();
  const greeting = hour < 12 ? "Good morning" : hour < 18 ? "Good afternoon" : "Good evening";

  return (
    <main className="flex-1 px-8 py-6 max-w-[1200px] mx-auto w-full">
      {/* Greeting */}
      <div className="mb-8">
        <h1 className="text-2xl font-semibold text-navy-950">
          {greeting}, Sarah
        </h1>
        <p className="text-sm text-navy-500 mt-1">{today}</p>
      </div>

      {/* Account Cards */}
      <div className="grid grid-cols-2 gap-6 mb-8">
        <AccountCard
          type="Checking Account"
          accountNumber="4821"
          balance={12847.53}
          badge="Primary"
          sparklineData={[40, 35, 50, 45, 60, 55, 48, 52, 58, 42, 50, 55]}
        />
        <AccountCard
          type="Savings Account"
          accountNumber="9307"
          balance={45230.0}
          apy="4.15%"
          sparklineData={[30, 32, 31, 35, 38, 40, 42, 44, 43, 45, 46, 48]}
        />
      </div>

      {/* Recent Transactions */}
      <TransactionsTable />
    </main>
  );
}
