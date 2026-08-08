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
  const [open, setOpen] = useState(false);
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

  const unique = connectors.filter(
    (c, i, arr) => arr.findIndex((x) => x.id === c.id) === i,
  );

  async function onConnect(connectorId: string) {
    setLocalError(null);
    reset();
    const connector = unique.find((c) => c.id === connectorId);
    if (!connector) {
      setLocalError("No wallet connector available.");
      return;
    }

    // MetaMask / injected need a browser extension
    const hasInjectedWallet = typeof window !== "undefined" && "ethereum" in window;
    if (
      (connector.id === "metaMaskSDK" || connector.id === "injected") &&
      !hasInjectedWallet
    ) {
      setLocalError(
        "No browser wallet found. Install MetaMask, then refresh — or use WalletConnect.",
      );
      setOpen(true);
      return;
    }

    try {
      await connect({ connector, chainId: monadTestnet.id });
      setOpen(false);
    } catch (e) {
      setLocalError(e instanceof Error ? e.message : "Connection failed");
      setOpen(true);
    }
  }

  return (
    <div className="relative">
      <button
        className="btn-primary"
        disabled={isPending}
        onClick={() => {
          setOpen((v) => !v);
          setLocalError(null);
        }}
      >
        {isPending ? "Connecting…" : label}
      </button>

      {open && (
        <div className="absolute right-0 z-50 mt-2 w-72 rounded-xl border border-cyan-400/20 bg-[#071018] p-2 shadow-2xl">
          <p className="px-2 py-1 text-[11px] uppercase tracking-wider text-slate-500">
            Choose wallet
          </p>
          {unique.map((connector) => (
            <button
              key={connector.id}
              className="flex w-full items-center justify-between rounded-lg px-3 py-2.5 text-left text-sm text-cyan-50 hover:bg-cyan-400/10"
              disabled={isPending}
              onClick={() => void onConnect(connector.id)}
            >
              <span>{connector.name}</span>
              <span className="text-[10px] uppercase text-slate-500">{connector.id}</span>
            </button>
          ))}
          {!process.env.NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID ||
          process.env.NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID.includes("your_") ? (
            <p className="mt-1 px-2 pb-1 text-[11px] leading-relaxed text-slate-500">
              Tip: install the MetaMask extension for one-click connect. Optional: set a real
              WalletConnect Project ID in `.env.local`.
            </p>
          ) : null}
          {(localError || error?.message) && (
            <p className="mt-1 rounded-lg bg-rose-500/10 px-3 py-2 text-xs text-rose-200">
              {localError || error?.message}
            </p>
          )}
        </div>
      )}
    </div>
  );
}
