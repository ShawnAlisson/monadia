/** Register the seeded AI agent wallets with the deployed Civilization contract. */
import { ensureSeeded } from "../src/lib/civilization/store";
import { registerAgentsOnChain } from "../src/lib/sim/onchain";

async function main() {
  if (process.env.ENABLE_ONCHAIN_AI !== "true") {
    throw new Error("Set ENABLE_ONCHAIN_AI=true before registering funded AI wallets");
  }
  if (!process.env.AGENT_MNEMONIC) throw new Error("AGENT_MNEMONIC required");
  if (!process.env.OPERATOR_PRIVATE_KEY && !process.env.PRIVATE_KEY) {
    throw new Error("OPERATOR_PRIVATE_KEY or PRIVATE_KEY required");
  }
  await ensureSeeded();
  const limit = Number(process.env.AGENT_COUNT || 24);
  const result = await registerAgentsOnChain(limit);
  console.log(`Registered ${result.registered} AI agents on Monad.`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
