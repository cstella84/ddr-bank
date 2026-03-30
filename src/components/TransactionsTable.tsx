"use client";

import {
  CoffeeIcon,
  CartIcon,
  HomeIcon,
  BriefcaseIcon,
  DollarIcon,
  UtensilsIcon,
} from "./Icons";
import { ComponentType, SVGProps } from "react";

type Transaction = {
  date: string;
  description: string;
  category: string;
  icon: ComponentType<SVGProps<SVGSVGElement>>;
  amount: number;
  iconBg: string;
  iconColor: string;
};

const transactions: Transaction[] = [
  {
    date: "Mar 28",
    description: "Whole Foods Market",
    category: "Groceries",
    icon: CartIcon,
    amount: -87.34,
    iconBg: "bg-emerald-50",
    iconColor: "text-emerald-600",
  },
  {
    date: "Mar 28",
    description: "Salary Deposit — Acme Corp",
    category: "Income",
    icon: BriefcaseIcon,
    amount: 4250.0,
    iconBg: "bg-blue-50",
    iconColor: "text-blue-600",
  },
  {
    date: "Mar 27",
    description: "Blue Bottle Coffee",
    category: "Dining",
    icon: CoffeeIcon,
    amount: -6.5,
    iconBg: "bg-amber-50",
    iconColor: "text-amber-600",
  },
  {
    date: "Mar 26",
    description: "Rent Payment",
    category: "Housing",
    icon: HomeIcon,
    amount: -2100.0,
    iconBg: "bg-purple-50",
    iconColor: "text-purple-600",
  },
  {
    date: "Mar 25",
    description: "Transfer from Savings",
    category: "Transfer",
    icon: DollarIcon,
    amount: 500.0,
    iconBg: "bg-sky-50",
    iconColor: "text-sky-600",
  },
  {
    date: "Mar 24",
    description: "Chipotle Mexican Grill",
    category: "Dining",
    icon: UtensilsIcon,
    amount: -14.85,
    iconBg: "bg-orange-50",
    iconColor: "text-orange-600",
  },
];

export default function TransactionsTable() {
  return (
    <div className="bg-white rounded-xl border border-navy-200 shadow-sm">
      <div className="px-6 py-4 border-b border-navy-100">
        <h2 className="text-base font-semibold text-navy-950">Recent Transactions</h2>
      </div>
      <div className="divide-y divide-navy-100">
        {transactions.map((tx, i) => {
          const Icon = tx.icon;
          return (
            <div key={i} className="px-6 py-3.5 flex items-center gap-4 hover:bg-navy-50/50 transition-colors">
              <div className={`w-9 h-9 rounded-lg ${tx.iconBg} ${tx.iconColor} flex items-center justify-center flex-shrink-0`}>
                <Icon className="w-4 h-4" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-navy-900 truncate">{tx.description}</p>
                <p className="text-xs text-navy-400">{tx.category}</p>
              </div>
              <div className="text-right">
                <p className="text-xs text-navy-400">{tx.date}</p>
                <p
                  className={`text-sm font-semibold tabular-nums ${
                    tx.amount > 0 ? "text-success" : "text-navy-900"
                  }`}
                >
                  {tx.amount > 0 ? "+" : ""}
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
