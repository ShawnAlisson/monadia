import {
  createPublicClient,
  decodeFunctionData,
  http,
  isAddressEqual,
  parseEventLogs,
  type Address,
  type Hash,
} from "viem";
import { monadTestnet } from "@/lib/chain";
import { CIVILIZATION_ADDRESS, civilizationAbi, MONAD_RPC } from "@/lib/contracts/abi";

const zero = "0x0000000000000000000000000000000000000000";

export type CivilizationAction = "JOIN" | "BUY" | "SELL" | "BUSINESS" | "VOTE" | "HIRE";
export type CivilizationEvent =
  | "CitizenJoined"
  | "ResourceBought"
  | "ResourceSold"
  | "BusinessCreated"
  | "Voted"
  | "AgentHired"
  | "TaxCollected"
  | "WelcomeBonusGranted";

export function requiresOnchainVerification() {
  return CIVILIZATION_ADDRESS !== zero && process.env.ENABLE_ONCHAIN !== "false";
}

function expectedFunction(action: CivilizationAction) {
  return {
    JOIN: "joinCivilization",
    BUY: "buyResource",
    SELL: "sellResource",
    BUSINESS: "createBusiness",
    VOTE: "vote",
    HIRE: "hireAgent",
  }[action];
}

/** Verifies that a confirmed Monad transaction belongs to the caller and targets Civilization. */
export async function verifyCivilizationTransaction(input: {
  txHash: string;
  walletAddress: string;
  action: CivilizationAction;
}) {
  if (!requiresOnchainVerification()) {
    throw new Error("MONADIA's on-chain contract is not configured");
  }
  if (!/^0x[a-fA-F0-9]{64}$/.test(input.txHash)) throw new Error("Invalid transaction hash");
  if (!/^0x[a-fA-F0-9]{40}$/.test(input.walletAddress)) throw new Error("Invalid wallet address");

  const client = createPublicClient({ chain: monadTestnet, transport: http(MONAD_RPC) });
  const hash = input.txHash as Hash;
  const [receipt, transaction] = await Promise.all([
    client.getTransactionReceipt({ hash }),
    client.getTransaction({ hash }),
  ]);
  if (receipt.status !== "success") throw new Error("Transaction did not succeed on Monad");
  if (!transaction.to || !isAddressEqual(transaction.to, CIVILIZATION_ADDRESS)) {
    throw new Error("Transaction did not target the MONADIA Civilization contract");
  }
  if (!isAddressEqual(transaction.from, input.walletAddress as Address)) {
    throw new Error("Transaction was not signed by this wallet");
  }
  const decoded = decodeFunctionData({ abi: civilizationAbi, data: transaction.input });
  if (decoded.functionName !== expectedFunction(input.action)) {
    throw new Error(`Expected ${expectedFunction(input.action)} transaction`);
  }
  return { transaction, receipt, decoded };
}

/**
 * Finds one authoritative Civilization event in an already-confirmed receipt.
 * This prevents the API from trusting amounts or identities supplied by a browser.
 */
export function requireCivilizationEvent(
  receipt: { logs: readonly unknown[] },
  eventName: CivilizationEvent,
): Record<string, unknown> {
  const args = findCivilizationEvent(receipt, eventName);
  if (!args) throw new Error(`Expected one ${eventName} event from Civilization`);
  return args;
}

export function findCivilizationEvent(
  receipt: { logs: readonly unknown[] },
  eventName: CivilizationEvent,
): Record<string, unknown> | null {
  const events = parseEventLogs({
    abi: civilizationAbi,
    eventName,
    // viem receipts are compatible logs. `unknown` here keeps the verifier's
    // public return type independent from a particular viem receipt generic.
    logs: receipt.logs as never,
    strict: false,
  }).filter((event) => isAddressEqual(event.address, CIVILIZATION_ADDRESS));

  if (events.length !== 1 || !events[0].args) {
    return null;
  }
  return events[0].args as Record<string, unknown>;
}

export function asUint(value: unknown, label: string): bigint {
  if (typeof value !== "bigint" || value < BigInt(0)) {
    throw new Error(`Invalid ${label} in Monad receipt`);
  }
  return value;
}

export function asAddress(value: unknown, label: string): Address {
  if (typeof value !== "string" || !/^0x[a-fA-F0-9]{40}$/.test(value)) {
    throw new Error(`Invalid ${label} in Monad receipt`);
  }
  return value as Address;
}
