import { randomUUID } from "crypto";
import { ensureDatabase, getSql } from "@/lib/db";
import { getAgentSeeds } from "@/lib/agents/seed";
import { getAgentAccount } from "@/lib/wallets";
import { MDA } from "@/lib/token";
import type {
  Business,
  Citizen,
  CivilizationEvent,
  MarketState,
  Metrics,
  MoneyRequest,
  Proposal,
  SocialMessage,
} from "@/lib/types";

/** Humans count as online if they heartbeated within this window. */
export const PRESENCE_ONLINE_MS = 20_000;

type CitizenRow = {
  id: string;
  name: string;
  wallet_address: string;
  type: "HUMAN" | "AI";
  balance: number | string;
  personality: Citizen["personality"];
  goal: string;
  occupation: Citizen["occupation"];
  food: number | string;
  iron: number | string;
  energy: number | string;
  reputation: number | string;
  coins: number | string;
  net_worth: number | string;
  employer_id: string | null;
  wallet_index: number | string | null;
  map_x: number | string;
  map_y: number | string;
  world_x: number | string | null;
  world_z: number | string | null;
  last_seen_at: number | string | null;
  last_reasoning: string | null;
  created_at: number | string;
  updated_at: number | string;
};

type EventRow = {
  id: string;
  ts: number | string;
  kind: string;
  actor_name: string;
  actor_type: "HUMAN" | "AI";
  message: string;
  tx_hash: string | null;
  meta_json: unknown;
};

const asNumber = (value: number | string | null | undefined) => Number(value ?? 0);
const now = () => Date.now();
const globalForStore = globalThis as typeof globalThis & {
  __monadiaSeedPromise?: Promise<void>;
  __monadiaMarketPromise?: Promise<void>;
};

function mapCitizen(row: CitizenRow): Citizen {
  const lastSeenAt =
    row.last_seen_at == null || row.last_seen_at === ""
      ? null
      : asNumber(row.last_seen_at);
  return {
    id: row.id,
    name: row.name,
    walletAddress: row.wallet_address,
    type: row.type,
    balance: asNumber(row.balance),
    personality: row.personality,
    goal: row.goal,
    occupation: row.occupation,
    inventory: { food: asNumber(row.food), iron: asNumber(row.iron), energy: asNumber(row.energy) },
    reputation: asNumber(row.reputation),
    coins: asNumber(row.coins),
    netWorth: asNumber(row.net_worth),
    employerId: row.employer_id,
    mapX: asNumber(row.map_x),
    mapY: asNumber(row.map_y),
    worldX: row.world_x == null || row.world_x === "" ? null : asNumber(row.world_x),
    worldZ: row.world_z == null || row.world_z === "" ? null : asNumber(row.world_z),
    lastSeenAt,
    online: lastSeenAt != null && Date.now() - lastSeenAt < PRESENCE_ONLINE_MS,
    lastReasoning: row.last_reasoning,
    createdAt: asNumber(row.created_at),
    updatedAt: asNumber(row.updated_at),
  };
}

function parseMeta(value: unknown): Record<string, unknown> | undefined {
  if (!value) return undefined;
  if (typeof value === "string") {
    try {
      return JSON.parse(value) as Record<string, unknown>;
    } catch {
      return undefined;
    }
  }
  return value as Record<string, unknown>;
}

function mapEvent(row: EventRow): CivilizationEvent {
  return {
    id: row.id,
    ts: asNumber(row.ts),
    kind: row.kind,
    actorName: row.actor_name,
    actorType: row.actor_type,
    message: row.message,
    txHash: row.tx_hash,
    meta: parseMeta(row.meta_json),
  };
}

function computeNetWorth(
  balance: number,
  food: number,
  iron: number,
  energy: number,
  market: { food: number; iron: number; energy: number },
) {
  return balance + food * market.food + iron * market.iron + energy * market.energy;
}

async function insertEvent(input: {
  id?: string;
  kind: string;
  actorName: string;
  actorType: "HUMAN" | "AI";
  message: string;
  txHash?: string | null;
  meta?: Record<string, unknown>;
}) {
  await ensureDatabase();
  const sql = getSql();
  const id = input.id ?? randomUUID();
  await sql`INSERT INTO events (id, ts, kind, actor_name, actor_type, message, tx_hash, meta_json)
    VALUES (${id}, ${now()}, ${input.kind}, ${input.actorName}, ${input.actorType}, ${input.message}, ${input.txHash ?? null}, ${input.meta ? JSON.stringify(input.meta) : null}::jsonb)
    ON CONFLICT (id) DO NOTHING`;
  return id;
}

async function ensureMarketRow() {
  if (!globalForStore.__monadiaMarketPromise) {
    globalForStore.__monadiaMarketPromise = (async () => {
      await ensureDatabase();
      const sql = getSql();
      const timestamp = now();
      await sql.transaction((tx: typeof sql) => [
        tx`INSERT INTO market (id, food, iron, energy, updated_at)
          VALUES (1, 1, 2, 3, ${timestamp}) ON CONFLICT (id) DO NOTHING`,
        tx`INSERT INTO metrics (id, transactions, ai_transactions, human_transactions, economic_events, treasury, coin_treasury)
          VALUES (1, 0, 0, 0, 0, 0, 0) ON CONFLICT (id) DO NOTHING`,
      ]);
    })().catch((error) => {
      globalForStore.__monadiaMarketPromise = undefined;
      throw error;
    });
  }
  return globalForStore.__monadiaMarketPromise;
}

async function ensureProposal() {
  await ensureDatabase();
  const sql = getSql();
  const lock = await sql<{ key: string }[]>`INSERT INTO meta (key, value)
    VALUES ('initial_proposal_v1', ${String(now())}) ON CONFLICT (key) DO NOTHING RETURNING key`;
  if (!lock.length) return;
  await sql`INSERT INTO proposals (id, on_chain_id, description, yes_votes, no_votes, deadline, active)
    VALUES ('proposal-tax-v1', NULL, 'Increase food production tax from 2% → 3%.', 0, 0, ${now() + 86_400_000}, TRUE)
    ON CONFLICT (id) DO NOTHING`;
}

/** Idempotently initializes the shared Postgres world. */
async function seedWorld() {
  await ensureMarketRow();
  const sql = getSql();
  const timestamp = now();
  const seeds = getAgentSeeds(24);
  const market = { food: 1, iron: 2, energy: 3 };

  // One HTTP transaction rather than 24 sequential cold-start requests.
  await sql.transaction((tx: typeof sql) =>
    seeds.map((seed, index) => {
      const account = getAgentAccount(index);
      const netWorth = computeNetWorth(seed.balance, seed.food, seed.iron, seed.energy, market);
      return tx`INSERT INTO citizens (
        id, name, wallet_address, type, balance, personality, goal, occupation,
        food, iron, energy, reputation, coins, net_worth, wallet_index, map_x, map_y,
        last_reasoning, created_at, updated_at
      ) VALUES (
        ${`ai-${index}`}, ${seed.name}, ${account.address.toLowerCase()}, 'AI', ${seed.balance},
        ${seed.personality}, ${seed.goal}, ${seed.occupation}, ${seed.food}, ${seed.iron},
        ${seed.energy}, ${seed.reputation}, ${MDA.welcomeBonus}, ${netWorth}, ${index},
        ${(index % 8) + 1}, ${Math.floor(index / 8) + 1},
        ${`${seed.name} entered MONADIA ready to pursue: ${seed.goal}`}, ${timestamp}, ${timestamp}
      ) ON CONFLICT (wallet_address) DO NOTHING`;
    }),
  );

  await insertEvent({
    id: "system-bootstrap-v1",
    kind: "SYSTEM",
    actorName: "MONADIA",
    actorType: "AI",
    message: "Civilization online. 24 AI agent buildings activated on Monad.",
  });

  const airdrop = await sql<{ key: string }[]>`INSERT INTO meta (key, value)
    VALUES ('mda_airdrop_v1', ${String(timestamp)}) ON CONFLICT (key) DO NOTHING RETURNING key`;
  if (airdrop.length) {
    await sql`UPDATE citizens SET coins = ${MDA.welcomeBonus} WHERE coins = 0`;
    await insertEvent({
      id: "system-mda-launch-v1",
      kind: "SYSTEM",
      actorName: "MONADIA",
      actorType: "AI",
      message: `🪙 ${MDA.name} (${MDA.symbol}) launched — every citizen received ${MDA.welcomeBonus} ${MDA.symbol}`,
    });
  }
  await ensureProposal();
}

export async function ensureSeeded() {
  if (!globalForStore.__monadiaSeedPromise) {
    globalForStore.__monadiaSeedPromise = seedWorld().catch((error) => {
      globalForStore.__monadiaSeedPromise = undefined;
      throw error;
    });
  }
  return globalForStore.__monadiaSeedPromise;
}

export async function getMarket(): Promise<MarketState> {
  await ensureMarketRow();
  const sql = getSql();
  const [row] = await sql<{ food: number | string; iron: number | string; energy: number | string }[]>`SELECT food, iron, energy FROM market WHERE id = 1`;
  const history = await sql<{ ts: number | string; food: number | string; iron: number | string; energy: number | string }[]>`SELECT ts, food, iron, energy FROM price_history ORDER BY ts DESC LIMIT 48`;
  return {
    food: asNumber(row?.food),
    iron: asNumber(row?.iron),
    energy: asNumber(row?.energy),
    history: history.reverse().map((item: { ts: number | string; food: number | string; iron: number | string; energy: number | string }) => ({
      ts: asNumber(item.ts),
      food: asNumber(item.food),
      iron: asNumber(item.iron),
      energy: asNumber(item.energy),
    })),
  };
}

export async function getMetrics(): Promise<Metrics> {
  await ensureMarketRow();
  const sql = getSql();
  const [metrics, population] = await Promise.all([
    sql<{ transactions: number | string; ai_transactions: number | string; human_transactions: number | string; economic_events: number | string; treasury: number | string; coin_treasury: number | string }[]>`SELECT * FROM metrics WHERE id = 1`,
    sql<{ population: number | string; ai: number | string; humans: number | string }[]>`SELECT
      COUNT(*) AS population,
      COUNT(*) FILTER (WHERE type = 'AI') AS ai,
      COUNT(*) FILTER (WHERE type = 'HUMAN') AS humans
      FROM citizens`,
  ]);
  const m = metrics[0];
  const p = population[0];
  return {
    transactions: asNumber(m?.transactions),
    aiTransactions: asNumber(m?.ai_transactions),
    humanTransactions: asNumber(m?.human_transactions),
    economicEvents: asNumber(m?.economic_events),
    population: asNumber(p?.population),
    aiCitizens: asNumber(p?.ai),
    humanCitizens: asNumber(p?.humans),
    treasury: asNumber(m?.treasury),
    coinTreasury: asNumber(m?.coin_treasury),
  };
}

export async function listCitizens(filter: "ALL" | "HUMAN" | "AI" = "ALL"): Promise<Citizen[]> {
  await ensureDatabase();
  const sql = getSql();
  const rows = filter === "ALL"
    ? await sql<CitizenRow[]>`SELECT * FROM citizens ORDER BY net_worth DESC`
    : await sql<CitizenRow[]>`SELECT * FROM citizens WHERE type = ${filter} ORDER BY net_worth DESC`;
  return rows.map(mapCitizen);
}

export async function getCitizen(id: string): Promise<Citizen | null> {
  await ensureDatabase();
  const sql = getSql();
  const [row] = await sql<CitizenRow[]>`SELECT * FROM citizens WHERE id = ${id} LIMIT 1`;
  return row ? mapCitizen(row) : null;
}

export async function getCitizenByWallet(wallet: string): Promise<Citizen | null> {
  await ensureDatabase();
  const sql = getSql();
  const [row] = await sql<CitizenRow[]>`SELECT * FROM citizens WHERE LOWER(wallet_address) = LOWER(${wallet}) LIMIT 1`;
  return row ? mapCitizen(row) : null;
}

export async function getAgentWalletIndex(id: string): Promise<number | null> {
  await ensureDatabase();
  const sql = getSql();
  const [row] = await sql<{ wallet_index: number | string | null }[]>`SELECT wallet_index FROM citizens WHERE id = ${id} LIMIT 1`;
  return row?.wallet_index == null ? null : asNumber(row.wallet_index);
}

export async function listEvents(limit = 40, since?: number): Promise<CivilizationEvent[]> {
  await ensureDatabase();
  const sql = getSql();
  const rows = since
    ? await sql<EventRow[]>`SELECT * FROM events WHERE ts >= ${since} ORDER BY ts DESC LIMIT ${limit}`
    : await sql<EventRow[]>`SELECT * FROM events ORDER BY ts DESC LIMIT ${limit}`;
  return rows.map(mapEvent);
}

export async function hasRecordedTransaction(txHash: string) {
  await ensureDatabase();
  const sql = getSql();
  const rows = await sql<{ id: string }[]>`SELECT id FROM events WHERE tx_hash = ${txHash} LIMIT 1`;
  return rows.length > 0;
}

/**
 * Atomically reserves a verified Monad receipt before the API mutates the
 * Postgres read model. A lease permits recovery if a serverless request dies
 * after verification but before it records the final event.
 */
export async function claimTransaction(txHash: string, leaseMs = 120_000) {
  await ensureDatabase();
  const sql = getSql();
  const claimedAt = now();
  const rows = await sql<{ tx_hash: string }[]>`INSERT INTO processed_transactions (tx_hash, claimed_at)
    SELECT ${txHash}, ${claimedAt}
    WHERE NOT EXISTS (SELECT 1 FROM events WHERE tx_hash = ${txHash})
    ON CONFLICT (tx_hash) DO UPDATE SET claimed_at = EXCLUDED.claimed_at
    WHERE processed_transactions.claimed_at < ${claimedAt - leaseMs}
    RETURNING tx_hash`;
  return rows.length > 0;
}

export async function addEvent(input: {
  kind: string;
  actorName: string;
  actorType: "HUMAN" | "AI";
  message: string;
  txHash?: string | null;
  meta?: Record<string, unknown>;
}) {
  return insertEvent(input);
}

export async function bumpMetrics(opts: {
  isAI?: boolean;
  economic?: boolean;
  treasuryDelta?: number;
  coinTreasuryDelta?: number;
  txs?: number;
}) {
  await ensureMarketRow();
  const sql = getSql();
  const txs = opts.txs ?? 1;
  await sql`UPDATE metrics SET
    transactions = transactions + ${txs},
    ai_transactions = ai_transactions + ${opts.isAI ? txs : 0},
    human_transactions = human_transactions + ${opts.isAI ? 0 : txs},
    economic_events = economic_events + ${opts.economic ? 1 : 0},
    treasury = treasury + ${opts.treasuryDelta ?? 0},
    coin_treasury = coin_treasury + ${opts.coinTreasuryDelta ?? 0}
    WHERE id = 1`;
}

/** Stores public treasury balances read from the live Civilization contract. */
export async function syncOnchainTreasury(treasuryMon: number, tokenTreasuryMda: number) {
  await ensureMarketRow();
  const sql = getSql();
  await sql`UPDATE metrics SET treasury = ${treasuryMon}, coin_treasury = ${tokenTreasuryMda} WHERE id = 1`;
}

export async function updateMarketPrices(food: number, iron: number, energy: number) {
  await ensureMarketRow();
  const sql = getSql();
  const timestamp = now();
  await sql`UPDATE market SET food = ${food}, iron = ${iron}, energy = ${energy}, updated_at = ${timestamp} WHERE id = 1`;
  await sql`INSERT INTO price_history (ts, food, iron, energy) VALUES (${timestamp}, ${food}, ${iron}, ${energy})`;
  await sql`UPDATE citizens SET
    net_worth = balance + food * ${food} + iron * ${iron} + energy * ${energy},
    updated_at = ${timestamp}`;
}

export async function updateCitizenState(
  id: string,
  patch: Partial<{
    balance: number;
    food: number;
    iron: number;
    energy: number;
    reputation: number;
    coins: number;
    lastReasoning: string;
    employerId: string | null;
  }>,
) {
  const [current, market] = await Promise.all([getCitizen(id), getMarket()]);
  if (!current) return;
  const next = {
    balance: patch.balance ?? current.balance,
    food: patch.food ?? current.inventory.food,
    iron: patch.iron ?? current.inventory.iron,
    energy: patch.energy ?? current.inventory.energy,
    reputation: patch.reputation ?? current.reputation,
    coins: patch.coins ?? current.coins,
    lastReasoning: patch.lastReasoning ?? current.lastReasoning,
    employerId: patch.employerId === undefined ? current.employerId : patch.employerId,
  };
  const netWorth = computeNetWorth(next.balance, next.food, next.iron, next.energy, market);
  const sql = getSql();
  await sql`UPDATE citizens SET
    balance = ${next.balance}, food = ${next.food}, iron = ${next.iron}, energy = ${next.energy},
    reputation = ${next.reputation}, coins = ${next.coins}, last_reasoning = ${next.lastReasoning},
    employer_id = ${next.employerId}, net_worth = ${netWorth}, updated_at = ${now()}
    WHERE id = ${id}`;
}

export async function joinHuman(
  walletAddress: string,
  name: string,
  txHash?: string,
  onchain?: {
    nativeMon: number;
    mda: number;
    inventory: { food: number; iron: number; energy: number };
  } | null,
): Promise<Citizen> {
  const existing = await getCitizenByWallet(walletAddress);
  if (existing) return existing;
  const [market, humans] = await Promise.all([getMarket(), listCitizens("HUMAN")]);
  const timestamp = now();
  const id = randomUUID();
  // When a Monad receipt is available, persist the public post-settlement
  // balance and inventory. Demo mode keeps a small offline starting kit.
  const balance = onchain?.nativeMon ?? 20;
  const food = onchain?.inventory.food ?? 2;
  const iron = onchain?.inventory.iron ?? 1;
  const energy = onchain?.inventory.energy ?? 1;
  const coins = onchain?.mda ?? MDA.welcomeBonus;
  const netWorth = computeNetWorth(balance, food, iron, energy, market);
  const sql = getSql();
  await sql`INSERT INTO citizens (
    id, name, wallet_address, type, balance, personality, goal, occupation,
    food, iron, energy, reputation, coins, net_worth, map_x, map_y, last_reasoning, created_at, updated_at
  ) VALUES (
    ${id}, ${name}, ${walletAddress.toLowerCase()}, 'HUMAN', ${balance}, 'Balanced',
    'Build a lasting enterprise', 'Entrepreneur', ${food}, ${iron}, ${energy}, 50, ${coins}, ${netWorth},
    ${4 + (humans.length % 3)}, 5, 'Joined the civilization.', ${timestamp}, ${timestamp}
  ) ON CONFLICT (wallet_address) DO NOTHING`;
  const citizen = await getCitizenByWallet(walletAddress);
  if (!citizen) throw new Error("Could not create citizen");
  if (citizen.id === id) {
    await addEvent({
      kind: "JOIN",
      actorName: name,
      actorType: "HUMAN",
      message: `${name} joined MONADIA and received a ${MDA.welcomeBonus} ${MDA.symbol} welcome bonus`,
      txHash,
    });
    await bumpMetrics({ isAI: false, economic: true });
  }
  return citizen;
}

export async function listBusinesses(): Promise<Business[]> {
  await ensureDatabase();
  const sql = getSql();
  const rows = await sql<{ id: string; on_chain_id: number | string | null; owner_id: string; owner_name: string; name: string; business_type: number | string; employees: number | string; revenue_per_day: number | string; created_at: number | string; active: boolean }[]>`SELECT * FROM businesses ORDER BY created_at ASC`;
  return rows.map((row: { id: string; on_chain_id: number | string | null; owner_id: string; owner_name: string; name: string; business_type: number | string; employees: number | string; revenue_per_day: number | string; created_at: number | string; active: boolean }) => ({
    id: row.id,
    onChainId: row.on_chain_id == null ? null : asNumber(row.on_chain_id),
    ownerId: row.owner_id,
    ownerName: row.owner_name,
    name: row.name,
    businessType: asNumber(row.business_type) as 0 | 1 | 2,
    employees: asNumber(row.employees),
    revenuePerDay: asNumber(row.revenue_per_day),
    createdAt: asNumber(row.created_at),
    active: Boolean(row.active),
  }));
}

export async function createBusinessRecord(input: {
  ownerId: string;
  ownerName: string;
  name: string;
  businessType: 0 | 1 | 2;
  onChainId?: number;
}) {
  await ensureDatabase();
  const sql = getSql();
  const id = randomUUID();
  const revenue = input.businessType === 0 ? 10 : input.businessType === 1 ? 12 : 14;
  await sql`INSERT INTO businesses (id, on_chain_id, owner_id, owner_name, name, business_type, employees, revenue_per_day, created_at, active)
    VALUES (${id}, ${input.onChainId ?? null}, ${input.ownerId}, ${input.ownerName}, ${input.name}, ${input.businessType}, 1, ${revenue}, ${now()}, TRUE)`;
  return id;
}

export async function listProposals(): Promise<Proposal[]> {
  await ensureDatabase();
  const sql = getSql();
  const rows = await sql<{ id: string; on_chain_id: number | string | null; description: string; yes_votes: number | string; no_votes: number | string; deadline: number | string; active: boolean }[]>`SELECT * FROM proposals ORDER BY deadline ASC`;
  return rows.map((row: { id: string; on_chain_id: number | string | null; description: string; yes_votes: number | string; no_votes: number | string; deadline: number | string; active: boolean }) => ({
    id: row.id,
    onChainId: row.on_chain_id == null ? null : asNumber(row.on_chain_id),
    description: row.description,
    yesVotes: asNumber(row.yes_votes),
    noVotes: asNumber(row.no_votes),
    deadline: asNumber(row.deadline),
    active: Boolean(row.active),
  }));
}

export async function castVote(proposalId: string, citizenId: string, support: boolean) {
  await ensureDatabase();
  const sql = getSql();
  const vote = await sql<{ id: string }[]>`INSERT INTO votes (id, proposal_id, citizen_id, support)
    VALUES (${randomUUID()}, ${proposalId}, ${citizenId}, ${support})
    ON CONFLICT (proposal_id, citizen_id) DO NOTHING RETURNING id`;
  if (!vote.length) return false;
  await sql`UPDATE proposals SET
    yes_votes = yes_votes + ${support ? 1 : 0},
    no_votes = no_votes + ${support ? 0 : 1}
    WHERE id = ${proposalId}`;
  return true;
}

export async function tryAcquireJobLease(key: string, durationMs: number) {
  await ensureDatabase();
  const sql = getSql();
  const current = now();
  const rows = await sql<{ key: string }[]>`INSERT INTO job_locks (key, locked_until)
    VALUES (${key}, ${current + durationMs})
    ON CONFLICT (key) DO UPDATE SET locked_until = EXCLUDED.locked_until
    WHERE job_locks.locked_until < ${current}
    RETURNING key`;
  return rows.length > 0;
}

export async function getAwaySummary(since: number) {
  const [events, market] = await Promise.all([listEvents(200, since), getMarket()]);
  const oldest = market.history[0];
  const foodDelta = oldest && oldest.food > 0 ? ((market.food - oldest.food) / oldest.food) * 100 : 0;
  return {
    since,
    minutesAway: Math.max(1, Math.round((Date.now() - since) / 60000)),
    trades: events.filter((event) => event.kind === "BUY" || event.kind === "SELL").length,
    businessesCreated: events.filter((event) => event.kind === "BUSINESS").length,
    votes: events.filter((event) => event.kind === "VOTE").length,
    foodPriceChangePct: Number(foodDelta.toFixed(1)),
    highlights: events.slice(0, 8),
  };
}

export async function getDashboardSnapshot() {
  const [metrics, market, events, citizens, businesses, proposals] = await Promise.all([
    getMetrics(), getMarket(), listEvents(30), listCitizens("ALL"), listBusinesses(), listProposals(),
  ]);
  return { metrics, market, events, citizens, businesses, proposals };
}

export async function updateCitizenPresence(
  walletAddress: string,
  worldX: number,
  worldZ: number,
): Promise<Citizen | null> {
  await ensureDatabase();
  const citizen = await getCitizenByWallet(walletAddress);
  if (!citizen || citizen.type !== "HUMAN") return null;
  const x = Math.max(-54, Math.min(54, worldX));
  const z = Math.max(-54, Math.min(54, worldZ));
  const timestamp = now();
  const sql = getSql();
  await sql`UPDATE citizens SET
    world_x = ${x}, world_z = ${z}, last_seen_at = ${timestamp}, updated_at = ${timestamp}
    WHERE id = ${citizen.id}`;
  return getCitizen(citizen.id);
}

export async function sendSocialMessage(
  fromWallet: string,
  toCitizenId: string,
  body: string,
): Promise<SocialMessage> {
  const [from, to] = await Promise.all([
    getCitizenByWallet(fromWallet),
    getCitizen(toCitizenId),
  ]);
  if (!from || from.type !== "HUMAN") throw new Error("Join as a human citizen first");
  if (!to || to.type !== "HUMAN") throw new Error("You can only message human citizens");
  if (from.id === to.id) throw new Error("Cannot message yourself");
  const text = body.trim();
  if (!text) throw new Error("Message is empty");
  const id = randomUUID();
  const timestamp = now();
  const sql = getSql();
  await sql`INSERT INTO social_messages (id, from_id, to_id, body, created_at)
    VALUES (${id}, ${from.id}, ${to.id}, ${text}, ${timestamp})`;
  await addEvent({
    kind: "MESSAGE",
    actorName: from.name,
    actorType: "HUMAN",
    message: `${from.name} messaged ${to.name}`,
    meta: { toId: to.id, preview: text.slice(0, 80) },
  });
  return {
    id,
    fromId: from.id,
    fromName: from.name,
    toId: to.id,
    toName: to.name,
    body: text,
    createdAt: timestamp,
    readAt: null,
  };
}

export async function listConversation(
  walletAddress: string,
  otherCitizenId: string,
  limit = 40,
): Promise<SocialMessage[]> {
  const me = await getCitizenByWallet(walletAddress);
  if (!me) return [];
  const sql = getSql();
  const rows = await sql<{
    id: string;
    from_id: string;
    to_id: string;
    body: string;
    created_at: number | string;
    read_at: number | string | null;
    from_name: string;
    to_name: string;
  }[]>`
    SELECT m.*, f.name AS from_name, t.name AS to_name
    FROM social_messages m
    JOIN citizens f ON f.id = m.from_id
    JOIN citizens t ON t.id = m.to_id
    WHERE (m.from_id = ${me.id} AND m.to_id = ${otherCitizenId})
       OR (m.from_id = ${otherCitizenId} AND m.to_id = ${me.id})
    ORDER BY m.created_at DESC
    LIMIT ${limit}`;
  // Mark inbound as read
  await sql`UPDATE social_messages SET read_at = ${now()}
    WHERE to_id = ${me.id} AND from_id = ${otherCitizenId} AND read_at IS NULL`;
  return rows
    .map((row) => ({
      id: row.id,
      fromId: row.from_id,
      fromName: row.from_name,
      toId: row.to_id,
      toName: row.to_name,
      body: row.body,
      createdAt: asNumber(row.created_at),
      readAt: row.read_at == null ? null : asNumber(row.read_at),
    }))
    .reverse();
}

export async function listInbox(walletAddress: string, limit = 30): Promise<SocialMessage[]> {
  const me = await getCitizenByWallet(walletAddress);
  if (!me) return [];
  const sql = getSql();
  const rows = await sql<{
    id: string;
    from_id: string;
    to_id: string;
    body: string;
    created_at: number | string;
    read_at: number | string | null;
    from_name: string;
    to_name: string;
  }[]>`
    SELECT m.*, f.name AS from_name, t.name AS to_name
    FROM social_messages m
    JOIN citizens f ON f.id = m.from_id
    JOIN citizens t ON t.id = m.to_id
    WHERE m.to_id = ${me.id} OR m.from_id = ${me.id}
    ORDER BY m.created_at DESC
    LIMIT ${limit}`;
  return rows.map((row) => ({
    id: row.id,
    fromId: row.from_id,
    fromName: row.from_name,
    toId: row.to_id,
    toName: row.to_name,
    body: row.body,
    createdAt: asNumber(row.created_at),
    readAt: row.read_at == null ? null : asNumber(row.read_at),
  }));
}

export async function transferWorldMon(
  fromWallet: string,
  toCitizenId: string,
  amount: number,
  note?: string,
): Promise<{ from: Citizen; to: Citizen }> {
  if (!Number.isFinite(amount) || amount <= 0) throw new Error("Amount must be positive");
  if (amount > 1_000_000) throw new Error("Amount too large");
  const [from, to] = await Promise.all([
    getCitizenByWallet(fromWallet),
    getCitizen(toCitizenId),
  ]);
  if (!from || from.type !== "HUMAN") throw new Error("Join as a human citizen first");
  if (!to || to.type !== "HUMAN") throw new Error("You can only send world MON to humans");
  if (from.id === to.id) throw new Error("Cannot send to yourself");
  if (from.balance < amount) throw new Error("Insufficient world MON balance");

  const rounded = Math.round(amount * 1000) / 1000;
  await updateCitizenState(from.id, { balance: from.balance - rounded });
  await updateCitizenState(to.id, { balance: to.balance + rounded });
  const label = note?.trim() ? ` — “${note.trim().slice(0, 60)}”` : "";
  await addEvent({
    kind: "TRANSFER",
    actorName: from.name,
    actorType: "HUMAN",
    message: `${from.name} sent ${rounded.toFixed(3)} MON to ${to.name}${label}`,
    meta: { toId: to.id, amount: rounded },
  });
  const [nextFrom, nextTo] = await Promise.all([getCitizen(from.id), getCitizen(to.id)]);
  if (!nextFrom || !nextTo) throw new Error("Transfer recorded but citizens could not be reloaded");
  return { from: nextFrom, to: nextTo };
}

export async function createMoneyRequest(
  fromWallet: string,
  toCitizenId: string,
  amount: number,
  note = "",
): Promise<MoneyRequest> {
  if (!Number.isFinite(amount) || amount <= 0) throw new Error("Amount must be positive");
  const [from, to] = await Promise.all([
    getCitizenByWallet(fromWallet),
    getCitizen(toCitizenId),
  ]);
  if (!from || from.type !== "HUMAN") throw new Error("Join as a human citizen first");
  if (!to || to.type !== "HUMAN") throw new Error("You can only request from humans");
  if (from.id === to.id) throw new Error("Cannot request from yourself");
  const rounded = Math.round(amount * 1000) / 1000;
  const id = randomUUID();
  const timestamp = now();
  const sql = getSql();
  await sql`INSERT INTO money_requests (id, from_id, to_id, amount, note, status, created_at)
    VALUES (${id}, ${from.id}, ${to.id}, ${rounded}, ${note.trim().slice(0, 120)}, 'pending', ${timestamp})`;
  await addEvent({
    kind: "MONEY_REQUEST",
    actorName: from.name,
    actorType: "HUMAN",
    message: `${from.name} requested ${rounded.toFixed(3)} MON from ${to.name}`,
    meta: { toId: to.id, amount: rounded, requestId: id },
  });
  return {
    id,
    fromId: from.id,
    fromName: from.name,
    toId: to.id,
    toName: to.name,
    amount: rounded,
    note: note.trim().slice(0, 120),
    status: "pending",
    createdAt: timestamp,
    resolvedAt: null,
  };
}

export async function listMoneyRequests(walletAddress: string): Promise<MoneyRequest[]> {
  const me = await getCitizenByWallet(walletAddress);
  if (!me) return [];
  const sql = getSql();
  const rows = await sql<{
    id: string;
    from_id: string;
    to_id: string;
    amount: number | string;
    note: string;
    status: MoneyRequest["status"];
    created_at: number | string;
    resolved_at: number | string | null;
    from_name: string;
    to_name: string;
  }[]>`
    SELECT r.*, f.name AS from_name, t.name AS to_name
    FROM money_requests r
    JOIN citizens f ON f.id = r.from_id
    JOIN citizens t ON t.id = r.to_id
    WHERE r.from_id = ${me.id} OR r.to_id = ${me.id}
    ORDER BY r.created_at DESC
    LIMIT 40`;
  return rows.map((row) => ({
    id: row.id,
    fromId: row.from_id,
    fromName: row.from_name,
    toId: row.to_id,
    toName: row.to_name,
    amount: asNumber(row.amount),
    note: row.note || "",
    status: row.status,
    createdAt: asNumber(row.created_at),
    resolvedAt: row.resolved_at == null ? null : asNumber(row.resolved_at),
  }));
}

export async function resolveMoneyRequest(
  walletAddress: string,
  requestId: string,
  action: "pay" | "decline" | "cancel",
): Promise<MoneyRequest> {
  const me = await getCitizenByWallet(walletAddress);
  if (!me) throw new Error("Join as a human citizen first");
  const sql = getSql();
  const [row] = await sql<{
    id: string;
    from_id: string;
    to_id: string;
    amount: number | string;
    note: string;
    status: MoneyRequest["status"];
    created_at: number | string;
    resolved_at: number | string | null;
  }[]>`SELECT * FROM money_requests WHERE id = ${requestId} LIMIT 1`;
  if (!row) throw new Error("Request not found");
  if (row.status !== "pending") throw new Error("Request is already resolved");

  const timestamp = now();
  if (action === "cancel") {
    if (row.from_id !== me.id) throw new Error("Only the requester can cancel");
    await sql`UPDATE money_requests SET status = 'cancelled', resolved_at = ${timestamp} WHERE id = ${requestId}`;
  } else if (action === "decline") {
    if (row.to_id !== me.id) throw new Error("Only the recipient can decline");
    await sql`UPDATE money_requests SET status = 'declined', resolved_at = ${timestamp} WHERE id = ${requestId}`;
  } else {
    if (row.to_id !== me.id) throw new Error("Only the recipient can pay");
    const payer = await getCitizen(me.id);
    const amount = asNumber(row.amount);
    if (!payer || payer.balance < amount) throw new Error("Insufficient world MON balance");
    const payee = await getCitizen(row.from_id);
    if (!payee) throw new Error("Requester no longer exists");
    await updateCitizenState(payer.id, { balance: payer.balance - amount });
    await updateCitizenState(payee.id, { balance: payee.balance + amount });
    await sql`UPDATE money_requests SET status = 'paid', resolved_at = ${timestamp} WHERE id = ${requestId}`;
    await addEvent({
      kind: "TRANSFER",
      actorName: payer.name,
      actorType: "HUMAN",
      message: `${payer.name} paid ${amount.toFixed(3)} MON to ${payee.name} (request)`,
      meta: { toId: payee.id, amount, requestId },
    });
  }

  const [from, to] = await Promise.all([getCitizen(row.from_id), getCitizen(row.to_id)]);
  return {
    id: row.id,
    fromId: row.from_id,
    fromName: from?.name || "Citizen",
    toId: row.to_id,
    toName: to?.name || "Citizen",
    amount: asNumber(row.amount),
    note: row.note || "",
    status: action === "pay" ? "paid" : action === "decline" ? "declined" : "cancelled",
    createdAt: asNumber(row.created_at),
    resolvedAt: timestamp,
  };
}
