import { NextRequest, NextResponse } from "next/server";
import { ensureSeeded, listEvents } from "@/lib/civilization/store";
import { startSimulationLoop } from "@/lib/sim/loop";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  await startSimulationLoop();
  await ensureSeeded();
  const since = req.nextUrl.searchParams.get("since");
  const limit = Number(req.nextUrl.searchParams.get("limit") || 40);
  const events = await listEvents(limit, since ? Number(since) : undefined);
  return NextResponse.json({ events });
}
