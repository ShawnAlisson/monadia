import { NextResponse } from "next/server";
import { publicDatabaseError } from "@/lib/db";
import { ensureSeeded, getDashboardSnapshot } from "@/lib/civilization/store";
import { startSimulationLoop } from "@/lib/sim/loop";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    await startSimulationLoop();
    await ensureSeeded();
    const snapshot = await getDashboardSnapshot();
    return NextResponse.json(snapshot);
  } catch (error) {
    return NextResponse.json({ error: publicDatabaseError(error) }, { status: 503 });
  }
}
