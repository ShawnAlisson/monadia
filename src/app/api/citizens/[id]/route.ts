import { NextResponse } from "next/server";
import { ensureSeeded, getCitizen, listEvents } from "@/lib/civilization/store";
import { startSimulationLoop } from "@/lib/sim/loop";

export const dynamic = "force-dynamic";

export async function GET(_: Request, ctx: { params: Promise<{ id: string }> }) {
  await startSimulationLoop();
  await ensureSeeded();
  const { id } = await ctx.params;
  const citizen = await getCitizen(id);
  if (!citizen) return NextResponse.json({ error: "Not found" }, { status: 404 });
  const events = (await listEvents(100)).filter((e) => e.actorName === citizen.name);
  return NextResponse.json({ citizen, events });
}
