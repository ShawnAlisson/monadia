/** Publish the draft proposal to Monad and bind it to the Vercel read model. */
import { createPublicClient, createWalletClient, http, parseEventLogs } from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { monadTestnet } from "../src/lib/chain";
import { civilizationAbi } from "../src/lib/contracts/abi";
import { ensureSeeded } from "../src/lib/civilization/store";
import { getSql } from "../src/lib/db";

const RPC = process.env.MONAD_RPC_URL || "https://testnet-rpc.monad.xyz";
const CIVILIZATION = process.env.NEXT_PUBLIC_CIVILIZATION_ADDRESS as `0x${string}` | undefined;
const LOCAL_ID = process.env.PROPOSAL_ID || "proposal-tax-v1";
const DESCRIPTION = process.env.PROPOSAL_DESCRIPTION || "Increase food production tax from 2% → 3%.";
const DURATION_SECONDS = Number(process.env.PROPOSAL_DURATION_SECONDS || 86_400);

async function main() {
  const privateKey = process.env.OPERATOR_PRIVATE_KEY || process.env.PRIVATE_KEY;
  if (!privateKey) throw new Error("OPERATOR_PRIVATE_KEY or PRIVATE_KEY is required");
  if (!CIVILIZATION || !/^0x[a-fA-F0-9]{40}$/.test(CIVILIZATION)) {
    throw new Error("NEXT_PUBLIC_CIVILIZATION_ADDRESS must be the deployed Civilization address");
  }
  if (!Number.isInteger(DURATION_SECONDS) || DURATION_SECONDS < 60) {
    throw new Error("PROPOSAL_DURATION_SECONDS must be a whole number of at least 60");
  }

  const normalized = (privateKey.startsWith("0x") ? privateKey : `0x${privateKey}`) as `0x${string}`;
  const account = privateKeyToAccount(normalized);
  const publicClient = createPublicClient({ chain: monadTestnet, transport: http(RPC) });
  const walletClient = createWalletClient({ account, chain: monadTestnet, transport: http(RPC) });
  const hash = await walletClient.writeContract({
    address: CIVILIZATION,
    abi: civilizationAbi,
    functionName: "createProposal",
    args: [DESCRIPTION, BigInt(DURATION_SECONDS)],
    account,
    chain: monadTestnet,
  });
  const receipt = await publicClient.waitForTransactionReceipt({ hash });
  if (receipt.status !== "success") throw new Error("Proposal transaction failed");
  const [event] = parseEventLogs({
    abi: civilizationAbi,
    eventName: "ProposalCreated",
    logs: receipt.logs,
    strict: false,
  });
  if (event?.args?.proposalId == null) throw new Error("ProposalCreated event missing from receipt");

  await ensureSeeded();
  const sql = getSql();
  const result = await sql<{ id: string }[]>`UPDATE proposals
    SET on_chain_id = ${Number(event.args.proposalId)}, description = ${DESCRIPTION},
      deadline = ${Date.now() + DURATION_SECONDS * 1000}, active = TRUE
    WHERE id = ${LOCAL_ID} RETURNING id`;
  if (!result.length) throw new Error(`Local proposal ${LOCAL_ID} was not found in DATABASE_URL`);
  console.log(`Published proposal #${event.args.proposalId} on Monad: ${hash}`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
