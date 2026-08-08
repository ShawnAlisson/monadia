import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { formatEther } from "viem";
import {
  addEvent,
  bumpMetrics,
  claimTransaction,
  ensureSeeded,
  getCitizen,
  hasRecordedTransaction,
  syncOnchainTreasury,
  updateCitizenState,
} from "@/lib/civilization/store";
import { startSimulationLoop } from "@/lib/sim/loop";
import {
  asAddress,
  asUint,
  requireCivilizationEvent,
  requiresOnchainVerification,
  verifyCivilizationTransaction,
} from "@/lib/contracts/verify";
import { readOnchainCitizenState, readOnchainMarketState } from "@/lib/contracts/state";

export const dynamic = "force-dynamic";

const bodySchema = z.object({
  employerId: z.string(),
  agentId: z.string(),
  txHash: z.string().regex(/^0x[a-fA-F0-9]{64}$/).optional(),
});

export async function POST(req: NextRequest) {
  await startSimulationLoop();
  await ensureSeeded();
  const parsed = bodySchema.safeParse(await req.json());
  if (!parsed.success) return NextResponse.json({ error: "Invalid body" }, { status: 400 });

  const employer = await getCitizen(parsed.data.employerId);
  const agent = await getCitizen(parsed.data.agentId);
  if (!employer || !agent || agent.type !== "AI") {
    return NextResponse.json({ error: "Invalid hire" }, { status: 400 });
  }

  let onchainState: Awaited<ReturnType<typeof readOnchainCitizenState>> = null;
  let onchainMarket: Awaited<ReturnType<typeof readOnchainMarketState>> = null;
  let treasuryDelta = 2;
  if (requiresOnchainVerification()) {
    if (!parsed.data.txHash) {
      return NextResponse.json({ error: "A confirmed Monad hire transaction is required" }, { status: 400 });
    }
    try {
      const verified = await verifyCivilizationTransaction({
        txHash: parsed.data.txHash,
        walletAddress: employer.walletAddress,
        action: "HIRE",
      });
      if (String(verified.decoded.args[0]).toLowerCase() !== agent.walletAddress.toLowerCase()) {
        return NextResponse.json({ error: "Hire transaction agent does not match" }, { status: 400 });
      }
      const event = requireCivilizationEvent(verified.receipt, "AgentHired");
      if (
        asAddress(event.employer, "employer").toLowerCase() !== employer.walletAddress.toLowerCase() ||
        asAddress(event.agent, "agent").toLowerCase() !== agent.walletAddress.toLowerCase() ||
        asUint(event.dailyRate, "daily rate") !== BigInt("2000000000000000000")
      ) {
        return NextResponse.json({ error: "Hire receipt does not match the selected agent" }, { status: 400 });
      }
      treasuryDelta = Number(formatEther(verified.transaction.value));
      onchainState = await readOnchainCitizenState(employer.walletAddress as `0x${string}`);
      if (!onchainState) {
        return NextResponse.json(
          { error: "Monad confirmed the hire, but its settled state could not be read. Retry sync shortly." },
          { status: 503 },
        );
      }
      onchainMarket = await readOnchainMarketState();
      if (!onchainMarket) {
        return NextResponse.json(
          { error: "Monad confirmed the hire, but market settlement could not be read. Retry sync shortly." },
          { status: 503 },
        );
      }
    } catch (error) {
      return NextResponse.json({ error: error instanceof Error ? error.message : "Could not verify Monad transaction" }, { status: 400 });
    }
  }

  if (requiresOnchainVerification() && parsed.data.txHash) {
    if (await hasRecordedTransaction(parsed.data.txHash)) {
      return NextResponse.json({ ok: true, agent: await getCitizen(agent.id), replayed: true });
    }
    if (!(await claimTransaction(parsed.data.txHash))) {
      const syncedAgent = await getCitizen(agent.id);
      if (syncedAgent?.employerId === employer.id) {
        return NextResponse.json({ ok: true, agent: syncedAgent, replayed: true });
      }
      return NextResponse.json(
        { error: "This Monad transaction is already being synchronized. Retry in a moment." },
        { status: 409 },
      );
    }
  }

  if (onchainState) {
    await updateCitizenState(employer.id, {
      balance: onchainState.nativeMon,
      food: onchainState.inventory.food,
      iron: onchainState.inventory.iron,
      energy: onchainState.inventory.energy,
      coins: onchainState.mda,
    });
  }
  await updateCitizenState(agent.id, { employerId: employer.id, reputation: agent.reputation + 2 });
  await bumpMetrics({ isAI: false, economic: true, treasuryDelta: onchainMarket ? 0 : treasuryDelta });
  await addEvent({
    kind: "HIRE",
    actorName: employer.name,
    actorType: "HUMAN",
    message: `${employer.name} hired ${agent.name}`,
    txHash: parsed.data.txHash,
  });

  if (onchainMarket) {
    await syncOnchainTreasury(onchainMarket.treasuryMon, onchainMarket.tokenTreasuryMda);
  }

  return NextResponse.json({ ok: true, agent: await getCitizen(agent.id) });
}
