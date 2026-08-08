"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import dynamic from "next/dynamic";
import { useAccount } from "wagmi";
import { useCivilization } from "@/hooks/useCivilization";
import type { WorldSelection } from "@/components/world/WorldScene";
import { AgentInteractPanel } from "@/components/AgentInteractPanel";

const WorldScene = dynamic(() => import("@/components/world/WorldScene"), {
  ssr: false,
  loading: () => (
    <div className="flex h-full items-center justify-center">
      <div className="text-center">
        <div className="pulse-dot mx-auto mb-3" />
        <p className="font-[family-name:var(--font-display)] tracking-[0.3em] text-cyan-300">
          RENDERING MONADIA
        </p>
      </div>
    </div>
  ),
});

export default function WorldPage() {
  const { data, error } = useCivilization(2000);
  const { address } = useAccount();
  const [selection, setSelection] = useState<WorldSelection>(null);

  const me = useMemo(() => {
    if (!data || !address) return null;
    return (
      data.citizens.find((c) => c.walletAddress.toLowerCase() === address.toLowerCase()) ?? null
    );
  }, [data, address]);

  const selected = useMemo(() => {
    if (!data || !selection) return null;
    if (selection.kind === "citizen") {
      const c = data.citizens.find((x) => x.id === selection.id);
      return c ? ({ kind: "citizen", citizen: c } as const) : null;
    }
    const b = data.businesses.find((x) => x.id === selection.id);
    return b ? ({ kind: "business", business: b } as const) : null;
  }, [data, selection]);

  if (error) {
    return (
      <div className="mx-auto flex min-h-[65vh] max-w-xl items-center px-6">
        <div className="panel w-full text-center">
          <p className="font-[family-name:var(--font-display)] text-xl tracking-wide text-cyan-100">
            CITY TEMPORARILY UNAVAILABLE
          </p>
          <p className="mt-3 text-sm leading-6 text-slate-300">{error}</p>
          <p className="mt-4 text-xs text-slate-500">
            The operator can verify the deployment at <code>/api/health</code>.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="relative h-[calc(100dvh-62px)] w-full overflow-hidden">
      {data ? (
        <WorldScene
          citizens={data.citizens}
          businesses={data.businesses}
          events={data.events}
          selection={selection}
          onSelect={setSelection}
          playerWallet={address}
          playerName={me?.name}
        />
      ) : (
        <div className="flex h-full items-center justify-center text-slate-400">
          Bootstrapping civilization…
        </div>
      )}

      {data && (
        <div className="pointer-events-none absolute left-4 top-4 flex items-center gap-2 text-xs sm:left-6 sm:top-5">
          <div className="rounded-full border border-cyan-300/20 bg-[#06111c]/80 px-3 py-2 text-cyan-100 shadow-xl backdrop-blur-xl">
            <span className="text-cyan-300">●</span> {data.metrics.population} citizens
          </div>
          <div className="hidden rounded-full border border-amber-300/20 bg-[#06111c]/80 px-3 py-2 text-amber-100 shadow-xl backdrop-blur-xl sm:block">
            ◈ {data.metrics.treasury.toFixed(0)} MON city treasury
          </div>
        </div>
      )}

      <div className="pointer-events-none absolute bottom-4 left-4 hidden text-[11px] leading-5 text-slate-500 md:block">
        <p>WASD to move · click a person or building to inspect</p>
        <p>
          <span className="text-cyan-300">●</span> AI agent building ·{" "}
          <span className="text-amber-300">●</span> Human citizen
        </p>
      </div>

      {data && (
        <div className="pointer-events-none absolute bottom-5 left-1/2 hidden max-w-[min(80vw,430px)] -translate-x-1/2 rounded-full border border-cyan-400/10 bg-[#050b12]/75 px-4 py-2 text-center text-xs text-slate-300 backdrop-blur sm:block">
          <span className="mr-2 text-cyan-300">LIVE</span>
          {data.events[0]?.message ?? "The city is online."}
        </div>
      )}

      {selected && (
        <div className="absolute right-4 top-4 max-h-[min(78vh,640px)] w-[min(88vw,330px)] overflow-y-auto animate-fade-in">
          <div className="panel glow-cyan !p-4">
            <button
              className="absolute right-3 top-2 text-slate-500 hover:text-white"
              onClick={() => setSelection(null)}
              aria-label="Close"
            >
              ✕
            </button>

            {selected.kind === "citizen" ? (
              <>
                <p className="font-[family-name:var(--font-display)] text-lg tracking-wide text-cyan-100">
                  {selected.citizen.type === "AI" ? "🏢 AI BUILDING" : "👤 HUMAN CITIZEN"} ·{" "}
                  {selected.citizen.name}
                </p>
                <p className="text-xs text-slate-400">
                  {selected.citizen.occupation} · {selected.citizen.personality}
                </p>
                <p className="mt-2 text-xs italic text-slate-300">
                  “{selected.citizen.goal}”
                </p>
                <div className="mt-3 grid grid-cols-2 gap-x-4 gap-y-1 text-sm tabular-nums">
                  <span className="text-slate-400">MON (last sync)</span>
                  <span className="text-right text-cyan-100">
                    {selected.citizen.balance.toFixed(2)} MON
                  </span>
                  <span className="text-slate-400">World value</span>
                  <span className="text-right text-cyan-100">
                    {selected.citizen.netWorth.toFixed(2)} MON
                  </span>
                  <span className="text-slate-400">Reputation</span>
                  <span className="text-right text-cyan-100">
                    {selected.citizen.reputation}
                  </span>
                  <span className="text-slate-400">Civic coins</span>
                  <span className="text-right text-amber-200">
                    {selected.citizen.coins.toFixed(1)} MDA
                  </span>
                  <span className="text-slate-400">Inventory</span>
                  <span className="text-right text-cyan-100">
                    🌾{selected.citizen.inventory.food} ⛏{selected.citizen.inventory.iron} ⚡
                    {selected.citizen.inventory.energy}
                  </span>
                </div>
                {selected.citizen.lastReasoning && (
                  <p className="mt-3 rounded-lg bg-white/[0.04] p-2 text-xs text-slate-300">
                    {selected.citizen.lastReasoning}
                  </p>
                )}
                {selected.citizen.type === "AI" && (
                  <AgentInteractPanel
                    agentId={selected.citizen.id}
                    agentName={selected.citizen.name}
                  />
                )}
                <Link
                  href={`/citizens/${selected.citizen.id}`}
                  className="btn-ghost mt-3 w-full !py-2 text-sm"
                >
                  {selected.citizen.type === "AI"
                    ? "Open agent terminal →"
                    : "Open citizen profile →"}
                </Link>
              </>
            ) : (
              <>
                <p className="font-[family-name:var(--font-display)] text-lg tracking-wide text-cyan-100">
                  🏭 {selected.business.name}
                </p>
                <p className="text-xs text-slate-400">
                  {selected.business.businessType === 0
                    ? "Farm — produces Food"
                    : selected.business.businessType === 1
                      ? "Factory — produces Iron"
                      : "Power plant — produces Energy"}
                </p>
                <div className="mt-3 grid grid-cols-2 gap-x-4 gap-y-1 text-sm tabular-nums">
                  <span className="text-slate-400">Owner</span>
                  <span className="text-right text-cyan-100">{selected.business.ownerName}</span>
                  <span className="text-slate-400">Employees</span>
                  <span className="text-right text-cyan-100">{selected.business.employees}</span>
                  <span className="text-slate-400">World output</span>
                  <span className="text-right text-cyan-100">
                    {selected.business.revenuePerDay.toFixed(1)} MON/day
                  </span>
                </div>
                <Link
                  href={`/citizens/${selected.business.ownerId}`}
                  className="btn-ghost mt-3 w-full !py-2 text-sm"
                >
                  Owner profile →
                </Link>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
