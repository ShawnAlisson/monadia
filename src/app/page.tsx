"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useAccount, usePublicClient, useWriteContract } from "wagmi";
import { ConnectWallet } from "@/components/ConnectWallet";
import { civilizationAbi } from "@/lib/contracts/abi";

const civilizationAddress = process.env.NEXT_PUBLIC_CIVILIZATION_ADDRESS as `0x${string}`;
const hasDeployedCivilization = Boolean(
  civilizationAddress && civilizationAddress !== "0x0000000000000000000000000000000000000000",
);

export default function LandingPage() {
  const { address, isConnected } = useAccount();
  const publicClient = usePublicClient();
  const { writeContractAsync } = useWriteContract();
  const router = useRouter();
  const [name, setName] = useState("");
  const [joining, setJoining] = useState(false);
  const [population, setPopulation] = useState<number | null>(null);
  const [joined, setJoined] = useState(false);
  const [joinError, setJoinError] = useState<string | null>(null);

  useEffect(() => {
    void fetch("/api/state")
      .then((r) => r.json())
      .then((d) => setPopulation(d.metrics?.population ?? null))
      .catch(() => undefined);
  }, []);

  async function enterCivilization() {
    if (!address) return;
    setJoining(true);
    setJoinError(null);
    try {
      const citizenName = name.trim() || `Citizen-${address.slice(2, 6)}`;
      let txHash: `0x${string}` | undefined;
      if (hasDeployedCivilization) {
        if (!publicClient) throw new Error("Monad RPC is not ready. Please try again.");
        txHash = await writeContractAsync({
          address: civilizationAddress,
          abi: civilizationAbi,
          functionName: "joinCivilization",
          args: [citizenName],
        });
        const receipt = await publicClient.waitForTransactionReceipt({ hash: txHash });
        if (receipt.status !== "success") throw new Error("Your Monad join transaction did not succeed.");
      }
      const res = await fetch("/api/join", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          walletAddress: address,
          name: citizenName,
          txHash,
        }),
      });
      if (!res.ok) {
        const body = (await res.json().catch(() => null)) as { error?: string } | null;
        throw new Error(body?.error || "Could not create your citizen profile");
      }
      setJoined(true);
    } catch (error) {
      setJoinError(error instanceof Error ? error.message : "Could not join MONADIA");
    } finally {
      setJoining(false);
    }
  }

  return (
    <div className="relative min-h-screen overflow-hidden city-grid">
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_50%_20%,rgba(61,230,193,0.18),transparent_45%)]" />
      <div className="pointer-events-none absolute inset-0 opacity-50 [background:linear-gradient(115deg,transparent_0%,rgba(61,230,193,0.08)_42%,transparent_55%)]" />
      <div className="relative mx-auto flex min-h-screen max-w-5xl flex-col items-center justify-center px-6 py-16 text-center">
        <p className="mb-4 text-xs uppercase tracking-[0.45em] text-cyan-300/80">Monad Blitz London</p>
        <h1 className="font-[family-name:var(--font-display)] text-[2.7rem] font-bold tracking-[0.12em] text-cyan-100 sm:text-8xl sm:tracking-[0.18em]">
          MONADIA
        </h1>
        <p className="mt-5 max-w-xl text-base text-slate-300 sm:text-lg">
          A civilization of humans + autonomous AI agents sharing one high-throughput on-chain economy.
        </p>

        <div className="mt-10 flex flex-col items-center gap-4">
          {!isConnected && (
            <>
              <ConnectWallet label="Connect Wallet" />
              <p className="text-sm text-slate-500">Enter the civilization.</p>
            </>
          )}

          {isConnected && !joined && (
            <div className="panel w-full max-w-md text-left">
              <p className="text-sm uppercase tracking-[0.2em] text-cyan-300">Welcome, citizen</p>
              <p className="mt-2 text-slate-300">
                Your civilization is already alive.
                {population != null && (
                  <>
                    {" "}
                    <span className="text-cyan-200">{population}</span> citizens are currently active.
                  </>
                )}
              </p>
              <label className="mt-4 block text-xs uppercase tracking-wider text-slate-500">
                Citizen name
              </label>
              <input
                className="mt-1"
                placeholder="Alex"
                value={name}
                onChange={(e) => setName(e.target.value)}
              />
              <button
                className="btn-primary mt-4 w-full"
                disabled={joining}
                onClick={() => void enterCivilization()}
              >
                {joining ? "Joining…" : "Enter MONADIA"}
              </button>
              {joinError && <p className="mt-3 text-sm text-rose-300">{joinError}</p>}
            </div>
          )}

          {joined && (
            <div className="panel w-full max-w-md animate-fade-in">
              <p className="font-[family-name:var(--font-display)] text-2xl text-cyan-100">
                You are a citizen.
              </p>
              <p className="mt-2 text-amber-200">🪙 Welcome bonus: 100 MDA civic coins deposited.</p>
              <p className="mt-1 text-slate-400">AI agents are already trading. Step into the live world.</p>
              <button className="btn-primary mt-5 w-full" onClick={() => router.push("/world")}>
                Enter the 3D World
              </button>
              {hasDeployedCivilization && (
                <p className="mt-3 text-center text-[11px] text-emerald-300/80">✓ Joined on Monad · welcome bonus minted by Civilization</p>
              )}
              <button className="btn-ghost mt-3 w-full" onClick={() => router.push("/civilization")}>
                Open Dashboard
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
