import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { AGENT_DEPLOY } from "@/lib/agents/economy";
import {
  createCustomAgent,
  ensureSeeded,
  listOwnedAgents,
} from "@/lib/civilization/store";
import { startSimulationLoop } from "@/lib/sim/loop";

export const dynamic = "force-dynamic";

const occupations = [
  "Merchant",
  "Industrialist",
  "Revolutionary",
  "Conservative",
  "Speculator",
  "Farmer",
  "Engineer",
  "Trader",
  "Entrepreneur",
  "Poet",
  "Psychologist",
  "Doctor",
  "Librarian",
  "Banker",
  "Architect",
  "Journalist",
  "Chef",
] as const;

const personalities = [
  "Aggressive",
  "Industrial",
  "Revolutionary",
  "Conservative",
  "Speculative",
  "Balanced",
] as const;

const createSchema = z.object({
  walletAddress: z.string().regex(/^0x[a-fA-F0-9]{40}$/),
  name: z.string().min(3).max(40),
  goal: z.string().min(8).max(160),
  occupation: z.enum(occupations),
  personality: z.enum(personalities),
  skillPrice: z.number().min(AGENT_DEPLOY.minSkillPrice).max(AGENT_DEPLOY.maxSkillPrice).optional(),
  skills: z
    .array(
      z.object({
        name: z.string().min(2).max(40),
        description: z.string().min(8).max(160),
        promptHint: z.string().min(8).max(220),
      }),
    )
    .min(1)
    .max(AGENT_DEPLOY.maxSkills),
});

export async function GET(req: NextRequest) {
  await startSimulationLoop();
  await ensureSeeded();
  const wallet = req.nextUrl.searchParams.get("wallet");
  if (!wallet || !/^0x[a-fA-F0-9]{40}$/.test(wallet)) {
    return NextResponse.json({ error: "wallet query required" }, { status: 400 });
  }
  const agents = await listOwnedAgents(wallet);
  return NextResponse.json({
    agents,
    limits: AGENT_DEPLOY,
  });
}

export async function POST(req: NextRequest) {
  await startSimulationLoop();
  await ensureSeeded();
  const parsed = createSchema.safeParse(await req.json());
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid body", details: parsed.error.flatten() }, { status: 400 });
  }
  try {
    const agent = await createCustomAgent(parsed.data);
    return NextResponse.json({ agent, limits: AGENT_DEPLOY });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Could not deploy agent" },
      { status: 400 },
    );
  }
}
