import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { ensureSeeded, updateCitizenPresence } from "@/lib/civilization/store";
import { startSimulationLoop } from "@/lib/sim/loop";

export const dynamic = "force-dynamic";

const bodySchema = z.object({
  walletAddress: z.string().regex(/^0x[a-fA-F0-9]{40}$/),
  x: z.number().finite(),
  z: z.number().finite(),
});

/** Heartbeat while a human is in the 3D world — freezes others at last live spot when offline. */
export async function POST(req: NextRequest) {
  await startSimulationLoop();
  await ensureSeeded();
  const parsed = bodySchema.safeParse(await req.json());
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid body" }, { status: 400 });
  }
  const citizen = await updateCitizenPresence(
    parsed.data.walletAddress,
    parsed.data.x,
    parsed.data.z,
  );
  if (!citizen) {
    return NextResponse.json({ error: "Human citizen not found for this wallet" }, { status: 404 });
  }
  return NextResponse.json({
    ok: true,
    citizen: {
      id: citizen.id,
      worldX: citizen.worldX,
      worldZ: citizen.worldZ,
      lastSeenAt: citizen.lastSeenAt,
      online: citizen.online,
    },
  });
}
