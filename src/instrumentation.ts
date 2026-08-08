export async function register() {
  // Do not touch Postgres while a serverless instance boots. A missing or
  // rotating DATABASE_URL must leave /api/health available to report the
  // configuration problem. The first stateful API request starts the local
  // development loop; Vercel uses the protected cron route instead.
}
