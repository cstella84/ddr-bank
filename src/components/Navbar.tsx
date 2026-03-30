"use client";

import { ShieldIcon, BellIcon } from "./Icons";

export default function Navbar() {
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
        <button className="relative text-navy-400 hover:text-white transition-colors">
          <BellIcon className="w-5 h-5" />
          <span className="absolute -top-1 -right-1 w-2 h-2 bg-blue-electric rounded-full" />
        </button>

        <div className="flex items-center gap-3">
          <div className="text-right">
            <p className="text-sm font-medium leading-none">Sarah Mitchell</p>
            <p className="text-xs text-navy-400 mt-0.5">Personal Account</p>
          </div>
          <div className="w-9 h-9 rounded-full bg-gradient-to-br from-blue-electric to-blue-electric-dark flex items-center justify-center text-sm font-semibold">
            SM
          </div>
        </div>
      </div>
    </nav>
  );
}
