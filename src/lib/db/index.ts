import { neon, type NeonQueryFunction } from "@neondatabase/serverless";

type DatabaseGlobals = typeof globalThis & {
  __monadiaSql?: NeonQueryFunction<false, false>;
  __monadiaSchemaPromise?: Promise<void>;
};

const globals = globalThis as DatabaseGlobals;

function databaseUrl() {
  const url = process.env.DATABASE_URL;
  if (!url) {
    throw new Error(
      "DATABASE_URL is required. Add a Neon Postgres connection string before running MONADIA.",
    );
  }
  return url;
}

/** A safe diagnostic for browser-facing routes; never expose a connection URL. */
export function publicDatabaseError(error: unknown) {
  const message = error instanceof Error ? error.message : "";
  if (message.includes("DATABASE_URL is required")) return message;
  return "Database connection unavailable. Check the server-side DATABASE_URL configuration.";
}

// Neon returns untyped record objects for raw SQL. The store maps every row at
// its boundary, keeping database details out of application code.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function getSql(): any {
  if (!globals.__monadiaSql) globals.__monadiaSql = neon(databaseUrl());
  return globals.__monadiaSql;
}

/**
 * Idempotent schema bootstrap for serverless functions. Neon is reached over
 * HTTP, so no process-local SQLite file or long-lived TCP connection is used.
 */
export async function ensureDatabase() {
  if (!globals.__monadiaSchemaPromise) {
    globals.__monadiaSchemaPromise = (async () => {
      const sql = getSql();
      await sql`CREATE TABLE IF NOT EXISTS citizens (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        wallet_address TEXT NOT NULL UNIQUE,
        type TEXT NOT NULL CHECK (type IN ('HUMAN', 'AI')),
        balance DOUBLE PRECISION NOT NULL DEFAULT 0,
        personality TEXT NOT NULL,
        goal TEXT NOT NULL,
        occupation TEXT NOT NULL,
        food INTEGER NOT NULL DEFAULT 0,
        iron INTEGER NOT NULL DEFAULT 0,
        energy INTEGER NOT NULL DEFAULT 0,
        reputation INTEGER NOT NULL DEFAULT 50,
        coins DOUBLE PRECISION NOT NULL DEFAULT 0,
        net_worth DOUBLE PRECISION NOT NULL DEFAULT 0,
        employer_id TEXT,
        wallet_index INTEGER,
        map_x INTEGER NOT NULL DEFAULT 0,
        map_y INTEGER NOT NULL DEFAULT 0,
        last_reasoning TEXT,
        created_at BIGINT NOT NULL,
        updated_at BIGINT NOT NULL
      )`;
      await sql`CREATE TABLE IF NOT EXISTS events (
        id TEXT PRIMARY KEY,
        ts BIGINT NOT NULL,
        kind TEXT NOT NULL,
        actor_name TEXT NOT NULL,
        actor_type TEXT NOT NULL CHECK (actor_type IN ('HUMAN', 'AI')),
        message TEXT NOT NULL,
        tx_hash TEXT,
        meta_json JSONB
      )`;
      await sql`CREATE INDEX IF NOT EXISTS events_ts_idx ON events (ts DESC)`;
      await sql`CREATE UNIQUE INDEX IF NOT EXISTS events_tx_hash_unique ON events (tx_hash) WHERE tx_hash IS NOT NULL`;
      await sql`CREATE TABLE IF NOT EXISTS businesses (
        id TEXT PRIMARY KEY,
        on_chain_id BIGINT,
        owner_id TEXT NOT NULL,
        owner_name TEXT NOT NULL,
        name TEXT NOT NULL,
        business_type INTEGER NOT NULL CHECK (business_type BETWEEN 0 AND 2),
        employees INTEGER NOT NULL DEFAULT 0,
        revenue_per_day DOUBLE PRECISION NOT NULL DEFAULT 0,
        created_at BIGINT NOT NULL,
        active BOOLEAN NOT NULL DEFAULT TRUE
      )`;
      await sql`CREATE TABLE IF NOT EXISTS proposals (
        id TEXT PRIMARY KEY,
        on_chain_id BIGINT,
        description TEXT NOT NULL,
        yes_votes INTEGER NOT NULL DEFAULT 0,
        no_votes INTEGER NOT NULL DEFAULT 0,
        deadline BIGINT NOT NULL,
        active BOOLEAN NOT NULL DEFAULT TRUE
      )`;
      await sql`CREATE TABLE IF NOT EXISTS votes (
        id TEXT PRIMARY KEY,
        proposal_id TEXT NOT NULL,
        citizen_id TEXT NOT NULL,
        support BOOLEAN NOT NULL,
        UNIQUE (proposal_id, citizen_id)
      )`;
      await sql`CREATE TABLE IF NOT EXISTS market (
        id INTEGER PRIMARY KEY,
        food DOUBLE PRECISION NOT NULL,
        iron DOUBLE PRECISION NOT NULL,
        energy DOUBLE PRECISION NOT NULL,
        updated_at BIGINT NOT NULL
      )`;
      await sql`CREATE TABLE IF NOT EXISTS price_history (
        id BIGSERIAL PRIMARY KEY,
        ts BIGINT NOT NULL,
        food DOUBLE PRECISION NOT NULL,
        iron DOUBLE PRECISION NOT NULL,
        energy DOUBLE PRECISION NOT NULL
      )`;
      await sql`CREATE TABLE IF NOT EXISTS metrics (
        id INTEGER PRIMARY KEY,
        transactions INTEGER NOT NULL DEFAULT 0,
        ai_transactions INTEGER NOT NULL DEFAULT 0,
        human_transactions INTEGER NOT NULL DEFAULT 0,
        economic_events INTEGER NOT NULL DEFAULT 0,
        treasury DOUBLE PRECISION NOT NULL DEFAULT 0,
        coin_treasury DOUBLE PRECISION NOT NULL DEFAULT 0
      )`;
      await sql`CREATE TABLE IF NOT EXISTS meta (
        key TEXT PRIMARY KEY,
        value TEXT NOT NULL
      )`;
      await sql`CREATE TABLE IF NOT EXISTS job_locks (
        key TEXT PRIMARY KEY,
        locked_until BIGINT NOT NULL
      )`;
      // Receipt verification proves an activity occurred on Monad. This lock
      // makes recording that receipt idempotent across concurrent serverless
      // requests before mutable read-model state is updated.
      await sql`CREATE TABLE IF NOT EXISTS processed_transactions (
        tx_hash TEXT PRIMARY KEY,
        claimed_at BIGINT NOT NULL
      )`;
      // Presence + social layer (safe to re-run on warm serverless instances).
      await sql`ALTER TABLE citizens ADD COLUMN IF NOT EXISTS world_x DOUBLE PRECISION`;
      await sql`ALTER TABLE citizens ADD COLUMN IF NOT EXISTS world_z DOUBLE PRECISION`;
      await sql`ALTER TABLE citizens ADD COLUMN IF NOT EXISTS last_seen_at BIGINT`;
      await sql`CREATE TABLE IF NOT EXISTS social_messages (
        id TEXT PRIMARY KEY,
        from_id TEXT NOT NULL,
        to_id TEXT NOT NULL,
        body TEXT NOT NULL,
        created_at BIGINT NOT NULL,
        read_at BIGINT
      )`;
      await sql`CREATE INDEX IF NOT EXISTS social_messages_to_created_idx ON social_messages (to_id, created_at DESC)`;
      await sql`CREATE INDEX IF NOT EXISTS social_messages_pair_idx ON social_messages (from_id, to_id, created_at DESC)`;
      await sql`CREATE TABLE IF NOT EXISTS money_requests (
        id TEXT PRIMARY KEY,
        from_id TEXT NOT NULL,
        to_id TEXT NOT NULL,
        amount DOUBLE PRECISION NOT NULL,
        note TEXT NOT NULL DEFAULT '',
        status TEXT NOT NULL CHECK (status IN ('pending', 'paid', 'declined', 'cancelled')),
        created_at BIGINT NOT NULL,
        resolved_at BIGINT
      )`;
      await sql`CREATE INDEX IF NOT EXISTS money_requests_to_status_idx ON money_requests (to_id, status, created_at DESC)`;
    })().catch((error) => {
      // A transient Neon/network failure must not poison a warm Vercel
      // function forever; the next request can safely retry initialization.
      globals.__monadiaSchemaPromise = undefined;
      throw error;
    });
  }
  return globals.__monadiaSchemaPromise;
}
