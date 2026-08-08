/**
 * Fund AI agent wallets from an operator account on Monad Testnet.
 *
 * Usage:
 *   AGENT_MNEMONIC="..." PRIVATE_KEY="0x..." npx tsx scripts/fund-agents.ts
 */
import { createWalletClient, createPublicClient, http, parseEther, formatEther } from "viem";
import { mnemonicToAccount, privateKeyToAccount } from "viem/accounts";
import { monadTestnet } from "../src/lib/chain";

const RPC = process.env.MONAD_RPC_URL || "https://testnet-rpc.monad.xyz";
const MNEMONIC = process.env.AGENT_MNEMONIC;
const COUNT = Number(process.env.AGENT_COUNT || 24);
const AMOUNT = process.env.FUND_AMOUNT;

async function main() {
  const pk = process.env.PRIVATE_KEY || process.env.OPERATOR_PRIVATE_KEY;
  if (!pk) throw new Error("PRIVATE_KEY required");
  if (!MNEMONIC) throw new Error("AGENT_MNEMONIC required; refusing to fund the public demo mnemonic");
  if (!AMOUNT || Number(AMOUNT) <= 0) {
    throw new Error("Set an explicit FUND_AMOUNT in MON, for example FUND_AMOUNT=0.1");
  }
  const normalized = (pk.startsWith("0x") ? pk : `0x${pk}`) as `0x${string}`;
  const operator = privateKeyToAccount(normalized);

  const publicClient = createPublicClient({
    chain: monadTestnet,
    transport: http(RPC),
  });
  const walletClient = createWalletClient({
    account: operator,
    chain: monadTestnet,
    transport: http(RPC),
  });

  const bal = await publicClient.getBalance({ address: operator.address });
  console.log(`Operator ${operator.address} balance: ${formatEther(bal)} MON`);

  for (let i = 0; i < COUNT; i++) {
    const agent = mnemonicToAccount(MNEMONIC, { addressIndex: i });
    const hash = await walletClient.sendTransaction({
      to: agent.address,
      value: parseEther(AMOUNT),
      account: operator,
      chain: monadTestnet,
    });
    await publicClient.waitForTransactionReceipt({ hash });
    console.log(`Funded #${i} ${agent.address} with ${AMOUNT} MON · ${hash}`);
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
