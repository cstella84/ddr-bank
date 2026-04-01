"use client";

import { ShieldIcon, BellIcon } from "./Icons";
import type { UserInfo } from "./DashboardShell";

interface NavbarProps {
  user: UserInfo;
}

export default function Navbar({ user }: NavbarProps) {
  return (
    <nav className="bg-navy-950 text-white h-16 flex items-center px-8 shadow-lg">
      <div className="flex items-center gap-3">
        <div className="w-9 h-9 bg-gold rounded-lg flex items-center justify-center">
          <ShieldIcon className="w-5 h-5 text-navy-950" />
        </div>
        <span className="text-lg font-semibold tracking-tight">
          DDR <span className="font-light text-navy-300">Bank</span>
        </span>
      </div>

      <div className="ml-auto flex items-center gap-6">
        <a
          href="/auth-flow"
          className="text-xs text-navy-400 hover:text-white transition-colors flex items-center gap-1.5"
          title="View authentication flow diagrams"
        >
          <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
            <polyline points="22 12 18 12 15 21 9 3 6 12 2 12" />
          </svg>
          Auth Flow
        </a>

        <button className="relative text-navy-400 hover:text-white transition-colors">
          <BellIcon className="w-5 h-5" />
          <span className="absolute -top-1 -right-1 w-2 h-2 bg-blue-electric rounded-full" />
        </button>

        <div className="flex items-center gap-3">
          <div className="text-right">
            <p className="text-sm font-medium leading-none">{user.displayName}</p>
            <p className="text-xs text-navy-400 mt-0.5">{user.email}</p>
          </div>
          <div className="w-9 h-9 rounded-full bg-gradient-to-br from-blue-electric to-blue-electric-dark flex items-center justify-center text-sm font-semibold">
            {user.initials}
          </div>
        </div>

        <a
          href="/api/auth/logout"
          className="text-xs text-navy-500 hover:text-navy-300 transition-colors ml-2"
          title="Sign out"
        >
          <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
            <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
            <polyline points="16 17 21 12 16 7" />
            <line x1="21" y1="12" x2="9" y2="12" />
          </svg>
        </a>
      </div>
    </nav>
  );
}
