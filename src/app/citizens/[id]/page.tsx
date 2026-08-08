"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { parseEther } from "viem";
import { useAccount, usePublicClient, useWriteContract } from "wagmi";
import type { Citizen, CivilizationEvent } from "@/lib/types";
import { CIVILIZATION_ADDRESS, civilizationAbi, EXPLORER_URL } from "@/lib/contracts/abi";

export default function CitizenProfilePage() {
  const params = useParams<{ id: string }>();
  const [citizen, setCitizen] = useState<Citizen | null>(null);
  const [events, setEvents] = useState<CivilizationEvent[]>([]);
  const [employerId, setEmployerId] = useState<string | null>(null);
  const [msg, setMsg] = useState<string | null>(null);
  const { address, isConnected } = useAccount();
  const publicClient = usePublicClient();
  const { writeContractAsync, isPending } = useWriteContract();
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    void fetch(`/api/citizens/${params.id}`)
      .then((r) => r.json())
      .then((d) => {
        setCitizen(d.citizen);
        setEvents(d.events || []);
      });
  }, [params.id]);

  useEffect(() => {
    if (!address) return;
    void fetch("/api/state")
      .then((r) => r.json())
      .then((d) => {
        const me = (d.citizens as Citizen[]).find(
          (c) => c.walletAddress.toLowerCase() === address.toLowerCase(),
        );
        setEmployerId(me?.id ?? null);
      });
  }, [address]);

  async function hire() {
    if (!citizen || !address || !employerId) {
      setMsg("Join the civilization first from the landing page.");
      return;
    }
    setSubmitting(true);
    setMsg(null);
    let txHash: `0x${string}` | undefined;
    const zero = "0x0000000000000000000000000000000000000000";
    try {
      if (CIVILIZATION_ADDRESS && CIVILIZATION_ADDRESS !== zero) {
        if (!publicClient) throw new Error("Monad RPC is not ready. Please try again.");
        txHash = await writeContractAsync({
          address: CIVILIZATION_ADDRESS,
          abi: civilizationAbi,
          functionName: "hireAgent",
          args: [citizen.walletAddress as `0x${string}`, parseEther("2")],
          value: parseEther("2"),
        });
        const receipt = await publicClient.waitForTransactionReceipt({ hash: txHash });
        if (receipt.status !== "success") throw new Error("Monad did not confirm this hire.");
      }

      const res = await fetch("/api/hire", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ employerId, agentId: citizen.id, txHash }),
      });
      if (!res.ok) {
        const body = (await res.json().catch(() => null)) as { error?: string } | null;
        throw new Error(body?.error || "The hire confirmed, but MONADIA could not sync it yet.");
      }
      setMsg(
        CIVILIZATION_ADDRESS && CIVILIZATION_ADDRESS !== zero
          ? `${citizen.name} is now working for you · confirmed on Monad.`
          : `${citizen.name} is now working for you.`,
      );
      const refreshed = await fetch(`/api/citizens/${citizen.id}`).then((response) => response.json());
      setCitizen(refreshed.citizen);
    } catch (error) {
      setMsg(error instanceof Error ? error.message : "Could not hire agent");
    } finally {
      setSubmitting(false);
    }
  }

  if (!citizen) {
    return <div className="p-8 text-slate-400">Loading citizen…</div>;
  }

  return (
    <div className="mx-auto max-w-3xl space-y-6 px-4 py-8">
      <div className="panel glow-cyan">
        <p className="text-xs uppercase tracking-[0.25em] text-cyan-300">
          {citizen.type === "AI" ? "🤖 AI Citizen" : "👤 Human Citizen"}
        </p>
        <h1 className="mt-2 font-[family-name:var(--font-display)] text-5xl tracking-wide text-cyan-50">
          {citizen.name}
        </h1>
        <div className="mt-6 grid gap-3 sm:grid-cols-2">
          <div>
            <p className="text-xs uppercase text-slate-500">Occupation</p>
            <p>{citizen.occupation}</p>
          </div>
          <div>
            <p className="text-xs uppercase text-slate-500">Personality</p>
            <p>{citizen.personality}</p>
          </div>
          <div className="sm:col-span-2">
            <p className="text-xs uppercase text-slate-500">Goal</p>
            <p>{citizen.goal}</p>
          </div>
        </div>
        <div className="mt-6 grid grid-cols-2 gap-3 text-center sm:grid-cols-4">
          <div className="rounded-lg bg-white/[0.03] p-3">
            <p className="text-xs text-slate-500">Balance</p>
            <p className="text-xl text-cyan-100">{citizen.balance.toFixed(2)}</p>
            <p className="text-[10px] text-slate-600">MON</p>
          </div>
          <div className="rounded-lg bg-white/[0.03] p-3">
            <p className="text-xs text-slate-500">Civic Coins</p>
            <p className="text-xl text-amber-200">{citizen.coins.toFixed(1)}</p>
            <p className="text-[10px] text-slate-600">MDA</p>
          </div>
          <div className="rounded-lg bg-white/[0.03] p-3">
            <p className="text-xs text-slate-500">Net Worth</p>
            <p className="text-xl text-cyan-100">{citizen.netWorth.toFixed(2)}</p>
            <p className="text-[10px] text-slate-600">MON</p>
          </div>
          <div className="rounded-lg bg-white/[0.03] p-3">
            <p className="text-xs text-slate-500">Reputation</p>
            <p className="text-xl text-cyan-100">{citizen.reputation}</p>
            <p className="text-[10px] text-slate-600">score</p>
          </div>
        </div>
        <div className="mt-4 text-sm text-slate-400">
          Inventory — Food {citizen.inventory.food} · Iron {citizen.inventory.iron} · Energy{" "}
          {citizen.inventory.energy}
        </div>
      </div>

      {citizen.type === "AI" && (
        <div className="panel">
          <h2 className="font-[family-name:var(--font-display)] text-sm tracking-[0.25em] text-cyan-300">
            AI REASONING
          </h2>
          <p className="mt-3 text-slate-200">
            “{citizen.lastReasoning || "Awaiting next decision cycle."}”
          </p>
          {citizen.employerId ? (
            <p className="mt-4 text-sm text-amber-200">Currently employed by a human citizen.</p>
          ) : (
            <div className="mt-4">
              <p className="text-sm text-slate-400">Hiring cost: 2 MON/day</p>
              <button
                className="btn-primary mt-3"
                disabled={!isConnected || isPending || submitting}
                onClick={() => void hire()}
              >
                {isPending || submitting ? "Confirming…" : `Hire ${citizen.name}`}
              </button>
              {msg && <p className={`mt-2 text-sm ${msg.includes("working") ? "text-emerald-300" : "text-rose-300"}`}>{msg}</p>}
            </div>
          )}
        </div>
      )}

      <div className="panel">
        <h2 className="font-[family-name:var(--font-display)] text-sm tracking-[0.25em] text-cyan-300">
          RECENT ACTIVITY
        </h2>
        <div className="mt-3 space-y-2">
          {events.slice(0, 12).map((e) => (
            <div key={e.id} className="rounded-lg bg-white/[0.03] px-3 py-2 text-sm">
              {e.message}
              {e.txHash && (
                <a
                  className="mt-1 block font-mono text-[11px] text-cyan-400"
                  href={`${EXPLORER_URL}/tx/${e.txHash}`}
                  target="_blank"
                  rel="noreferrer"
                >
                  {e.txHash.slice(0, 12)}…
                </a>
              )}
            </div>
          ))}
          {!events.length && <p className="text-sm text-slate-500">No recent activity yet.</p>}
        </div>
      </div>

      <div className="panel">
        <h2 className="font-[family-name:var(--font-display)] text-sm tracking-[0.25em] text-cyan-300">
          WALLET
        </h2>
        <p className="mt-2 font-mono text-sm text-slate-300">{citizen.walletAddress}</p>
        <a
          className="btn-ghost mt-4 inline-flex text-sm"
          href={`${EXPLORER_URL}/address/${citizen.walletAddress}`}
          target="_blank"
          rel="noreferrer"
        >
          View on Monad Explorer
        </a>
      </div>
    </div>
  );
}
