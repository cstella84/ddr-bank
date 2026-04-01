"use client";

import { DollarIcon } from "./Icons";
import type { TransactionInfo } from "./DashboardShell";

interface TransactionsTableProps {
  transactions: TransactionInfo[];
}

export default function TransactionsTable({ transactions }: TransactionsTableProps) {
  if (transactions.length === 0) {
    return (
      <div className="bg-white rounded-xl border border-navy-200 shadow-sm">
        <div className="px-6 py-4 border-b border-navy-100">
          <h2 className="text-base font-semibold text-navy-950">Recent Transactions</h2>
        </div>
        <div className="px-6 py-12 text-center">
          <p className="text-sm text-navy-400">No recent transactions</p>
          <p className="text-xs text-navy-300 mt-1">Transfers made through the AI assistant will appear here</p>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-xl border border-navy-200 shadow-sm">
      <div className="px-6 py-4 border-b border-navy-100">
        <h2 className="text-base font-semibold text-navy-950">Recent Transactions</h2>
      </div>
      <div className="divide-y divide-navy-100">
        {transactions.map((tx) => {
          const isPositive = tx.amount > 0;
          const date = new Date(tx.createdAt).toLocaleDateString("en-US", {
            month: "short",
            day: "numeric",
          });

          return (
            <div key={tx.id} className="px-6 py-3.5 flex items-center gap-4 hover:bg-navy-50/50 transition-colors">
              <div className={`w-9 h-9 rounded-lg flex items-center justify-center flex-shrink-0 ${
                isPositive ? "bg-emerald-50 text-emerald-600" : "bg-sky-50 text-sky-600"
              }`}>
                <DollarIcon className="w-4 h-4" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-navy-900 truncate">{tx.description}</p>
                <p className="text-xs text-navy-400 capitalize">{tx.type.replace('_', ' ')}</p>
              </div>
              <div className="text-right">
                <p className="text-xs text-navy-400">{date}</p>
                <p
                  className={`text-sm font-semibold tabular-nums ${
                    isPositive ? "text-success" : "text-navy-900"
                  }`}
                >
                  {isPositive ? "+" : ""}
                  ${Math.abs(tx.amount).toLocaleString("en-US", {
                    minimumFractionDigits: 2,
                  })}
                </p>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
