import { createPublicClient, formatEther, http, type Address } from "viem";
import { monadTestnet } from "@/lib/chain";
import {
  CIVILIZATION_ADDRESS,
  civilizationAbi,
  MONAD_RPC,
  monadiaCoinAbi,
} from "@/lib/contracts/abi";
import { requiresOnchainVerification } from "@/lib/contracts/verify";

const toDisplayAmount = (value: bigint) => Number(formatEther(value));

export type OnchainCitizenState = {
  nativeMon: number;
  mda: number;
  inventory: { food: number; iron: number; energy: number };
};

export type OnchainCitizenMembership = {
  name: string;
  joined: boolean;
  isAI: boolean;
};

export type OnchainMarketState = {
  food: number;
  iron: number;
  energy: number;
  treasuryMon: number;
  tokenTreasuryMda: number;
};

/** Lightweight membership check used to skip re-join when the wallet is already a citizen. */
export async function readOnchainCitizenMembership(
  address: Address,
): Promise<OnchainCitizenMembership | null> {
  if (!requiresOnchainVerification()) return null;
  try {
    const client = createPublicClient({ chain: monadTestnet, transport: http(MONAD_RPC) });
    const citizen = await client.readContract({
      address: CIVILIZATION_ADDRESS,
      abi: civilizationAbi,
      functionName: "citizens",
      args: [address],
    });
    return {
      name: citizen[0],
      isAI: citizen[1],
      joined: citizen[2],
    };
  } catch (error) {
    console.warn("[monadia] Could not read on-chain membership", error);
    return null;
  }
}

/**
 * Reads public post-settlement state. It is used only after a receipt is
 * confirmed; browser-provided balances are never persisted as settlement data.
 */
export async function readOnchainCitizenState(
  address: Address,
): Promise<OnchainCitizenState | null> {
  if (!requiresOnchainVerification()) return null;
  try {
    const client = createPublicClient({ chain: monadTestnet, transport: http(MONAD_RPC) });
    const token = await client.readContract({
      address: CIVILIZATION_ADDRESS,
      abi: civilizationAbi,
      functionName: "token",
    });
    const [nativeMon, inventory, mda] = await Promise.all([
      client.getBalance({ address }),
      client.readContract({
        address: CIVILIZATION_ADDRESS,
        abi: civilizationAbi,
        functionName: "getInventory",
        args: [address],
      }),
      client.readContract({
        address: token,
        abi: monadiaCoinAbi,
        functionName: "balanceOf",
        args: [address],
      }),
    ]);
    return {
      nativeMon: toDisplayAmount(nativeMon),
      mda: toDisplayAmount(mda),
      inventory: {
        food: Number(inventory[0]),
        iron: Number(inventory[1]),
        energy: Number(inventory[2]),
      },
    };
  } catch (error) {
    console.warn("[monadia] Could not refresh on-chain citizen state", error);
    return null;
  }
}

/** Public contract state used to keep the Vercel read model honest after settlement. */
export async function readOnchainMarketState(): Promise<OnchainMarketState | null> {
  if (!requiresOnchainVerification()) return null;
  try {
    const client = createPublicClient({ chain: monadTestnet, transport: http(MONAD_RPC) });
    const [prices, treasuryWei, tokenTreasury] = await Promise.all([
      client.readContract({
        address: CIVILIZATION_ADDRESS,
        abi: civilizationAbi,
        functionName: "getPrices",
      }),
      client.getBalance({ address: CIVILIZATION_ADDRESS }),
      client.readContract({
        address: CIVILIZATION_ADDRESS,
        abi: civilizationAbi,
        functionName: "tokenTreasury",
      }),
    ]);
    return {
      food: toDisplayAmount(prices[0]),
      iron: toDisplayAmount(prices[1]),
      energy: toDisplayAmount(prices[2]),
      treasuryMon: toDisplayAmount(treasuryWei),
      tokenTreasuryMda: toDisplayAmount(tokenTreasury),
    };
  } catch (error) {
    console.warn("[monadia] Could not refresh on-chain market state", error);
    return null;
  }
}
