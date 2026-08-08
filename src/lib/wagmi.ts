"use client";

import { http, createConfig } from "wagmi";
import { injected, metaMask, walletConnect } from "wagmi/connectors";
import { monadTestnet } from "@/lib/chain";

const rawProjectId = process.env.NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID || "";
const projectId =
  rawProjectId &&
  rawProjectId !== "your_walletconnect_project_id" &&
  !rawProjectId.includes("your_")
    ? rawProjectId
    : "";

export const config = createConfig({
  chains: [monadTestnet],
  connectors: [
    metaMask({ dappMetadata: { name: "MONADIA" } }),
    injected({ shimDisconnect: true }),
    ...(projectId
      ? [
          walletConnect({
            projectId,
            metadata: {
              name: "MONADIA",
              description: "Human + AI civilization on Monad",
              url: typeof window !== "undefined" ? window.location.origin : "http://localhost:3000",
              icons: ["https://avatars.githubusercontent.com/u/37784886"],
            },
            showQrModal: true,
          }),
        ]
      : []),
  ],
  transports: {
    [monadTestnet.id]: http(
      process.env.NEXT_PUBLIC_MONAD_RPC_URL || "https://testnet-rpc.monad.xyz",
    ),
  },
  ssr: true,
});
