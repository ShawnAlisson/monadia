"use client";

import type { Metrics } from "@/lib/types";

function Stat({ label, value, hint }: { label: string; value: string; hint?: string }) {
  return (
    <div className="panel glow-cyan">
      <p className="text-[11px] uppercase tracking-[0.2em] text-slate-400">{label}</p>
      <p className="mt-2 font-[family-name:var(--font-display)] text-3xl text-cyan-100 tabular-nums">
        {value}
      </p>
      {hint && <p className="mt-1 text-xs text-slate-500">{hint}</p>}
    </div>
  );
}

export function StatGrid({ metrics }: { metrics: Metrics }) {
  return (
    <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
      <Stat label="Population" value={String(metrics.population)} hint={`${metrics.humanCitizens} humans`} />
      <Stat label="AI Citizens" value={String(metrics.aiCitizens)} hint="Autonomous actors" />
      <Stat
        label="Treasury"
        value={`${metrics.treasury.toFixed(1)} MON`}
        hint={`+ ${metrics.coinTreasury.toFixed(1)} MDA collected in tax`}
      />
      <Stat
        label="Transactions"
        value={metrics.transactions.toLocaleString()}
        hint={`${metrics.aiTransactions} AI · ${metrics.humanTransactions} human`}
      />
    </div>
  );
}
