import {
  mnemonicToAccount,
  privateKeyToAccount,
  type HDAccount,
  type PrivateKeyAccount,
} from "viem/accounts";

export function getOrCreateMnemonic(): string {
  if (process.env.AGENT_MNEMONIC) return process.env.AGENT_MNEMONIC;
  // Deterministic demo mnemonic for local offline simulation when unset.
  // Replace with a real mnemonic before mainnet/testnet agent txs.
  return (
    process.env.DEMO_AGENT_MNEMONIC ||
    "test test test test test test test test test test test junk"
  );
}

export function getAgentAccount(index: number): HDAccount {
  const mnemonic = getOrCreateMnemonic();
  return mnemonicToAccount(mnemonic, { addressIndex: index });
}

export function getOperatorAccount(): PrivateKeyAccount | HDAccount | null {
  const pk = process.env.OPERATOR_PRIVATE_KEY || process.env.PRIVATE_KEY;
  if (pk) {
    const normalized = pk.startsWith("0x") ? pk : `0x${pk}`;
    return privateKeyToAccount(normalized as `0x${string}`);
  }
  // Fall back to index 100 of the agent mnemonic as operator in local demo.
  if (process.env.AGENT_MNEMONIC || process.env.NODE_ENV !== "production") {
    return mnemonicToAccount(getOrCreateMnemonic(), { addressIndex: 100 });
  }
  return null;
}
