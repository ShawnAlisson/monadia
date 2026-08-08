import {
  addEvent,
  bumpMetrics,
  castVote,
  createBusinessRecord,
  getMarket,
  listBusinesses,
  listCitizens,
  listProposals,
  syncOnchainTreasury,
  updateCitizenState,
  updateMarketPrices,
} from "@/lib/civilization/store";
import type { Citizen, ResourceId } from "@/lib/types";
import { tryOnChainBuy, tryOnChainSell, tryOnChainVote, isOnChainAiEnabled } from "@/lib/sim/onchain";
import { readOnchainCitizenState, readOnchainMarketState } from "@/lib/contracts/state";
import { tradeTax } from "@/lib/token";

type Action =
  | { type: "BUY"; resourceId: ResourceId; amount: number; reasoning: string }
  | { type: "SELL"; resourceId: ResourceId; amount: number; reasoning: string }
  | { type: "BUSINESS"; businessType: 0 | 1 | 2; name: string; reasoning: string }
  | { type: "VOTE"; support: boolean; reasoning: string }
  | { type: "IDLE"; reasoning: string };

const RESOURCE_LABEL = ["Food", "Iron", "Energy"] as const;

function avg(history: number[], fallback: number) {
  if (!history.length) return fallback;
  return history.reduce((a, b) => a + b, 0) / history.length;
}

async function decide(agent: Citizen): Promise<Action> {
  const market = await getMarket();
  const foodAvg = avg(
    market.history.map((h) => h.food),
    market.food,
  );
  const ironAvg = avg(
    market.history.map((h) => h.iron),
    market.iron,
  );
  const energyAvg = avg(
    market.history.map((h) => h.energy),
    market.energy,
  );

  const roll = Math.random();

  if (agent.personality === "Revolutionary" && roll < 0.25) {
    return {
      type: "VOTE",
      support: true,
      reasoning: "Tax reform advances political influence — voting YES.",
    };
  }
  if (agent.personality === "Conservative" && roll < 0.2) {
    return {
      type: "VOTE",
      support: false,
      reasoning: "Higher taxes threaten wealth preservation — voting NO.",
    };
  }

  if (agent.occupation === "Industrialist" || agent.personality === "Industrial") {
    if (market.iron < ironAvg * 1.05 && agent.balance > market.iron * 2) {
      const amount = Math.min(8, Math.floor(agent.balance / market.iron));
      if (amount > 0) {
        return {
          type: "BUY",
          resourceId: 1,
          amount,
          reasoning: "Iron looks cheap relative to recent average — accumulating inventory.",
        };
      }
    }
    if (market.iron > ironAvg * 1.15 && agent.inventory.iron > 3) {
      return {
        type: "SELL",
        resourceId: 1,
        amount: Math.min(6, agent.inventory.iron),
        reasoning: "Iron spiked above average — selling into strength.",
      };
    }
  }

  if (agent.occupation === "Merchant" || agent.personality === "Aggressive") {
    if (market.food < foodAvg && agent.balance > market.food * 3) {
      return {
        type: "BUY",
        resourceId: 0,
        amount: Math.min(12, Math.max(1, Math.floor(agent.balance / market.food / 2))),
        reasoning:
          "Food prices are below their recent average, so I purchased additional inventory.",
      };
    }
    if (market.food > foodAvg * 1.2 && agent.inventory.food > 2) {
      return {
        type: "SELL",
        resourceId: 0,
        amount: Math.min(10, agent.inventory.food),
        reasoning: "Food is expensive — locking in merchant profits.",
      };
    }
    if (market.energy < energyAvg * 0.95 && agent.balance > market.energy * 2) {
      return {
        type: "BUY",
        resourceId: 2,
        amount: Math.min(6, Math.max(1, Math.floor(agent.balance / market.energy / 2))),
        reasoning: "Energy discount detected — aggressive accumulation.",
      };
    }
  }

  if (agent.personality === "Speculative" || agent.occupation === "Speculator") {
    const resourceId = ([0, 1, 2] as ResourceId[])[Math.floor(Math.random() * 3)];
    const price = resourceId === 0 ? market.food : resourceId === 1 ? market.iron : market.energy;
    if (roll < 0.55 && agent.balance > price * 2) {
      return {
        type: "BUY",
        resourceId,
        amount: Math.min(5, Math.max(1, Math.floor(agent.balance / price / 3))),
        reasoning: `High-frequency speculative buy on ${RESOURCE_LABEL[resourceId]}.`,
      };
    }
    const inv =
      resourceId === 0
        ? agent.inventory.food
        : resourceId === 1
          ? agent.inventory.iron
          : agent.inventory.energy;
    if (inv > 1) {
      return {
        type: "SELL",
        resourceId,
        amount: Math.min(4, inv),
        reasoning: `Flipping ${RESOURCE_LABEL[resourceId]} for short-term profit.`,
      };
    }
  }

  if (agent.personality === "Conservative") {
    if (market.food < foodAvg * 0.85 && agent.balance > market.food * 4) {
      return {
        type: "BUY",
        resourceId: 0,
        amount: 2,
        reasoning: "Only buying the deep dip — preserving capital otherwise.",
      };
    }
    return {
      type: "IDLE",
      reasoning: "Holding MON. Risk conditions are unfavorable.",
    };
  }

  if (agent.balance > 25 && roll < 0.08) {
    const businessType = (
      agent.occupation === "Industrialist" ? 1 : agent.occupation === "Engineer" ? 2 : 0
    ) as 0 | 1 | 2;
    const names = ["Farmstead", "Ironworks", "Power Node"] as const;
    return {
      type: "BUSINESS",
      businessType,
      name: `${agent.name} ${names[businessType]}`,
      reasoning: "Capital threshold reached — founding a productive enterprise.",
    };
  }

  if (agent.balance > market.food * 2 && roll < 0.5) {
    return {
      type: "BUY",
      resourceId: 0,
      amount: Math.min(4, Math.max(1, Math.floor(agent.balance / market.food / 4))),
      reasoning: "Routine provisioning of Food for the colony.",
    };
  }
  if (agent.inventory.energy > 2 && roll < 0.7) {
    return {
      type: "SELL",
      resourceId: 2,
      amount: Math.min(3, agent.inventory.energy),
      reasoning: "Rebalancing Energy inventory into MON.",
    };
  }

  return { type: "IDLE", reasoning: "Observing market microstructure." };
}

async function applyLocalTrade(
  agent: Citizen,
  side: "BUY" | "SELL",
  resourceId: ResourceId,
  amount: number,
): Promise<{ cost: number; price: number } | null> {
  const market = await getMarket();
  const price = resourceId === 0 ? market.food : resourceId === 1 ? market.iron : market.energy;
  const cost = price * amount;
  let food = agent.inventory.food;
  let iron = agent.inventory.iron;
  let energy = agent.inventory.energy;
  let balance = agent.balance;

  // civic MDA tax on trade value (waived if the citizen can't pay)
  const taxOwed = tradeTax(cost);
  const tax = agent.coins >= taxOwed ? taxOwed : 0;

  if (side === "BUY") {
    if (balance < cost) return null;
    balance -= cost;
    if (resourceId === 0) food += amount;
    if (resourceId === 1) iron += amount;
    if (resourceId === 2) energy += amount;
    await updateMarketPrices(
      resourceId === 0 ? market.food * (1 + amount * 0.004) : market.food,
      resourceId === 1 ? market.iron * (1 + amount * 0.004) : market.iron,
      resourceId === 2 ? market.energy * (1 + amount * 0.004) : market.energy,
    );
    await bumpMetrics({ isAI: true, economic: true, treasuryDelta: cost, coinTreasuryDelta: tax });
  } else {
    const have = resourceId === 0 ? food : resourceId === 1 ? iron : energy;
    if (have < amount) return null;
    if (resourceId === 0) food -= amount;
    if (resourceId === 1) iron -= amount;
    if (resourceId === 2) energy -= amount;
    balance += cost;
    await updateMarketPrices(
      resourceId === 0 ? Math.max(0.2, market.food * (1 - amount * 0.004)) : market.food,
      resourceId === 1 ? Math.max(0.2, market.iron * (1 - amount * 0.004)) : market.iron,
      resourceId === 2 ? Math.max(0.2, market.energy * (1 - amount * 0.004)) : market.energy,
    );
    await bumpMetrics({ isAI: true, economic: true, treasuryDelta: -cost * 0.1, coinTreasuryDelta: tax });
  }

  await updateCitizenState(agent.id, { balance, food, iron, energy, coins: agent.coins - tax });
  return { cost, price };
}

async function execute(agent: Citizen, action: Action) {
  if (action.type === "IDLE") {
    await updateCitizenState(agent.id, { lastReasoning: action.reasoning });
    return;
  }

  if (action.type === "BUY" || action.type === "SELL") {
    if (isOnChainAiEnabled()) {
      const result =
        action.type === "BUY"
          ? await tryOnChainBuy(agent, action.resourceId, action.amount)
          : await tryOnChainSell(agent, action.resourceId, action.amount);
      if (!result?.txHash) {
        await updateCitizenState(agent.id, {
          lastReasoning: "On-chain action deferred — agent wallet needs funds, registration, or market liquidity.",
        });
        return;
      }
      const [settledCitizen, settledMarket] = await Promise.all([
        readOnchainCitizenState(agent.walletAddress as `0x${string}`),
        readOnchainMarketState(),
      ]);
      if (!settledCitizen || !settledMarket) {
        await updateCitizenState(agent.id, {
          lastReasoning: "Monad trade confirmed; waiting for a reliable public-state refresh before updating the world.",
        });
        return;
      }
      await updateCitizenState(agent.id, {
        balance: settledCitizen.nativeMon,
        food: settledCitizen.inventory.food,
        iron: settledCitizen.inventory.iron,
        energy: settledCitizen.inventory.energy,
        coins: settledCitizen.mda,
        lastReasoning: action.reasoning,
      });
      await updateMarketPrices(settledMarket.food, settledMarket.iron, settledMarket.energy);
      await syncOnchainTreasury(settledMarket.treasuryMon, settledMarket.tokenTreasuryMda);
      await bumpMetrics({ isAI: true, economic: true });
      await addEvent({
        kind: action.type,
        actorName: agent.name,
        actorType: "AI",
        message: `${agent.name} ${action.type === "BUY" ? "bought" : "sold"} ${action.amount} ${RESOURCE_LABEL[action.resourceId]}`,
        txHash: result.txHash,
        meta: { resourceId: action.resourceId, amount: action.amount, settledOnMonad: true },
      });
      return;
    }

    const applied = await applyLocalTrade(agent, action.type, action.resourceId, action.amount);
    if (!applied) {
      await updateCitizenState(agent.id, {
        lastReasoning: "Action aborted — insufficient funds/inventory.",
      });
      return;
    }

    await updateCitizenState(agent.id, { lastReasoning: action.reasoning });
    await addEvent({
      kind: action.type,
      actorName: agent.name,
      actorType: "AI",
      message: `${agent.name} ${action.type === "BUY" ? "bought" : "sold"} ${action.amount} ${RESOURCE_LABEL[action.resourceId]}`,
      txHash: null,
      meta: { resourceId: action.resourceId, amount: action.amount },
    });
    return;
  }

  if (action.type === "BUSINESS") {
    if (isOnChainAiEnabled()) {
      await updateCitizenState(agent.id, {
        lastReasoning: "On-chain business formation is disabled for autonomous agents until they have dedicated stake budgets.",
      });
      return;
    }
    if (agent.balance < 5) return;
    await updateCitizenState(agent.id, {
      balance: agent.balance - 5,
      lastReasoning: action.reasoning,
    });
    await createBusinessRecord({
      ownerId: agent.id,
      ownerName: agent.name,
      name: action.name,
      businessType: action.businessType,
    });
    await bumpMetrics({ isAI: true, economic: true, treasuryDelta: 5 });
    await addEvent({
      kind: "BUSINESS",
      actorName: agent.name,
      actorType: "AI",
      message: `${agent.name} created "${action.name}"`,
    });
    return;
  }

  if (action.type === "VOTE") {
    const proposals = (await listProposals()).filter((p) => p.active);
    if (!proposals.length) return;
    const proposal = proposals[0];
    let txHash: string | null = null;
    if (isOnChainAiEnabled()) {
      if (proposal.onChainId == null) {
        await updateCitizenState(agent.id, {
          lastReasoning: "Civic vote deferred — the current proposal has not been published on Monad.",
        });
        return;
      }
      const result = await tryOnChainVote(agent, proposal.onChainId, action.support);
      txHash = result?.txHash ?? null;
      if (!txHash) {
        await updateCitizenState(agent.id, {
          lastReasoning: "On-chain vote deferred — agent wallet needs funds or registration.",
        });
        return;
      }
    }
    const ok = await castVote(proposal.id, agent.id, action.support);
    if (!ok) return;
    await updateCitizenState(agent.id, {
      reputation: agent.reputation + 1,
      lastReasoning: action.reasoning,
    });
    await bumpMetrics({ isAI: true, economic: true });
    await addEvent({
      kind: "VOTE",
      actorName: agent.name,
      actorType: "AI",
      message: `${agent.name} voted ${action.support ? "YES" : "NO"} on proposal`,
      txHash,
    });
  }
}

async function produceBusinesses() {
  // `produce` is operator-only in the live contract. Do not show off-chain
  // inventory as settled when the autonomous on-chain loop is enabled.
  if (isOnChainAiEnabled()) return;
  const businesses = (await listBusinesses()).filter((b) => b.active);
  const citizens = await listCitizens("ALL");
  for (const b of businesses) {
    const owner = citizens.find((c) => c.id === b.ownerId);
    if (!owner) continue;
    if (b.businessType === 0) {
      await updateCitizenState(owner.id, { food: owner.inventory.food + 10 });
      await addEvent({
        kind: "PRODUCE",
        actorName: b.name,
        actorType: owner.type,
        message: `🏭 ${b.name} produced 10 Food`,
      });
    } else if (b.businessType === 1) {
      await updateCitizenState(owner.id, { iron: owner.inventory.iron + 5 });
      await addEvent({
        kind: "PRODUCE",
        actorName: b.name,
        actorType: owner.type,
        message: `🏭 ${b.name} produced 5 Iron`,
      });
    } else {
      await updateCitizenState(owner.id, { energy: owner.inventory.energy + 4 });
      await addEvent({
        kind: "PRODUCE",
        actorName: b.name,
        actorType: owner.type,
        message: `🏭 ${b.name} produced 4 Energy`,
      });
    }
    await bumpMetrics({ isAI: owner.type === "AI", economic: true, txs: 0 });
  }
}

export async function runSimulationTick(maxAgents?: number) {
  const agents = await listCitizens("AI");
  if (!agents.length) return;

  const count = Math.min(agents.length, maxAgents ?? (3 + Math.floor(Math.random() * 3)));
  const shuffled = [...agents].sort(() => Math.random() - 0.5).slice(0, count);

  for (const agent of shuffled) {
    const action = await decide(agent);
    await execute(agent, action);
  }
}

export async function runProductionTick() {
  await produceBusinesses();
}
