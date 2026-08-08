"use client";

import { useMemo, useState } from "react";
import { formatEther, parseEther } from "viem";
import { useAccount, usePublicClient, useWriteContract } from "wagmi";
import { useCivilization } from "@/hooks/useCivilization";
import { CIVILIZATION_ADDRESS, civilizationAbi } from "@/lib/contracts/abi";
import { RESOURCES } from "@/lib/types";

const zero = "0x0000000000000000000000000000000000000000";
const hasDeployedCivilization = CIVILIZATION_ADDRESS !== zero;

function Sparkline({ values }: { values: number[] }) {
  if (values.length < 2) return <div className="h-10 text-xs text-slate-600">Collecting…</div>;
  const min = Math.min(...values);
  const max = Math.max(...values);
  const span = max - min || 1;
  const points = values
    .map((v, i) => {
      const x = (i / (values.length - 1)) * 100;
      const y = 100 - ((v - min) / span) * 100;
      return `${x},${y}`;
    })
    .join(" ");
  return (
    <svg viewBox="0 0 100 100" className="h-10 w-full stroke-cyan-300 fill-none">
      <polyline points={points} strokeWidth="3" vectorEffect="non-scaling-stroke" />
    </svg>
  );
}

export default function MarketPage() {
  const { data, refresh } = useCivilization(2500);
  const { address, isConnected } = useAccount();
  const publicClient = usePublicClient();
  const [resourceId, setResourceId] = useState(0);
  const [amount, setAmount] = useState(5);
  const [side, setSide] = useState<"BUY" | "SELL">("BUY");
  const { writeContractAsync, isPending } = useWriteContract();
  const [submitting, setSubmitting] = useState(false);
  const [localMsg, setLocalMsg] = useState<string | null>(null);

  const market = data?.market;
  const price =
    resourceId === 0 ? market?.food : resourceId === 1 ? market?.iron : market?.energy;
  const total = (price || 0) * amount;

  const deltas = useMemo(() => {
    if (!market || market.history.length < 2) return { food: 0, iron: 0, energy: 0 };
    const prev = market.history[0];
    return {
      food: ((market.food - prev.food) / prev.food) * 100,
      iron: ((market.iron - prev.iron) / prev.iron) * 100,
      energy: ((market.energy - prev.energy) / prev.energy) * 100,
    };
  }, [market]);

  async function submit() {
    if (!address || !price) return;
    setSubmitting(true);
    setLocalMsg(null);
    try {
      let hash: `0x${string}` | undefined;
      if (hasDeployedCivilization) {
        if (!publicClient) throw new Error("Monad RPC is not ready. Please try again.");
        if (side === "BUY") {
          // Read the contract price immediately before the wallet request. A 2%
          // value buffer is refunded by the contract, protecting against a price
          // move between this read and execution. Gas itself is wallet-estimated.
          const prices = await publicClient.readContract({
            address: CIVILIZATION_ADDRESS,
            abi: civilizationAbi,
            functionName: "getPrices",
          });
          const onchainPrice = prices[resourceId];
          const cost = onchainPrice * BigInt(amount);
          const value = (cost * BigInt(102)) / BigInt(100) + BigInt(1);
          hash = await writeContractAsync({
            address: CIVILIZATION_ADDRESS,
            abi: civilizationAbi,
            functionName: "buyResource",
            args: [resourceId, BigInt(amount)],
            value,
          });
        } else {
          const [prices, marketLiquidity] = await Promise.all([
            publicClient.readContract({
              address: CIVILIZATION_ADDRESS,
              abi: civilizationAbi,
              functionName: "getPrices",
            }),
            publicClient.getBalance({ address: CIVILIZATION_ADDRESS }),
          ]);
          const revenue = prices[resourceId] * BigInt(amount);
          if (marketLiquidity < revenue) {
            throw new Error(
              `Market liquidity is ${Number(formatEther(marketLiquidity)).toFixed(3)} MON; the operator must fund it before this sale can settle.`,
            );
          }
          hash = await writeContractAsync({
            address: CIVILIZATION_ADDRESS,
            abi: civilizationAbi,
            functionName: "sellResource",
            args: [resourceId, BigInt(amount)],
          });
        }
        const receipt = await publicClient.waitForTransactionReceipt({ hash });
        if (receipt.status !== "success") throw new Error("Monad did not confirm this trade.");
      }

      const res = await fetch("/api/activity", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          kind: side,
          walletAddress: address,
          txHash: hash,
          resourceId,
          amount,
        }),
      });
      if (!res.ok) {
        const body = (await res.json().catch(() => null)) as { error?: string } | null;
        throw new Error(body?.error || "The trade confirmed, but MONADIA could not sync it yet.");
      }
      setLocalMsg(
        hasDeployedCivilization
          ? `${side} confirmed on Monad · ${hash?.slice(0, 10)}…`
          : `${side} recorded in local demo mode`,
      );
      await refresh();
    } catch (error) {
      setLocalMsg(error instanceof Error ? error.message : "Transaction failed");
    } finally {
      setSubmitting(false);
    }
  }

  if (!data || !market) {
    return <div className="p-8 text-slate-400">Loading market…</div>;
  }

  return (
    <div className="mx-auto max-w-6xl space-y-6 px-4 py-8">
      <div>
        <h1 className="font-[family-name:var(--font-display)] text-4xl tracking-[0.12em] text-cyan-100">
          MONADIA MARKET
        </h1>
        <p className="mt-1 text-slate-400">Three resources. One shared economy. Confirmed trades settle on Monad.</p>
      </div>

      <div className="grid gap-3 md:grid-cols-3">
        {RESOURCES.map((r) => {
          const p = r.id === 0 ? market.food : r.id === 1 ? market.iron : market.energy;
          const d = r.id === 0 ? deltas.food : r.id === 1 ? deltas.iron : deltas.energy;
          const series = market.history.map((h) =>
            r.id === 0 ? h.food : r.id === 1 ? h.iron : h.energy,
          );
          return (
            <button
              key={r.id}
              onClick={() => setResourceId(r.id)}
              className={`panel text-left transition ${
                resourceId === r.id ? "ring-1 ring-cyan-400/50" : ""
              }`}
            >
              <div className="flex items-center justify-between">
                <p className="text-sm text-slate-400">
                  {r.emoji} {r.label}
                </p>
                <p className={`text-xs ${d >= 0 ? "text-emerald-300" : "text-rose-300"}`}>
                  {d >= 0 ? "+" : ""}
                  {d.toFixed(1)}%
                </p>
              </div>
              <p className="mt-2 text-3xl tabular-nums text-cyan-100">{p.toFixed(3)} MON</p>
              <div className="mt-3">
                <Sparkline values={series} />
              </div>
            </button>
          );
        })}
      </div>

      <div className="panel max-w-xl">
        <div className="mb-4 flex gap-2">
          {(["BUY", "SELL"] as const).map((item) => (
            <button
              key={item}
              onClick={() => setSide(item)}
              className={`rounded-lg px-4 py-2 text-sm font-semibold ${
                side === item ? "bg-cyan-400 text-black" : "bg-white/5 text-slate-300"
              }`}
            >
              {item}
            </button>
          ))}
        </div>
        <label className="text-xs uppercase tracking-wider text-slate-500">Resource</label>
        <select
          className="mt-1"
          value={resourceId}
          onChange={(event) => setResourceId(Number(event.target.value))}
        >
          {RESOURCES.map((r) => (
            <option key={r.id} value={r.id}>
              {r.label}
            </option>
          ))}
        </select>
        <label className="mt-3 block text-xs uppercase tracking-wider text-slate-500">Amount</label>
        <input
          className="mt-1"
          type="number"
          min={1}
          max={10_000}
          value={amount}
          onChange={(event) => setAmount(Math.min(10_000, Math.max(1, Number(event.target.value) || 1)))}
        />
        <p className="mt-3 text-sm text-slate-300">
          Estimated total: <span className="text-cyan-200">{total.toFixed(3)} MON</span>
        </p>
        <p className="mt-1 text-xs text-slate-500">
          + up to {(total * 0.02).toFixed(3)} MDA civic tax (2%) → government treasury
        </p>
        <button
          className="btn-primary mt-4 w-full"
          disabled={!isConnected || isPending || submitting}
          onClick={() => void submit()}
        >
          {!isConnected
            ? "Connect wallet"
            : isPending || submitting
              ? "Confirming…"
              : `${side} ${RESOURCES[resourceId].label}`}
        </button>
        {localMsg && (
          <p className={`mt-3 text-sm ${localMsg.includes("confirmed") || localMsg.includes("recorded") ? "text-emerald-300" : "text-rose-300"}`}>
            {localMsg}
          </p>
        )}
      </div>

      <CreateBusinessCard refresh={refresh} />
    </div>
  );
}

function CreateBusinessCard({ refresh }: { refresh: () => Promise<void> }) {
  const { address, isConnected } = useAccount();
  const publicClient = usePublicClient();
  const { writeContractAsync, isPending } = useWriteContract();
  const [name, setName] = useState("London Energy");
  const [businessType, setBusinessType] = useState(2);
  const [submitting, setSubmitting] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  async function create() {
    if (!address || !name.trim()) return;
    setSubmitting(true);
    setMsg(null);
    try {
      let hash: `0x${string}` | undefined;
      if (hasDeployedCivilization) {
        if (!publicClient) throw new Error("Monad RPC is not ready. Please try again.");
        hash = await writeContractAsync({
          address: CIVILIZATION_ADDRESS,
          abi: civilizationAbi,
          functionName: "createBusiness",
          args: [businessType, name.trim()],
          value: parseEther("5"),
        });
        const receipt = await publicClient.waitForTransactionReceipt({ hash });
        if (receipt.status !== "success") throw new Error("Monad did not confirm this business.");
      }
      const res = await fetch("/api/activity", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          kind: "BUSINESS",
          walletAddress: address,
          businessType,
          businessName: name.trim(),
          txHash: hash,
        }),
      });
      if (!res.ok) {
        const body = (await res.json().catch(() => null)) as { error?: string } | null;
        throw new Error(body?.error || "The business confirmed, but MONADIA could not sync it yet.");
      }
      setMsg(hasDeployedCivilization ? `Business confirmed on Monad · ${hash?.slice(0, 10)}…` : `Business "${name}" created`);
      await refresh();
    } catch (error) {
      setMsg(error instanceof Error ? error.message : "Could not create business");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="panel max-w-xl">
      <h2 className="font-[family-name:var(--font-display)] text-sm tracking-[0.25em] text-cyan-300">
        START A BUSINESS
      </h2>
      <p className="mt-2 text-sm text-slate-400">Stake 5 MON. Farms, mines, and plants produce over time.</p>
      <label className="mt-3 block text-xs uppercase tracking-wider text-slate-500">Name</label>
      <input className="mt-1" value={name} onChange={(event) => setName(event.target.value)} />
      <label className="mt-3 block text-xs uppercase tracking-wider text-slate-500">Type</label>
      <select
        className="mt-1"
        value={businessType}
        onChange={(event) => setBusinessType(Number(event.target.value))}
      >
        <option value={0}>Farm → Food</option>
        <option value={1}>Mine → Iron</option>
        <option value={2}>Power Plant → Energy</option>
      </select>
      <button
        className="btn-primary mt-4 w-full"
        disabled={!isConnected || isPending || submitting || !name.trim()}
        onClick={() => void create()}
      >
        {isPending || submitting ? "Confirming…" : "Create Business"}
      </button>
      {msg && <p className={`mt-2 text-sm ${msg.includes("confirmed") || msg.includes("created") ? "text-emerald-300" : "text-rose-300"}`}>{msg}</p>}
    </div>
  );
}
