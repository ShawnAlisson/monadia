"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useAccount, usePublicClient, useWriteContract } from "wagmi";
import { ConnectWallet } from "@/components/ConnectWallet";
import { civilizationAbi } from "@/lib/contracts/abi";
import type { Citizen } from "@/lib/types";

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
  const [checking, setChecking] = useState(false);
  const [population, setPopulation] = useState<number | null>(null);
  const [joined, setJoined] = useState(false);
  const [citizen, setCitizen] = useState<Citizen | null>(null);
  const [joinError, setJoinError] = useState<string | null>(null);

  useEffect(() => {
    void fetch("/api/state")
      .then((r) => r.json())
      .then((d) => setPopulation(d.metrics?.population ?? null))
      .catch(() => undefined);
  }, []);

  // Returning players: detect DB or on-chain membership and skip the join form.
  useEffect(() => {
    if (!isConnected || !address) {
      setJoined(false);
      setCitizen(null);
      setChecking(false);
      return;
    }

    let cancelled = false;
    setChecking(true);
    setJoinError(null);

    async function restoreCitizen() {
      try {
        const stateRes = await fetch("/api/state", { cache: "no-store" });
        const state = await stateRes.json();
        const fromDb = ((state.citizens as Citizen[]) || []).find(
          (c) => c.walletAddress.toLowerCase() === address!.toLowerCase(),
        );
        if (fromDb) {
          if (!cancelled) {
            setCitizen(fromDb);
            setName(fromDb.name);
            setJoined(true);
          }
          return;
        }

        if (hasDeployedCivilization && publicClient) {
          const onchain = await publicClient.readContract({
            address: civilizationAddress,
            abi: civilizationAbi,
            functionName: "citizens",
            args: [address!],
          });
          const joinedOnchain = Boolean(onchain[2]);
          const onchainName = String(onchain[0] || "").trim();
          if (joinedOnchain) {
            const syncRes = await fetch("/api/join", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                walletAddress: address,
                name: onchainName || `Citizen-${address!.slice(2, 6)}`,
                syncExisting: true,
              }),
            });
            const body = (await syncRes.json().catch(() => null)) as
              | { citizen?: Citizen; error?: string }
              | null;
            if (syncRes.ok && body?.citizen) {
              if (!cancelled) {
                setCitizen(body.citizen);
                setName(body.citizen.name);
                setJoined(true);
              }
              return;
            }
          }
        }

        if (!cancelled) {
          setJoined(false);
          setCitizen(null);
        }
      } catch {
        if (!cancelled) setJoined(false);
      } finally {
        if (!cancelled) setChecking(false);
      }
    }

    void restoreCitizen();
    return () => {
      cancelled = true;
    };
  }, [address, isConnected, publicClient]);

  async function enterCivilization() {
    if (!address) return;
    setJoining(true);
    setJoinError(null);
    try {
      // Re-check membership so we never re-submit joinCivilization.
      if (hasDeployedCivilization && publicClient) {
        const onchain = await publicClient.readContract({
          address: civilizationAddress,
          abi: civilizationAbi,
          functionName: "citizens",
          args: [address],
        });
        if (onchain[2]) {
          const syncRes = await fetch("/api/join", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              walletAddress: address,
              name: String(onchain[0] || name.trim() || `Citizen-${address.slice(2, 6)}`),
              syncExisting: true,
            }),
          });
          const body = (await syncRes.json().catch(() => null)) as
            | { citizen?: Citizen; error?: string }
            | null;
          if (!syncRes.ok) throw new Error(body?.error || "Could not restore your citizen profile");
          setCitizen(body?.citizen ?? null);
          setJoined(true);
          return;
        }
      }

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
        if (receipt.status !== "success") {
          throw new Error("Your Monad join transaction did not succeed.");
        }
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
      const created = (await res.json()) as { citizen?: Citizen };
      setCitizen(created.citizen ?? null);
      setJoined(true);
    } catch (error) {
      const msg = error instanceof Error ? error.message : "Could not join MONADIA";
      // Already-joined on Monad (or a failed re-join) — sync the existing citizen.
      const maybeAlreadyJoined =
        /already joined/i.test(msg) ||
        /did not succeed/i.test(msg) ||
        /execution reverted/i.test(msg);
      if (maybeAlreadyJoined) {
        try {
          const syncRes = await fetch("/api/join", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              walletAddress: address,
              name: name.trim() || `Citizen-${address.slice(2, 6)}`,
              syncExisting: true,
            }),
          });
          const body = (await syncRes.json().catch(() => null)) as
            | { citizen?: Citizen; error?: string }
            | null;
          if (syncRes.ok && body?.citizen) {
            setCitizen(body.citizen);
            setJoined(true);
            return;
          }
        } catch {
          // fall through to surface original error
        }
      }
      setJoinError(msg);
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

          {isConnected && checking && (
            <div className="panel w-full max-w-md">
              <p className="text-sm text-slate-300">Checking your citizen status…</p>
            </div>
          )}

          {isConnected && !checking && !joined && (
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
                {citizen ? `Welcome back, ${citizen.name}.` : "You are a citizen."}
              </p>
              <p className="mt-2 text-amber-200">
                {citizen
                  ? `🪙 ${citizen.coins.toFixed(0)} MDA · ${citizen.balance.toFixed(2)} MON synced`
                  : "🪙 Welcome bonus: 100 MDA civic coins deposited."}
              </p>
              <p className="mt-1 text-slate-400">AI agents are already trading. Step into the live world.</p>
              <button className="btn-primary mt-5 w-full" onClick={() => router.push("/world")}>
                Enter the 3D World
              </button>
              {hasDeployedCivilization && (
                <p className="mt-3 text-center text-[11px] text-emerald-300/80">
                  ✓ Joined on Monad · welcome bonus minted by Civilization
                </p>
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
