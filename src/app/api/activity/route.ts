import { NextRequest, NextResponse } from "next/server";
import { formatEther } from "viem";
import { z } from "zod";
import {
  addEvent,
  bumpMetrics,
  claimTransaction,
  castVote,
  createBusinessRecord,
  ensureSeeded,
  getCitizenByWallet,
  getMarket,
  hasRecordedTransaction,
  listProposals,
  syncOnchainTreasury,
  updateCitizenState,
  updateMarketPrices,
} from "@/lib/civilization/store";
import { startSimulationLoop } from "@/lib/sim/loop";
import { tradeTax } from "@/lib/token";
import type { ResourceId } from "@/lib/types";
import {
  asAddress,
  asUint,
  findCivilizationEvent,
  requireCivilizationEvent,
  requiresOnchainVerification,
  verifyCivilizationTransaction,
} from "@/lib/contracts/verify";
import { readOnchainCitizenState, readOnchainMarketState } from "@/lib/contracts/state";

export const dynamic = "force-dynamic";

const bodySchema = z.object({
  kind: z.enum(["BUY", "SELL", "BUSINESS", "VOTE", "JOIN"]),
  walletAddress: z.string().regex(/^0x[a-fA-F0-9]{40}$/),
  txHash: z.string().regex(/^0x[a-fA-F0-9]{64}$/).optional(),
  resourceId: z.number().int().min(0).max(2).optional(),
  amount: z.number().int().min(1).max(10_000).optional(),
  businessType: z.number().int().min(0).max(2).optional(),
  businessName: z.string().trim().min(1).max(64).optional(),
  proposalId: z.string().min(1).max(128).optional(),
  support: z.boolean().optional(),
});

const labels = ["Food", "Iron", "Energy"] as const;

function toResourceId(value: unknown, label: string): ResourceId {
  const number = Number(asUint(value, label));
  if (!Number.isSafeInteger(number) || number < 0 || number > 2) {
    throw new Error(`Invalid ${label} in Monad receipt`);
  }
  return number as ResourceId;
}

function toAmount(value: unknown, label: string) {
  const number = Number(asUint(value, label));
  if (!Number.isSafeInteger(number) || number < 1 || number > 10_000) {
    throw new Error(`Invalid ${label} in Monad receipt`);
  }
  return number;
}

function monFromWei(value: unknown, label: string) {
  const amount = Number(formatEther(asUint(value, label)));
  if (!Number.isFinite(amount) || amount < 0) throw new Error(`Invalid ${label} in Monad receipt`);
  return amount;
}

function marketWithPrice(market: { food: number; iron: number; energy: number }, resourceId: ResourceId, price: number) {
  return {
    food: resourceId === 0 ? price : market.food,
    iron: resourceId === 1 ? price : market.iron,
    energy: resourceId === 2 ? price : market.energy,
  };
}

export async function POST(req: NextRequest) {
  await startSimulationLoop();
  await ensureSeeded();
  const parsed = bodySchema.safeParse(await req.json());
  if (!parsed.success) return NextResponse.json({ error: "Invalid activity payload" }, { status: 400 });
  if (parsed.data.kind === "JOIN") {
    return NextResponse.json({ error: "Use the dedicated join endpoint" }, { status: 400 });
  }
  if (
    (parsed.data.kind === "BUY" || parsed.data.kind === "SELL") &&
    (parsed.data.resourceId == null || parsed.data.amount == null)
  ) {
    return NextResponse.json({ error: "A resource and amount are required" }, { status: 400 });
  }
  if (
    parsed.data.kind === "BUSINESS" &&
    (parsed.data.businessType == null || !parsed.data.businessName)
  ) {
    return NextResponse.json({ error: "A business type and name are required" }, { status: 400 });
  }
  if (
    parsed.data.kind === "VOTE" &&
    (!parsed.data.proposalId || parsed.data.support == null)
  ) {
    return NextResponse.json({ error: "A proposal and vote are required" }, { status: 400 });
  }

  const citizen = await getCitizenByWallet(parsed.data.walletAddress);
  if (!citizen) return NextResponse.json({ error: "Citizen not found" }, { status: 404 });

  const onchain = requiresOnchainVerification();
  let onchainState: Awaited<ReturnType<typeof readOnchainCitizenState>> = null;
  let onchainMarket: Awaited<ReturnType<typeof readOnchainMarketState>> = null;
  let txHash: string | undefined;
  let settledValue: number | null = null;
  let settledTax = 0;
  let chainBusinessId: number | undefined;

  try {
    if (onchain) {
      if (!parsed.data.txHash) throw new Error("A confirmed Monad transaction is required");

      const verified = await verifyCivilizationTransaction({
        txHash: parsed.data.txHash,
        walletAddress: parsed.data.walletAddress,
        action: parsed.data.kind,
      });
      txHash = parsed.data.txHash;
      const tax = findCivilizationEvent(verified.receipt, "TaxCollected");
      settledTax = tax ? monFromWei(tax.amount, "tax") : 0;

      if (parsed.data.kind === "BUY" || parsed.data.kind === "SELL") {
        const event = requireCivilizationEvent(
          verified.receipt,
          parsed.data.kind === "BUY" ? "ResourceBought" : "ResourceSold",
        );
        const resourceId = toResourceId(event.resourceId, "resource id");
        const amount = toAmount(event.amount, "resource amount");
        if (
          parsed.data.resourceId !== resourceId ||
          parsed.data.amount !== amount ||
          asAddress(event.citizen, "citizen").toLowerCase() !== citizen.walletAddress.toLowerCase()
        ) {
          throw new Error("Trade receipt does not match this request");
        }
        settledValue = monFromWei(
          parsed.data.kind === "BUY" ? event.totalCost : event.totalRevenue,
          parsed.data.kind === "BUY" ? "total cost" : "total revenue",
        );
      }

      if (parsed.data.kind === "BUSINESS") {
        const event = requireCivilizationEvent(verified.receipt, "BusinessCreated");
        const businessType = toResourceId(event.businessType, "business type");
        if (
          parsed.data.businessType !== businessType ||
          parsed.data.businessName !== event.name ||
          asAddress(event.owner, "business owner").toLowerCase() !== citizen.walletAddress.toLowerCase()
        ) {
          throw new Error("Business receipt does not match this request");
        }
        chainBusinessId = toAmount(event.businessId, "business id");
        settledValue = Number(formatEther(verified.transaction.value));
      }

      if (parsed.data.kind === "VOTE") {
        const event = requireCivilizationEvent(verified.receipt, "Voted");
        const proposalId = toAmount(event.proposalId, "proposal id");
        const proposals = await listProposals();
        const proposal = proposals.find((item) => item.id === parsed.data.proposalId);
        if (
          !proposal ||
          proposal.onChainId !== proposalId ||
          parsed.data.support !== event.support ||
          asAddress(event.voter, "voter").toLowerCase() !== citizen.walletAddress.toLowerCase()
        ) {
          throw new Error("Vote receipt does not match this proposal");
        }
      }

      onchainState = await readOnchainCitizenState(citizen.walletAddress as `0x${string}`);
      if (!onchainState) {
        throw new Error("Monad confirmed the transaction, but its settled state could not be read. Retry sync shortly.");
      }
      onchainMarket = await readOnchainMarketState();
      if (!onchainMarket) {
        throw new Error("Monad confirmed the transaction, but market settlement could not be read. Retry sync shortly.");
      }
    }
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Could not verify Monad transaction" },
      { status: 400 },
    );
  }

  if (onchain && txHash) {
    // Verify first, then make a successfully recorded receipt idempotent. A
    // browser retry after a lost response should never look like a failed
    // trade or vote to the player.
    if (await hasRecordedTransaction(txHash)) {
      return NextResponse.json({ ok: true, replayed: true });
    }
    if (!(await claimTransaction(txHash))) {
      if (await hasRecordedTransaction(txHash)) {
        return NextResponse.json({ ok: true, replayed: true });
      }
      return NextResponse.json(
        { error: "This Monad transaction is already being synchronized. Retry in a moment." },
        { status: 409 },
      );
    }
  }

  const market = await getMarket();

  if (parsed.data.kind === "BUY" || parsed.data.kind === "SELL") {
    const resourceId = parsed.data.resourceId! as ResourceId;
    const amount = parsed.data.amount!;
    const side = parsed.data.kind;
    const currentPrice = resourceId === 0 ? market.food : resourceId === 1 ? market.iron : market.energy;
    const settlement = settledValue ?? currentPrice * amount;
    const tax = onchain ? settledTax : citizen.coins >= tradeTax(settlement) ? tradeTax(settlement) : 0;
    const inventory = { ...citizen.inventory };

    if (side === "BUY") {
      inventory[resourceId === 0 ? "food" : resourceId === 1 ? "iron" : "energy"] += amount;
    } else {
      const key = resourceId === 0 ? "food" : resourceId === 1 ? "iron" : "energy";
      if (!onchain && inventory[key] < amount) {
        return NextResponse.json({ error: "Insufficient inventory" }, { status: 400 });
      }
      inventory[key] = Math.max(0, inventory[key] - amount);
    }

    if (onchainState) {
      await updateCitizenState(citizen.id, {
        balance: onchainState.nativeMon,
        food: onchainState.inventory.food,
        iron: onchainState.inventory.iron,
        energy: onchainState.inventory.energy,
        coins: onchainState.mda,
      });
    } else {
      await updateCitizenState(citizen.id, {
        balance: side === "BUY" ? Math.max(0, citizen.balance - settlement) : citizen.balance + settlement,
        food: inventory.food,
        iron: inventory.iron,
        energy: inventory.energy,
        coins: Math.max(0, citizen.coins - tax),
      });
    }

    const nextMarket = onchainMarket
      ? { food: onchainMarket.food, iron: onchainMarket.iron, energy: onchainMarket.energy }
      : marketWithPrice(
          market,
          resourceId,
          side === "BUY"
            ? currentPrice * (1 + amount * 0.004)
            : Math.max(0.2, currentPrice * (1 - amount * 0.004)),
        );
    await updateMarketPrices(nextMarket.food, nextMarket.iron, nextMarket.energy);
    await bumpMetrics({
      isAI: false,
      economic: true,
      treasuryDelta: onchainMarket ? 0 : side === "BUY" ? settlement : -settlement,
      coinTreasuryDelta: onchainMarket ? 0 : tax,
    });
    await addEvent({
      kind: side,
      actorName: citizen.name,
      actorType: "HUMAN",
      message: `${citizen.name} ${side === "BUY" ? "bought" : "sold"} ${amount} ${labels[resourceId]}`,
      txHash,
      meta: { resourceId, amount, settledValue: settlement, settledOnMonad: onchain },
    });
  }

  if (parsed.data.kind === "BUSINESS") {
    const businessType = parsed.data.businessType! as 0 | 1 | 2;
    const stake = settledValue ?? 5;
    if (onchainState) {
      await updateCitizenState(citizen.id, {
        balance: onchainState.nativeMon,
        food: onchainState.inventory.food,
        iron: onchainState.inventory.iron,
        energy: onchainState.inventory.energy,
        coins: onchainState.mda,
      });
    } else if (citizen.balance < stake) {
      return NextResponse.json({ error: "Insufficient balance" }, { status: 400 });
    } else {
      await updateCitizenState(citizen.id, { balance: citizen.balance - stake });
    }
    await createBusinessRecord({
      ownerId: citizen.id,
      ownerName: citizen.name,
      name: parsed.data.businessName!,
      businessType,
      onChainId: chainBusinessId,
    });
    await bumpMetrics({ isAI: false, economic: true, treasuryDelta: onchainMarket ? 0 : stake });
    await addEvent({
      kind: "BUSINESS",
      actorName: citizen.name,
      actorType: "HUMAN",
      message: `${citizen.name} created "${parsed.data.businessName}"`,
      txHash,
      meta: { onChainId: chainBusinessId, settledOnMonad: onchain },
    });
  }

  if (parsed.data.kind === "VOTE") {
    const cast = await castVote(parsed.data.proposalId!, citizen.id, parsed.data.support!);
    if (!cast) return NextResponse.json({ error: "You have already voted on this proposal" }, { status: 409 });
    await updateCitizenState(citizen.id, { reputation: citizen.reputation + 1 });
    await bumpMetrics({ isAI: false, economic: true });
    await addEvent({
      kind: "VOTE",
      actorName: citizen.name,
      actorType: "HUMAN",
      message: `${citizen.name} voted ${parsed.data.support ? "YES" : "NO"}`,
      txHash,
      meta: { settledOnMonad: onchain },
    });
  }

  if (onchainMarket) {
    await syncOnchainTreasury(onchainMarket.treasuryMon, onchainMarket.tokenTreasuryMda);
  }

  return NextResponse.json({ ok: true });
}
