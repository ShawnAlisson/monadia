import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import {
  ensureSeeded,
  listConversation,
  listInbox,
  sendSocialMessage,
} from "@/lib/civilization/store";
import { startSimulationLoop } from "@/lib/sim/loop";

export const dynamic = "force-dynamic";

const postSchema = z.object({
  walletAddress: z.string().regex(/^0x[a-fA-F0-9]{40}$/),
  toCitizenId: z.string().min(1),
  body: z.string().min(1).max(400),
});

export async function GET(req: NextRequest) {
  await startSimulationLoop();
  await ensureSeeded();
  const wallet = req.nextUrl.searchParams.get("wallet");
  const withId = req.nextUrl.searchParams.get("with");
  if (!wallet || !/^0x[a-fA-F0-9]{40}$/.test(wallet)) {
    return NextResponse.json({ error: "wallet query required" }, { status: 400 });
  }
  if (withId) {
    return NextResponse.json({
      messages: await listConversation(wallet, withId),
    });
  }
  return NextResponse.json({ messages: await listInbox(wallet) });
}

export async function POST(req: NextRequest) {
  await startSimulationLoop();
  await ensureSeeded();
  const parsed = postSchema.safeParse(await req.json());
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid body" }, { status: 400 });
  }
  try {
    const message = await sendSocialMessage(
      parsed.data.walletAddress,
      parsed.data.toCitizenId,
      parsed.data.body,
    );
    return NextResponse.json({ message });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Could not send message" },
      { status: 400 },
    );
  }
}
