"use client";

import { useState } from "react";
import { useAccount, usePublicClient, useWriteContract } from "wagmi";
import { useCivilization } from "@/hooks/useCivilization";
import { CIVILIZATION_ADDRESS, civilizationAbi } from "@/lib/contracts/abi";

const zero = "0x0000000000000000000000000000000000000000";
const hasDeployedCivilization = CIVILIZATION_ADDRESS !== zero;

export default function GovernancePage() {
  const { data, refresh } = useCivilization(3000);
  const { address, isConnected } = useAccount();
  const publicClient = usePublicClient();
  const { writeContractAsync, isPending } = useWriteContract();
  const [submitting, setSubmitting] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  const proposal = data?.proposals.find((item) => item.active) || data?.proposals[0];
  const totalVotes = proposal ? proposal.yesVotes + proposal.noVotes : 0;
  const yesPct = totalVotes ? Math.round((proposal!.yesVotes / totalVotes) * 100) : 0;
  const noPct = totalVotes ? 100 - yesPct : 0;

  async function vote(support: boolean) {
    if (!address || !proposal) return;
    setSubmitting(true);
    setMsg(null);
    try {
      let txHash: `0x${string}` | undefined;
      if (hasDeployedCivilization) {
        if (proposal.onChainId == null) {
          throw new Error("This proposal is not live on Monad yet. Ask the operator to publish it first.");
        }
        if (!publicClient) throw new Error("Monad RPC is not ready. Please try again.");
        txHash = await writeContractAsync({
          address: CIVILIZATION_ADDRESS,
          abi: civilizationAbi,
          functionName: "vote",
          args: [BigInt(proposal.onChainId), support],
        });
        const receipt = await publicClient.waitForTransactionReceipt({ hash: txHash });
        if (receipt.status !== "success") throw new Error("Monad did not confirm this vote.");
      }
      const res = await fetch("/api/activity", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          kind: "VOTE",
          walletAddress: address,
          proposalId: proposal.id,
          support,
          txHash,
        }),
      });
      if (!res.ok) {
        const body = (await res.json().catch(() => null)) as { error?: string } | null;
        throw new Error(body?.error || "The vote confirmed, but MONADIA could not sync it yet.");
      }
      setMsg(hasDeployedCivilization ? `Vote confirmed on Monad · ${txHash?.slice(0, 10)}…` : `Voted ${support ? "YES" : "NO"}`);
      await refresh();
    } catch (error) {
      setMsg(error instanceof Error ? error.message : "Vote failed");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="mx-auto max-w-3xl space-y-6 px-4 py-8">
      <div>
        <h1 className="font-[family-name:var(--font-display)] text-4xl tracking-[0.12em] text-cyan-100">
          GOVERNANCE
        </h1>
        <p className="mt-1 text-slate-400">
          Citizens can record their civic position on shared proposals.
        </p>
      </div>

      {!proposal ? (
        <div className="panel text-slate-400">No active proposals.</div>
      ) : (
        <div className="panel glow-cyan">
          <p className="text-xs uppercase tracking-[0.25em] text-cyan-300">
            {proposal.onChainId == null ? "Draft proposal" : `On-chain proposal #${proposal.onChainId + 1}`}
          </p>
          <h2 className="mt-3 text-2xl text-cyan-50">{proposal.description}</h2>

          <div className="mt-6 space-y-2">
            <div className="flex justify-between text-sm">
              <span className="text-emerald-300">YES {yesPct}%</span>
              <span className="text-rose-300">NO {noPct}%</span>
            </div>
            <div className="flex h-3 overflow-hidden rounded-full bg-white/5">
              <div className="bg-emerald-400" style={{ width: `${yesPct}%` }} />
              <div className="bg-rose-400" style={{ width: `${noPct}%` }} />
            </div>
            <p className="text-sm text-slate-500">Votes: {totalVotes}</p>
          </div>

          <div className="mt-6 flex gap-3">
            <button
              className="btn-primary flex-1"
              disabled={!isConnected || isPending || submitting}
              onClick={() => void vote(true)}
            >
              Vote YES
            </button>
            <button
              className="btn-ghost flex-1"
              disabled={!isConnected || isPending || submitting}
              onClick={() => void vote(false)}
            >
              Vote NO
            </button>
          </div>
          {hasDeployedCivilization && proposal.onChainId == null && (
            <p className="mt-3 text-xs text-amber-200">The operator must publish this draft on Monad before voting opens.</p>
          )}
          {msg && <p className={`mt-3 text-sm ${msg.includes("confirmed") || msg.startsWith("Voted") ? "text-emerald-300" : "text-rose-300"}`}>{msg}</p>}
        </div>
      )}

      <div className="panel">
        <h3 className="text-sm uppercase tracking-[0.2em] text-slate-400">How AI votes</h3>
        <p className="mt-3 text-sm text-slate-300">
          Revolutionary agents usually support civic investment; conservative agents tend to protect capital;
          merchants react first to market conditions.
        </p>
        <p className="mt-3 text-xs text-slate-500">
          The current testnet contract records votes on Monad. Tax-rate execution remains an operator action until a governed executor is deployed.
        </p>
      </div>
    </div>
  );
}
