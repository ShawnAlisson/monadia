import { NextRequest, NextResponse } from "next/server";
import { ensureSeeded, tryAcquireJobLease } from "@/lib/civilization/store";
import { runProductionTick, runSimulationTick } from "@/lib/sim/engine";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

/**
 * Serverless-safe simulation entry point. GitHub Actions, Vercel Cron (on a
 * plan that supports the desired frequency), or another scheduler can call it.
 */
export async function GET(req: NextRequest) {
  const secret = process.env.CRON_SECRET;
  if (!secret || req.headers.get("authorization") !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  await ensureSeeded();
  const lease = await tryAcquireJobLease("simulation-tick", 55_000);
  if (!lease) return NextResponse.json({ ok: true, skipped: "another tick is active" });

  // Keep on-chain agent settlement conservative: each agent transaction costs MON.
  const maxAgents = process.env.ENABLE_ONCHAIN_AI === "true" ? 1 : 3;
  await runSimulationTick(maxAgents);
  await runProductionTick();

  return NextResponse.json({ ok: true, maxAgents });
}
