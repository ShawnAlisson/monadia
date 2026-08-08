"use client";

import { useEffect, useState } from "react";
import { useAccount } from "wagmi";
import type { AgentSkill } from "@/lib/agents/skills";

export function AgentInteractPanel({
  agentId,
  agentName,
}: {
  agentId: string;
  agentName: string;
}) {
  const { address } = useAccount();
  const [skills, setSkills] = useState<AgentSkill[]>([]);
  const [skillId, setSkillId] = useState<string>("");
  const [message, setMessage] = useState("");
  const [reply, setReply] = useState<string | null>(null);
  const [llm, setLlm] = useState<"openai" | "local-fallback" | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    void fetch(`/api/agents/${agentId}/interact`)
      .then((r) => r.json())
      .then((d) => {
        if (cancelled) return;
        const list = (d.skills as AgentSkill[]) || [];
        setSkills(list);
        setSkillId(list[0]?.id ?? "");
        setLlm(d.llm === "openai" ? "openai" : "local-fallback");
      })
      .catch(() => undefined);
    return () => {
      cancelled = true;
    };
  }, [agentId]);

  async function ask() {
    if (!skillId || !message.trim()) return;
    setBusy(true);
    setError(null);
    setReply(null);
    try {
      const res = await fetch(`/api/agents/${agentId}/interact`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          skillId,
          message: message.trim(),
          walletAddress: address,
        }),
      });
      const body = (await res.json()) as {
        reply?: string;
        error?: string;
        llm?: "openai" | "local-fallback";
      };
      if (!res.ok) throw new Error(body.error || "Agent did not respond");
      setReply(body.reply || "");
      if (body.llm) setLlm(body.llm);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not reach agent");
    } finally {
      setBusy(false);
    }
  }

  if (!skills.length) {
    return <p className="mt-3 text-xs text-slate-500">Loading agent skills…</p>;
  }

  return (
    <div className="mt-3 space-y-2">
      <p className="text-[11px] uppercase tracking-[0.2em] text-cyan-300/80">Talk to {agentName}</p>
      <div className="flex flex-wrap gap-1.5">
        {skills.map((s) => (
          <button
            key={s.id}
            type="button"
            className={`rounded-lg border px-2 py-1 text-[11px] ${
              skillId === s.id
                ? "border-cyan-300/50 bg-cyan-400/15 text-cyan-100"
                : "border-white/10 bg-white/[0.03] text-slate-400 hover:border-cyan-300/30"
            }`}
            onClick={() => setSkillId(s.id)}
          >
            {s.name}
          </button>
        ))}
      </div>
      <p className="text-[11px] text-slate-500">
        {skills.find((s) => s.id === skillId)?.description}
      </p>
      <textarea
        className="min-h-[72px] w-full resize-none rounded-lg border border-cyan-400/15 bg-black/20 px-3 py-2 text-sm text-cyan-50 outline-none focus:border-cyan-300/40"
        placeholder={`Ask ${agentName} something…`}
        value={message}
        onChange={(e) => setMessage(e.target.value)}
        maxLength={500}
      />
      <button
        className="btn-primary w-full !py-2 text-sm"
        disabled={busy || !message.trim()}
        onClick={() => void ask()}
      >
        {busy ? "Thinking…" : "Use skill"}
      </button>
      {llm && (
        <p className="text-[10px] uppercase tracking-wider text-slate-600">
          {llm === "openai" ? "Powered by gpt-5.4-nano" : "Local fallback · set OPENAI_API_KEY for live AI"}
        </p>
      )}
      {reply && (
        <p className="rounded-lg border border-cyan-300/15 bg-cyan-400/5 p-2 text-xs leading-5 text-slate-200">
          {reply}
        </p>
      )}
      {error && <p className="text-xs text-rose-300">{error}</p>}
    </div>
  );
}
