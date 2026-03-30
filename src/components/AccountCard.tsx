"use client";

interface AccountCardProps {
  type: string;
  accountNumber: string;
  balance: number;
  badge?: string;
  apy?: string;
  sparklineData: number[];
}

function Sparkline({ data }: { data: number[] }) {
  const width = 120;
  const height = 40;
  const max = Math.max(...data);
  const min = Math.min(...data);
  const range = max - min || 1;

  const points = data
    .map((val, i) => {
      const x = (i / (data.length - 1)) * width;
      const y = height - ((val - min) / range) * (height - 4) - 2;
      return `${x},${y}`;
    })
    .join(" ");

  return (
    <svg width={width} height={height} className="overflow-visible">
      <defs>
        <linearGradient id="sparkGradient" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#3B82F6" stopOpacity={0.2} />
          <stop offset="100%" stopColor="#3B82F6" stopOpacity={0} />
        </linearGradient>
      </defs>
      <polygon
        points={`0,${height} ${points} ${width},${height}`}
        fill="url(#sparkGradient)"
      />
      <polyline
        points={points}
        fill="none"
        stroke="#3B82F6"
        strokeWidth={2}
        strokeLinecap="round"
        strokeLinejoin="round"
        className="animate-draw-line"
      />
    </svg>
  );
}

export default function AccountCard({
  type,
  accountNumber,
  balance,
  badge,
  apy,
  sparklineData,
}: AccountCardProps) {
  return (
    <div className="bg-white rounded-xl border border-navy-200 p-6 shadow-sm hover:shadow-md transition-shadow">
      <div className="flex items-start justify-between mb-4">
        <div>
          <div className="flex items-center gap-2">
            <h3 className="text-sm font-medium text-navy-500">{type}</h3>
            {badge && (
              <span className="px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider bg-blue-electric/10 text-blue-electric rounded-full">
                {badge}
              </span>
            )}
            {apy && (
              <span className="px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider bg-success/10 text-success rounded-full">
                {apy} APY
              </span>
            )}
          </div>
          <p className="text-xs text-navy-400 mt-1">Account ••••{accountNumber}</p>
        </div>
        <Sparkline data={sparklineData} />
      </div>

      <p className="text-3xl font-semibold text-navy-950 tabular-nums">
        ${balance.toLocaleString("en-US", { minimumFractionDigits: 2 })}
      </p>
    </div>
  );
}
