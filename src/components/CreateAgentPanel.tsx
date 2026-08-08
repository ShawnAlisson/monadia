"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useAccount } from "wagmi";
import { AGENT_DEPLOY } from "@/lib/agents/economy";
import type { Citizen, Occupation, Personality } from "@/lib/types";

type SkillDraft = { name: string; description: string; promptHint: string };

const OCCUPATIONS: Occupation[] = [
  "Poet",
  "Psychologist",
  "Doctor",
  "Librarian",
  "Banker",
  "Architect",
  "Journalist",
  "Chef",
  "Merchant",
  "Trader",
  "Engineer",
  "Farmer",
  "Entrepreneur",
];

const PERSONALITIES: Personality[] = [
  "Balanced",
  "Aggressive",
  "Conservative",
  "Speculative",
  "Industrial",
  "Revolutionary",
];

const emptySkill = (): SkillDraft => ({ name: "", description: "", promptHint: "" });

export function CreateAgentPanel({ onCreated }: { onCreated?: () => void }) {
  const { address, isConnected } = useAccount();
  const [owned, setOwned] = useState<Citizen[]>([]);
  const [name, setName] = useState("");
  const [goal, setGoal] = useState("");
  const [occupation, setOccupation] = useState<Occupation>("Poet");
  const [personality, setPersonality] = useState<Personality>("Balanced");
  const [skillPrice, setSkillPrice] = useState(String(AGENT_DEPLOY.defaultSkillPrice));
  const [skills, setSkills] = useState<SkillDraft[]>([
    {
      name: "Signature Skill",
      description: "What visitors get when they pay to use this skill.",
      promptHint: "Answer in character as this building. Be useful and brief.",
    },
  ]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [status, setStatus] = useState<string | null>(null);
  const [open, setOpen] = useState(false);

  async function refreshOwned() {
    if (!address) return;
    const res = await fetch(`/api/agents/create?wallet=${address}`, { cache: "no-store" });
    if (!res.ok) return;
    const body = (await res.json()) as { agents: Citizen[] };
    setOwned(body.agents || []);
  }

  useEffect(() => {
    void refreshOwned();
  }, [address]);

  async function deploy() {
    if (!address) return;
    setBusy(true);
    setError(null);
    setStatus(null);
    try {
      const res = await fetch("/api/agents/create", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          walletAddress: address,
          name,
          goal,
          occupation,
          personality,
          skillPrice: Number(skillPrice),
          skills: skills.filter((s) => s.name.trim() && s.description.trim() && s.promptHint.trim()),
        }),
      });
      const body = (await res.json()) as { error?: string; agent?: Citizen };
      if (!res.ok) throw new Error(body.error || "Deploy failed");
      setStatus(`${body.agent?.name} is live in the city. Visitors pay you when they use skills.`);
      setName("");
      setGoal("");
      setSkills([emptySkill()]);
      await refreshOwned();
      onCreated?.();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Deploy failed");
    } finally {
      setBusy(false);
    }
  }

  if (!isConnected) {
    return (
      <div className="panel">
        <p className="font-[family-name:var(--font-display)] text-sm tracking-[0.2em] text-cyan-300">
          DEPLOY YOUR AGENT
        </p>
        <p className="mt-2 text-sm text-slate-400">
          Connect a wallet and join MONADIA to launch an AI service building and earn world MON.
        </p>
      </div>
    );
  }

  return (
    <div className="panel glow-cyan space-y-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="font-[family-name:var(--font-display)] text-sm tracking-[0.2em] text-cyan-300">
            DEPLOY YOUR AGENT
          </p>
          <p className="mt-1 text-sm text-slate-400">
            Create a named AI office with your own skills. Visitors pay world MON per use — you keep{" "}
            {Math.round((1 - AGENT_DEPLOY.cityTaxShare) * 100)}%, city takes{" "}
            {Math.round(AGENT_DEPLOY.cityTaxShare * 100)}%. Cost to deploy:{" "}
            <span className="text-cyan-100">{AGENT_DEPLOY.createCost} MON</span>.
          </p>
        </div>
        <button className="btn-ghost text-sm" onClick={() => setOpen((v) => !v)}>
          {open ? "Hide form" : "Open form"}
        </button>
      </div>

      {owned.length > 0 && (
        <div className="grid gap-2 sm:grid-cols-2">
          {owned.map((a) => (
            <Link
              key={a.id}
              href={`/citizens/${a.id}`}
              className="rounded-lg border border-cyan-300/15 bg-black/20 px-3 py-2 text-sm hover:border-cyan-300/35"
            >
              <p className="text-cyan-50">{a.name}</p>
              <p className="text-xs text-slate-500">
                {a.skillPrice} MON/use · earned {a.skillEarnings.toFixed(2)} MON · {a.skillUses} uses
              </p>
            </Link>
          ))}
        </div>
      )}

      {open && (
        <div className="space-y-3 border-t border-cyan-300/10 pt-3">
          <div className="grid gap-3 sm:grid-cols-2">
            <label className="block text-xs uppercase tracking-wider text-slate-500">
              Building name
              <input
                className="mt-1"
                placeholder="Night Poetry Studio"
                value={name}
                onChange={(e) => setName(e.target.value)}
                maxLength={40}
              />
            </label>
            <label className="block text-xs uppercase tracking-wider text-slate-500">
              Skill price (MON)
              <input
                className="mt-1"
                type="number"
                min={AGENT_DEPLOY.minSkillPrice}
                max={AGENT_DEPLOY.maxSkillPrice}
                step="0.1"
                value={skillPrice}
                onChange={(e) => setSkillPrice(e.target.value)}
              />
            </label>
            <label className="block text-xs uppercase tracking-wider text-slate-500">
              District vibe
              <select
                className="mt-1"
                value={occupation}
                onChange={(e) => setOccupation(e.target.value as Occupation)}
              >
                {OCCUPATIONS.map((o) => (
                  <option key={o} value={o}>
                    {o}
                  </option>
                ))}
              </select>
            </label>
            <label className="block text-xs uppercase tracking-wider text-slate-500">
              Personality
              <select
                className="mt-1"
                value={personality}
                onChange={(e) => setPersonality(e.target.value as Personality)}
              >
                {PERSONALITIES.map((p) => (
                  <option key={p} value={p}>
                    {p}
                  </option>
                ))}
              </select>
            </label>
          </div>
          <label className="block text-xs uppercase tracking-wider text-slate-500">
            Mission
            <input
              className="mt-1"
              placeholder="Help citizens write better city poems"
              value={goal}
              onChange={(e) => setGoal(e.target.value)}
              maxLength={160}
            />
          </label>

          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <p className="text-xs uppercase tracking-wider text-slate-500">
                Skills ({skills.length}/{AGENT_DEPLOY.maxSkills})
              </p>
              {skills.length < AGENT_DEPLOY.maxSkills && (
                <button
                  type="button"
                  className="btn-ghost !px-2 !py-1 text-[11px]"
                  onClick={() => setSkills((s) => [...s, emptySkill()])}
                >
                  + Add skill
                </button>
              )}
            </div>
            {skills.map((skill, index) => (
              <div key={index} className="space-y-2 rounded-lg bg-black/20 p-3">
                <div className="flex items-center justify-between">
                  <p className="text-[11px] text-cyan-200/80">Skill {index + 1}</p>
                  {skills.length > 1 && (
                    <button
                      type="button"
                      className="text-[11px] text-slate-500 hover:text-rose-300"
                      onClick={() => setSkills((s) => s.filter((_, i) => i !== index))}
                    >
                      Remove
                    </button>
                  )}
                </div>
                <input
                  placeholder="Skill name"
                  value={skill.name}
                  onChange={(e) =>
                    setSkills((list) =>
                      list.map((s, i) => (i === index ? { ...s, name: e.target.value } : s)),
                    )
                  }
                  maxLength={40}
                />
                <input
                  placeholder="What visitors get"
                  value={skill.description}
                  onChange={(e) =>
                    setSkills((list) =>
                      list.map((s, i) =>
                        i === index ? { ...s, description: e.target.value } : s,
                      ),
                    )
                  }
                  maxLength={160}
                />
                <textarea
                  className="min-h-[64px] w-full resize-none rounded-lg border border-cyan-400/15 bg-black/20 px-3 py-2 text-sm text-cyan-50 outline-none focus:border-cyan-300/40"
                  placeholder="AI instruction — how this skill should answer"
                  value={skill.promptHint}
                  onChange={(e) =>
                    setSkills((list) =>
                      list.map((s, i) =>
                        i === index ? { ...s, promptHint: e.target.value } : s,
                      ),
                    )
                  }
                  maxLength={220}
                />
              </div>
            ))}
          </div>

          <button className="btn-primary w-full" disabled={busy} onClick={() => void deploy()}>
            {busy
              ? "Deploying…"
              : `Deploy for ${AGENT_DEPLOY.createCost} MON (${owned.length}/${AGENT_DEPLOY.maxPerHuman} used)`}
          </button>
          {status && <p className="text-sm text-emerald-300">{status}</p>}
          {error && <p className="text-sm text-rose-300">{error}</p>}
        </div>
      )}
    </div>
  );
}
