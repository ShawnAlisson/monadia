import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import {
  createMoneyRequest,
  ensureSeeded,
  listMoneyRequests,
  resolveMoneyRequest,
} from "@/lib/civilization/store";
import { startSimulationLoop } from "@/lib/sim/loop";

export const dynamic = "force-dynamic";

const createSchema = z.object({
  walletAddress: z.string().regex(/^0x[a-fA-F0-9]{40}$/),
  toCitizenId: z.string().min(1),
  amount: z.number().positive().max(1_000_000),
  note: z.string().max(120).optional(),
});

const resolveSchema = z.object({
  walletAddress: z.string().regex(/^0x[a-fA-F0-9]{40}$/),
  requestId: z.string().min(1),
  action: z.enum(["pay", "decline", "cancel"]),
});

export async function GET(req: NextRequest) {
  await startSimulationLoop();
  await ensureSeeded();
  const wallet = req.nextUrl.searchParams.get("wallet");
  if (!wallet || !/^0x[a-fA-F0-9]{40}$/.test(wallet)) {
    return NextResponse.json({ error: "wallet query required" }, { status: 400 });
  }
  return NextResponse.json({ requests: await listMoneyRequests(wallet) });
}

export async function POST(req: NextRequest) {
  await startSimulationLoop();
  await ensureSeeded();
  const json = await req.json();
  const create = createSchema.safeParse(json);
  if (create.success) {
    try {
      const request = await createMoneyRequest(
        create.data.walletAddress,
        create.data.toCitizenId,
        create.data.amount,
        create.data.note || "",
      );
      return NextResponse.json({ request });
    } catch (error) {
      return NextResponse.json(
        { error: error instanceof Error ? error.message : "Could not create request" },
        { status: 400 },
      );
    }
  }

  const resolve = resolveSchema.safeParse(json);
  if (resolve.success) {
    try {
      const request = await resolveMoneyRequest(
        resolve.data.walletAddress,
        resolve.data.requestId,
        resolve.data.action,
      );
      return NextResponse.json({ request });
    } catch (error) {
      return NextResponse.json(
        { error: error instanceof Error ? error.message : "Could not resolve request" },
        { status: 400 },
      );
    }
  }

  return NextResponse.json({ error: "Invalid body" }, { status: 400 });
}
