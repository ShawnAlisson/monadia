"use client";

import { useState } from "react";
import {
  useAccount,
  useConnect,
  useDisconnect,
  useChainId,
  useSwitchChain,
} from "wagmi";
import { monadTestnet } from "@/lib/chain";

export function ConnectWallet({ label = "Connect Wallet" }: { label?: string }) {
  const { address, isConnected } = useAccount();
  const { connectors, connect, isPending, error, reset } = useConnect();
  const { disconnect } = useDisconnect();
  const chainId = useChainId();
  const { switchChain } = useSwitchChain();
  const [localError, setLocalError] = useState<string | null>(null);

  if (isConnected && address) {
    const wrong = chainId !== monadTestnet.id;
    return (
      <div className="flex flex-wrap items-center gap-2">
        {wrong && (
          <button
            className="btn-ghost text-sm"
            onClick={() => switchChain({ chainId: monadTestnet.id })}
          >
            Switch to Monad
          </button>
        )}
        <span className="rounded-lg border border-cyan-400/20 bg-white/5 px-3 py-2 font-mono text-xs text-cyan-100">
          {address.slice(0, 6)}…{address.slice(-4)}
        </span>
        <button className="btn-ghost text-sm" onClick={() => disconnect()}>
          Disconnect
        </button>
      </div>
    );
  }

  // Prefer injected (MetaMask / browser wallet). Inject alone is enough — it
  // opens MetaMask when present. Extra connector dropdown / MetaMask SDK entry
  // is intentionally not shown.
  const injected = connectors.find((c) => c.id === "injected") ?? connectors[0];

  async function onConnectInjected() {
    setLocalError(null);
    reset();
    if (!injected) {
      setLocalError("No wallet connector available.");
      return;
    }

    const hasInjectedWallet = typeof window !== "undefined" && "ethereum" in window;
    if (!hasInjectedWallet) {
      setLocalError("No browser wallet found. Install MetaMask, then refresh.");
      return;
    }

    try {
      await connect({ connector: injected, chainId: monadTestnet.id });
    } catch (e) {
      setLocalError(e instanceof Error ? e.message : "Connection failed");
    }
  }

  return (
    <div className="relative">
      <button
        className="btn-primary"
        disabled={isPending}
        onClick={() => void onConnectInjected()}
      >
        {isPending ? "Connecting…" : label}
      </button>

      {/*
      Extra wallet dropdown (MetaMask SDK / WalletConnect list) — commented out
      because injected already triggers MetaMask.

      {open && (
        <div className="absolute right-0 z-50 mt-2 w-72 rounded-xl border ...">
          {unique.map((connector) => (
            <button key={connector.id} onClick={() => void onConnect(connector.id)}>
              {connector.name}
            </button>
          ))}
        </div>
      )}
      */}

      {(localError || error?.message) && (
        <p className="mt-2 max-w-xs rounded-lg bg-rose-500/10 px-3 py-2 text-xs text-rose-200">
          {localError || error?.message}
        </p>
      )}
    </div>
  );
}
