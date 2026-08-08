"use client";

import { EXPLORER_URL } from "@/lib/contracts/abi";
import type { CivilizationEvent } from "@/lib/types";

export function LiveFeed({ events }: { events: CivilizationEvent[] }) {
  return (
    <div className="panel flex h-full min-h-[320px] flex-col">
      <div className="mb-3 flex items-center justify-between">
        <h2 className="font-[family-name:var(--font-display)] text-sm tracking-[0.25em] text-cyan-300">
          LIVE EVENTS
        </h2>
        <span className="pulse-dot" />
      </div>
      <div className="flex-1 space-y-2 overflow-y-auto pr-1">
        {events.length === 0 && (
          <p className="text-sm text-slate-500">Waiting for civilization activity…</p>
        )}
        {events.map((e) => (
          <div
            key={e.id}
            className="animate-fade-in rounded-lg border border-white/5 bg-white/[0.03] px-3 py-2"
          >
            <div className="flex items-start justify-between gap-3">
              <p className="text-sm text-slate-100">
                <span className="mr-1">{e.actorType === "AI" ? "🤖" : "👤"}</span>
                {e.message}
              </p>
              <time className="shrink-0 text-[10px] uppercase tracking-wider text-slate-500">
                {new Date(e.ts).toLocaleTimeString()}
              </time>
            </div>
            {e.txHash && (
              <a
                href={`${EXPLORER_URL}/tx/${e.txHash}`}
                target="_blank"
                rel="noreferrer"
                className="mt-1 inline-block font-mono text-[11px] text-cyan-400/80 hover:text-cyan-300"
              >
                {e.txHash.slice(0, 10)}…{e.txHash.slice(-6)} · Monad
              </a>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
