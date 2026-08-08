"use client";

import { useEffect, useState } from "react";
import { StatGrid } from "@/components/StatGrid";
import { LiveFeed } from "@/components/LiveFeed";
import { CivilizationMap } from "@/components/CivilizationMap";
import { useCivilization } from "@/hooks/useCivilization";

export default function CivilizationPage() {
  const { data, error } = useCivilization(2000);
  const [summary, setSummary] = useState<{
    minutesAway: number;
    trades: number;
    businessesCreated: number;
    votes: number;
    foodPriceChangePct: number;
  } | null>(null);

  useEffect(() => {
    const key = "monadia_last_seen";
    const last = Number(localStorage.getItem(key) || 0);
    localStorage.setItem(key, String(Date.now()));
    if (last && Date.now() - last > 60_000) {
      void fetch(`/api/summary?since=${last}`)
        .then((r) => r.json())
        .then(setSummary)
        .catch(() => undefined);
    }
  }, []);

  if (error) {
    return <div className="p-8 text-red-300">{error}</div>;
  }

  if (!data) {
    return (
      <div className="mx-auto max-w-7xl px-4 py-16 text-slate-400">
        Bootstrapping civilization…
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-7xl space-y-6 px-4 py-8">
      <div>
        <h1 className="font-[family-name:var(--font-display)] text-4xl tracking-[0.12em] text-cyan-100">
          MONADIA
        </h1>
        <p className="mt-1 text-slate-400">A civilization of humans + AI on Monad Testnet</p>
      </div>

      {summary && (
        <div className="panel border-amber-400/30 bg-amber-400/5 animate-fade-in">
          <p className="font-[family-name:var(--font-display)] text-amber-200">
            You were away for {summary.minutesAway} minutes.
          </p>
          <p className="mt-2 text-sm text-slate-300">
            While you were gone: {summary.trades} trades · {summary.businessesCreated} businesses ·
            food {summary.foodPriceChangePct >= 0 ? "+" : ""}
            {summary.foodPriceChangePct}% · {summary.votes} votes cast.
          </p>
        </div>
      )}

      <StatGrid metrics={data.metrics} />

      <div className="grid gap-4 lg:grid-cols-5">
        <div className="lg:col-span-3">
          <CivilizationMap citizens={data.citizens} businesses={data.businesses} />
        </div>
        <div className="lg:col-span-2">
          <LiveFeed events={data.events} />
        </div>
      </div>

      <div className="panel">
        <h2 className="font-[family-name:var(--font-display)] text-sm tracking-[0.25em] text-cyan-300">
          MONAD NETWORK
        </h2>
        <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
          {[
            ["Transactions", data.metrics.transactions],
            ["AI Transactions", data.metrics.aiTransactions],
            ["Human Transactions", data.metrics.humanTransactions],
            ["Economic Events", data.metrics.economicEvents],
            ["Active Agents", data.metrics.aiCitizens],
          ].map(([label, value]) => (
            <div key={String(label)} className="rounded-lg bg-white/[0.03] p-3">
              <p className="text-[11px] uppercase tracking-wider text-slate-500">{label}</p>
              <p className="mt-1 text-2xl tabular-nums text-cyan-100">{Number(value).toLocaleString()}</p>
            </div>
          ))}
        </div>
        <p className="mt-3 text-xs text-slate-500">
          Metrics reflect recorded civilization activity in this deployment. On-chain hashes appear in
          the live feed when Monad txs confirm.
        </p>
      </div>
    </div>
  );
}
