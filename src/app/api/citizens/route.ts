import { NextRequest, NextResponse } from "next/server";
import { ensureSeeded, listCitizens } from "@/lib/civilization/store";
import { startSimulationLoop } from "@/lib/sim/loop";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  await startSimulationLoop();
  await ensureSeeded();
  const filter = (req.nextUrl.searchParams.get("filter") || "ALL") as "ALL" | "HUMAN" | "AI";
  return NextResponse.json({ citizens: await listCitizens(filter) });
}
