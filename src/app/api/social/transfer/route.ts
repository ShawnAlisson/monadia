import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { ensureSeeded, transferWorldMon } from "@/lib/civilization/store";
import { startSimulationLoop } from "@/lib/sim/loop";

export const dynamic = "force-dynamic";

const bodySchema = z.object({
  walletAddress: z.string().regex(/^0x[a-fA-F0-9]{40}$/),
  toCitizenId: z.string().min(1),
  amount: z.number().positive().max(1_000_000),
  note: z.string().max(120).optional(),
});

/** Peer-to-peer world MON transfer (civilization read-model balance). */
export async function POST(req: NextRequest) {
  await startSimulationLoop();
  await ensureSeeded();
  const parsed = bodySchema.safeParse(await req.json());
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid body" }, { status: 400 });
  }
  try {
    const result = await transferWorldMon(
      parsed.data.walletAddress,
      parsed.data.toCitizenId,
      parsed.data.amount,
      parsed.data.note,
    );
    return NextResponse.json(result);
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Transfer failed" },
      { status: 400 },
    );
  }
}
