"use client";

import dynamic from "next/dynamic";

const AuthFlowDiagram = dynamic(() => import("@/components/AuthFlowDiagram"), {
  ssr: false,
  loading: () => (
    <div className="min-h-screen flex items-center justify-center bg-navy-950">
      <div className="text-navy-400 text-sm animate-pulse">Loading diagram...</div>
    </div>
  ),
});

export default function AuthFlowPage() {
  return <AuthFlowDiagram />;
}
