import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import {
  chargeAgentSkillUse,
  ensureSeeded,
  getCitizen,
  listAgentCustomSkills,
  listCitizens,
} from "@/lib/civilization/store";
import { getAgentSkill, getAgentSkills, type AgentSkill } from "@/lib/agents/skills";
import { openaiConfigured, runAgentSkill } from "@/lib/agents/llm";
import { startSimulationLoop } from "@/lib/sim/loop";

export const dynamic = "force-dynamic";

const bodySchema = z.object({
  skillId: z.string().min(1).max(64),
  message: z.string().min(1).max(500),
  walletAddress: z
    .string()
    .regex(/^0x[a-fA-F0-9]{40}$/)
    .optional(),
});

async function resolveSkills(agentId: string, occupation: Parameters<typeof getAgentSkills>[0]) {
  const custom = await listAgentCustomSkills(agentId);
  if (custom.length) {
    return custom.map(
      (s): AgentSkill => ({
        id: s.skillKey,
        name: s.name,
        description: s.description,
        promptHint: s.promptHint,
      }),
    );
  }
  return getAgentSkills(occupation);
}

export async function GET(_: Request, ctx: { params: Promise<{ id: string }> }) {
  await startSimulationLoop();
  await ensureSeeded();
  const { id } = await ctx.params;
  const citizen = await getCitizen(id);
  if (!citizen || citizen.type !== "AI") {
    return NextResponse.json({ error: "AI agent not found" }, { status: 404 });
  }
  const skills = await resolveSkills(citizen.id, citizen.occupation);
  return NextResponse.json({
    agent: {
      id: citizen.id,
      name: citizen.name,
      occupation: citizen.occupation,
      personality: citizen.personality,
      goal: citizen.goal,
      creatorId: citizen.creatorId,
      creatorName: citizen.creatorName,
      skillPrice: citizen.skillPrice,
      skillEarnings: citizen.skillEarnings,
      skillUses: citizen.skillUses,
      playerOwned: Boolean(citizen.creatorId),
    },
    skills,
    llm: openaiConfigured() ? "openai" : "local-fallback",
  });
}

export async function POST(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  await startSimulationLoop();
  await ensureSeeded();
  const { id } = await ctx.params;
  const citizen = await getCitizen(id);
  if (!citizen || citizen.type !== "AI") {
    return NextResponse.json({ error: "AI agent not found" }, { status: 404 });
  }

  const parsed = bodySchema.safeParse(await req.json());
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid body" }, { status: 400 });
  }

  const skills = await resolveSkills(citizen.id, citizen.occupation);
  const skill =
    skills.find((s) => s.id === parsed.data.skillId) ||
    getAgentSkill(citizen.occupation, parsed.data.skillId);
  if (!skill) {
    return NextResponse.json({ error: "Unknown skill for this agent" }, { status: 400 });
  }

  let payment: Awaited<ReturnType<typeof chargeAgentSkillUse>>;
  try {
    payment = await chargeAgentSkillUse({
      agentId: citizen.id,
      payerWallet: parsed.data.walletAddress,
    });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Could not charge for skill" },
      { status: 402 },
    );
  }

  let requesterName: string | undefined;
  if (parsed.data.walletAddress) {
    const humans = await listCitizens("HUMAN");
    requesterName = humans.find(
      (h) => h.walletAddress.toLowerCase() === parsed.data.walletAddress!.toLowerCase(),
    )?.name;
  }

  const reply = await runAgentSkill({
    agent: citizen,
    skill,
    message: parsed.data.message,
    requesterName,
  });

  return NextResponse.json({
    reply,
    skill,
    llm: openaiConfigured() ? "openai" : "local-fallback",
    agentId: citizen.id,
    agentName: citizen.name,
    payment,
  });
}
