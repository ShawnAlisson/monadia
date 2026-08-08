"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useCivilization } from "@/hooks/useCivilization";
import type { Citizen } from "@/lib/types";

type SortKey = "wealth" | "reputation" | "activity";

export default function CitizensPage() {
  const { data } = useCivilization(3000);
  const [tab, setTab] = useState<"ALL" | "HUMAN" | "AI">("ALL");
  const [sort, setSort] = useState<SortKey>("wealth");

  const citizens = useMemo(() => {
    let list: Citizen[] = data?.citizens ?? [];
    if (tab !== "ALL") list = list.filter((c) => c.type === tab);
    if (sort === "wealth") list = [...list].sort((a, b) => b.netWorth - a.netWorth);
    if (sort === "reputation") list = [...list].sort((a, b) => b.reputation - a.reputation);
    if (sort === "activity") list = [...list].sort((a, b) => b.updatedAt - a.updatedAt);
    return list;
  }, [data, tab, sort]);

  return (
    <div className="mx-auto max-w-6xl space-y-6 px-4 py-8">
      <div>
        <h1 className="font-[family-name:var(--font-display)] text-4xl tracking-[0.12em] text-cyan-100">
          CITIZENS
        </h1>
        <p className="mt-1 text-slate-400">Humans and AI agents in the same economy.</p>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex gap-2">
          {(["ALL", "HUMANS", "AI"] as const).map((label) => {
            const value = label === "HUMANS" ? "HUMAN" : label;
            return (
              <button
                key={label}
                onClick={() => setTab(value as typeof tab)}
                className={`rounded-lg px-3 py-1.5 text-sm ${
                  tab === value ? "bg-cyan-400 text-black" : "bg-white/5 text-slate-300"
                }`}
              >
                {label}
              </button>
            );
          })}
        </div>
        <select
          className="w-auto"
          value={sort}
          onChange={(e) => setSort(e.target.value as SortKey)}
        >
          <option value="wealth">Sort: Wealth</option>
          <option value="reputation">Sort: Reputation</option>
          <option value="activity">Sort: Activity</option>
        </select>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {citizens.map((c) => (
          <div key={c.id} className="panel glow-cyan">
            <div className="flex items-start justify-between">
              <div>
                <p className="text-lg text-cyan-50">
                  {c.type === "AI" ? "🤖" : "👤"} {c.name}
                </p>
                <p className="text-sm text-slate-400">
                  {c.occupation} · {c.personality}
                </p>
              </div>
              <span className="rounded-full bg-white/5 px-2 py-0.5 text-[10px] uppercase tracking-wider text-slate-400">
                {c.type}
              </span>
            </div>
            <div className="mt-4 space-y-1 text-sm">
              <p>💰 {c.balance.toFixed(2)} MON</p>
              <p>🪙 {c.coins.toFixed(1)} MDA</p>
              <p>📈 Net Worth: {c.netWorth.toFixed(2)} MON</p>
              <p>⭐ Reputation: {c.reputation}</p>
            </div>
            <p className="mt-3 text-xs text-slate-500">Goal: {c.goal}</p>
            <Link href={`/citizens/${c.id}`} className="btn-ghost mt-4 w-full text-sm">
              View Profile
            </Link>
          </div>
        ))}
      </div>
    </div>
  );
}
