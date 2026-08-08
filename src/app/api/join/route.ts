import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import {
  claimTransaction,
  ensureSeeded,
  getCitizenByWallet,
  hasRecordedTransaction,
  joinHuman,
} from "@/lib/civilization/store";
import { startSimulationLoop } from "@/lib/sim/loop";
import {
  asAddress,
  requireCivilizationEvent,
  requiresOnchainVerification,
  verifyCivilizationTransaction,
} from "@/lib/contracts/verify";
import {
  readOnchainCitizenMembership,
  readOnchainCitizenState,
} from "@/lib/contracts/state";

export const dynamic = "force-dynamic";

const bodySchema = z.object({
  walletAddress: z.string().regex(/^0x[a-fA-F0-9]{40}$/),
  name: z.string().min(1).max(32),
  txHash: z.string().regex(/^0x[a-fA-F0-9]{64}$/).optional(),
  /** When true, sync an already-joined on-chain citizen without a new join tx. */
  syncExisting: z.boolean().optional(),
});

export async function POST(req: NextRequest) {
  await startSimulationLoop();
  await ensureSeeded();
  const json = await req.json();
  const parsed = bodySchema.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid body" }, { status: 400 });
  }

  const existing = await getCitizenByWallet(parsed.data.walletAddress);
  if (existing) {
    return NextResponse.json({ citizen: existing, replayed: true });
  }

  let onchainState: Awaited<ReturnType<typeof readOnchainCitizenState>> = null;

  if (requiresOnchainVerification()) {
    const membership = await readOnchainCitizenMembership(
      parsed.data.walletAddress as `0x${string}`,
    );

    // Returning players: already joined on Monad — sync into the read model.
    if (membership?.joined && !membership.isAI) {
      const onchainName = membership.name?.trim() || parsed.data.name;
      onchainState = await readOnchainCitizenState(
        parsed.data.walletAddress as `0x${string}`,
      );
      const citizen = await joinHuman(
        parsed.data.walletAddress,
        onchainName,
        undefined,
        onchainState,
      );
      return NextResponse.json({ citizen, synced: true });
    }

    if (parsed.data.syncExisting) {
      return NextResponse.json(
        { error: "This wallet has not joined Civilization on Monad yet." },
        { status: 400 },
      );
    }

    if (!parsed.data.txHash) {
      return NextResponse.json(
        { error: "A confirmed Monad join transaction is required" },
        { status: 400 },
      );
    }
    try {
      const verified = await verifyCivilizationTransaction({
        txHash: parsed.data.txHash,
        walletAddress: parsed.data.walletAddress,
        action: "JOIN",
      });
      if (String(verified.decoded.args[0]) !== parsed.data.name) {
        return NextResponse.json({ error: "Join transaction name does not match" }, { status: 400 });
      }
      const event = requireCivilizationEvent(verified.receipt, "CitizenJoined");
      if (
        asAddress(event.citizen, "citizen").toLowerCase() !== parsed.data.walletAddress.toLowerCase() ||
        event.name !== parsed.data.name ||
        event.isAI !== false
      ) {
        return NextResponse.json({ error: "Join receipt does not match this citizen" }, { status: 400 });
      }
      onchainState = await readOnchainCitizenState(parsed.data.walletAddress as `0x${string}`);
      if (!onchainState) {
        return NextResponse.json(
          { error: "Monad confirmed the join, but its settled state could not be read. Retry sync shortly." },
          { status: 503 },
        );
      }
    } catch (error) {
      return NextResponse.json(
        { error: error instanceof Error ? error.message : "Could not verify Monad transaction" },
        { status: 400 },
      );
    }

    if (await hasRecordedTransaction(parsed.data.txHash)) {
      const replayed = await getCitizenByWallet(parsed.data.walletAddress);
      if (replayed) return NextResponse.json({ citizen: replayed, replayed: true });
    }
    if (!(await claimTransaction(parsed.data.txHash))) {
      const claimed = await getCitizenByWallet(parsed.data.walletAddress);
      if (claimed) return NextResponse.json({ citizen: claimed, replayed: true });
      return NextResponse.json(
        { error: "This Monad transaction is already being synchronized. Retry in a moment." },
        { status: 409 },
      );
    }
  }

  const citizen = await joinHuman(
    parsed.data.walletAddress,
    parsed.data.name,
    parsed.data.txHash,
    onchainState,
  );
  return NextResponse.json({ citizen });
}
