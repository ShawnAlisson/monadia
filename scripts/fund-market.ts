/** Fund Civilization's MON liquidity pool so users can sell resources. */
import { createPublicClient, createWalletClient, http, parseEther } from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { monadTestnet } from "../src/lib/chain";
import { civilizationAbi } from "../src/lib/contracts/abi";

const RPC = process.env.MONAD_RPC_URL || "https://testnet-rpc.monad.xyz";
const CIVILIZATION = process.env.NEXT_PUBLIC_CIVILIZATION_ADDRESS as `0x${string}` | undefined;
const AMOUNT = process.env.MARKET_FUND_AMOUNT;

async function main() {
  const privateKey = process.env.OPERATOR_PRIVATE_KEY || process.env.PRIVATE_KEY;
  if (!privateKey) throw new Error("OPERATOR_PRIVATE_KEY or PRIVATE_KEY is required");
  if (!CIVILIZATION || !/^0x[a-fA-F0-9]{40}$/.test(CIVILIZATION)) {
    throw new Error("NEXT_PUBLIC_CIVILIZATION_ADDRESS must be the deployed Civilization address");
  }
  if (!AMOUNT || Number(AMOUNT) <= 0) {
    throw new Error("Set an explicit MARKET_FUND_AMOUNT in MON, for example MARKET_FUND_AMOUNT=1");
  }

  const normalized = (privateKey.startsWith("0x") ? privateKey : `0x${privateKey}`) as `0x${string}`;
  const account = privateKeyToAccount(normalized);
  const publicClient = createPublicClient({ chain: monadTestnet, transport: http(RPC) });
  const walletClient = createWalletClient({ account, chain: monadTestnet, transport: http(RPC) });
  const hash = await walletClient.writeContract({
    address: CIVILIZATION,
    abi: civilizationAbi,
    functionName: "fundMarket",
    value: parseEther(AMOUNT),
    account,
    chain: monadTestnet,
  });
  const receipt = await publicClient.waitForTransactionReceipt({ hash });
  if (receipt.status !== "success") throw new Error("Market funding transaction failed");
  console.log(`Funded Civilization market with ${AMOUNT} MON: ${hash}`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
