import { NextRequest, NextResponse } from "next/server";
import { ensureSeeded, getAwaySummary } from "@/lib/civilization/store";
import { startSimulationLoop } from "@/lib/sim/loop";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  await startSimulationLoop();
  await ensureSeeded();
  const since = Number(req.nextUrl.searchParams.get("since") || Date.now() - 8 * 60 * 1000);
  return NextResponse.json(await getAwaySummary(since));
}
