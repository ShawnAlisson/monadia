import {
  createPublicClient,
  createWalletClient,
  http,
  parseEther,
  type Hash,
} from "viem";
import { monadTestnet } from "@/lib/chain";
import { CIVILIZATION_ADDRESS, civilizationAbi, MONAD_RPC } from "@/lib/contracts/abi";
import { getAgentAccount, getOperatorAccount } from "@/lib/wallets";
import { getAgentWalletIndex, listCitizens } from "@/lib/civilization/store";
import type { Citizen, ResourceId } from "@/lib/types";

const zero = "0x0000000000000000000000000000000000000000";

export function isOnChainEnabled() {
  return (
    !!CIVILIZATION_ADDRESS &&
    CIVILIZATION_ADDRESS !== zero &&
    process.env.ENABLE_ONCHAIN !== "false"
  );
}

/** AI settlement is opt-in because it spends developer-funded agent MON. */
export function isOnChainAiEnabled() {
  // Never fall back to the public demo mnemonic for a live on-chain agent loop.
  return (
    isOnChainEnabled() &&
    process.env.ENABLE_ONCHAIN_AI === "true" &&
    Boolean(process.env.AGENT_MNEMONIC)
  );
}

function publicClient() {
  return createPublicClient({
    chain: monadTestnet,
    transport: http(MONAD_RPC),
  });
}

async function getWalletIndex(agent: Citizen): Promise<number | null> {
  return getAgentWalletIndex(agent.id);
}

async function sendAgentTx(
  agent: Citizen,
  write: (walletClient: ReturnType<typeof createWalletClient>, account: ReturnType<typeof getAgentAccount>) => Promise<Hash>,
): Promise<{ txHash: string } | null> {
  if (!isOnChainEnabled()) return null;
  const index = await getWalletIndex(agent);
  if (index == null) return null;
  try {
    const account = getAgentAccount(index);
    const walletClient = createWalletClient({
      account,
      chain: monadTestnet,
      transport: http(MONAD_RPC),
    });
    const hash = await write(walletClient, account);
    const client = publicClient();
    await client.waitForTransactionReceipt({ hash, confirmations: 1 });
    return { txHash: hash };
  } catch (err) {
    console.error(`[onchain] agent tx failed for ${agent.name}:`, err);
    return null;
  }
}

export async function tryOnChainBuy(agent: Citizen, resourceId: ResourceId, amount: number) {
  const marketPrices = await readPrices();
  const price = marketPrices[resourceId];
  const value = parseEther((price * amount * 1.02).toFixed(6)); // small buffer
  return sendAgentTx(agent, async (walletClient, account) => {
    return walletClient.writeContract({
      address: CIVILIZATION_ADDRESS,
      abi: civilizationAbi,
      functionName: "buyResource",
      args: [resourceId, BigInt(amount)],
      value,
      account,
      chain: monadTestnet,
    });
  });
}

export async function tryOnChainSell(agent: Citizen, resourceId: ResourceId, amount: number) {
  return sendAgentTx(agent, async (walletClient, account) => {
    return walletClient.writeContract({
      address: CIVILIZATION_ADDRESS,
      abi: civilizationAbi,
      functionName: "sellResource",
      args: [resourceId, BigInt(amount)],
      account,
      chain: monadTestnet,
    });
  });
}

export async function tryOnChainVote(agent: Citizen, proposalId: number, support: boolean) {
  return sendAgentTx(agent, async (walletClient, account) => {
    return walletClient.writeContract({
      address: CIVILIZATION_ADDRESS,
      abi: civilizationAbi,
      functionName: "vote",
      args: [BigInt(proposalId), support],
      account,
      chain: monadTestnet,
    });
  });
}

export async function readPrices(): Promise<[number, number, number]> {
  if (!isOnChainEnabled()) {
    return [1, 2, 3];
  }
  try {
    const client = publicClient();
    const [food, iron, energy] = await client.readContract({
      address: CIVILIZATION_ADDRESS,
      abi: civilizationAbi,
      functionName: "getPrices",
    });
    return [Number(food) / 1e18, Number(iron) / 1e18, Number(energy) / 1e18];
  } catch {
    return [1, 2, 3];
  }
}

export async function registerAgentsOnChain(limit = 24) {
  if (!isOnChainAiEnabled()) return { registered: 0 };
  const operator = getOperatorAccount();
  if (!operator) return { registered: 0 };

  const walletClient = createWalletClient({
    account: operator,
    chain: monadTestnet,
    transport: http(MONAD_RPC),
  });
  const client = publicClient();
  const agents = (await listCitizens("AI")).slice(0, limit);

  let registered = 0;
  for (const agent of agents) {
    try {
      const citizen = await client.readContract({
        address: CIVILIZATION_ADDRESS,
        abi: civilizationAbi,
        functionName: "citizens",
        args: [agent.walletAddress as `0x${string}`],
      });
      if (citizen[2]) continue; // already joined
      const hash = await walletClient.writeContract({
        address: CIVILIZATION_ADDRESS,
        abi: civilizationAbi,
        functionName: "registerAI",
        args: [agent.walletAddress as `0x${string}`, agent.name, 1],
        account: operator,
        chain: monadTestnet,
      });
      await client.waitForTransactionReceipt({ hash });
      registered++;
    } catch (err) {
      console.error(`registerAI failed for ${agent.name}`, err);
    }
  }
  return { registered };
}
