"use client";

import Link from "next/link";
import type { Business, Citizen } from "@/lib/types";

const TILE = 8;

export function CivilizationMap({
  citizens,
  businesses,
}: {
  citizens: Citizen[];
  businesses: Business[];
}) {
  const cells: Record<string, { label: string; href?: string; tone: string }> = {};

  cells["2,2"] = { label: "🏛", tone: "landmark" };
  cells["6,2"] = { label: "⚡", tone: "landmark" };
  cells["2,6"] = { label: "🌾", tone: "landmark" };
  cells["6,6"] = { label: "⛏", tone: "landmark" };

  for (const b of businesses.slice(0, 12)) {
    const owner = citizens.find((c) => c.id === b.ownerId);
    const x = owner ? Math.min(TILE, Math.max(1, owner.mapX)) : 3;
    const y = owner ? Math.min(TILE, Math.max(1, ((owner.mapY + 1) % TILE) + 1)) : 3;
    cells[`${x},${y}`] = {
      label: b.businessType === 0 ? "🌾" : b.businessType === 1 ? "🏭" : "⚡",
      href: `/citizens/${b.ownerId}`,
      tone: "business",
    };
  }

  for (const c of citizens) {
    const key = `${Math.min(TILE, Math.max(1, c.mapX))},${Math.min(TILE, Math.max(1, c.mapY))}`;
    cells[key] = {
      label: c.type === "AI" ? "🤖" : "👤",
      href: `/citizens/${c.id}`,
      tone: c.type === "AI" ? "ai" : "human",
    };
  }

  return (
    <div className="panel">
      <div className="mb-3 flex items-center justify-between">
        <h2 className="font-[family-name:var(--font-display)] text-sm tracking-[0.25em] text-cyan-300">
          LIVE CIVILIZATION
        </h2>
        <Link href="/world" className="text-xs text-cyan-300 hover:underline">
          Enter 3D world →
        </Link>
      </div>
      <div
        className="grid gap-1.5"
        style={{ gridTemplateColumns: `repeat(${TILE}, minmax(0, 1fr))` }}
      >
        {Array.from({ length: TILE * TILE }).map((_, i) => {
          const x = (i % TILE) + 1;
          const y = Math.floor(i / TILE) + 1;
          const cell = cells[`${x},${y}`];
          const base =
            "aspect-square rounded-md border border-white/5 bg-[#0a1520] flex items-center justify-center text-lg transition hover:border-cyan-400/40";
          if (!cell) return <div key={i} className={`${base} opacity-60`} />;
          const content = (
            <div
              className={`${base} ${
                cell.tone === "ai"
                  ? "bg-cyan-400/10 shadow-[0_0_20px_rgba(61,230,193,0.15)]"
                  : cell.tone === "human"
                    ? "bg-amber-400/10"
                    : "bg-white/5"
              }`}
              title={cell.label}
            >
              {cell.label}
            </div>
          );
          return cell.href ? (
            <Link key={i} href={cell.href}>
              {content}
            </Link>
          ) : (
            <div key={i}>{content}</div>
          );
        })}
      </div>
    </div>
  );
}
