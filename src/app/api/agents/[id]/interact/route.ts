import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { ensureSeeded, getCitizen, listCitizens } from "@/lib/civilization/store";
import { getAgentSkill, getAgentSkills } from "@/lib/agents/skills";
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

export async function GET(_: Request, ctx: { params: Promise<{ id: string }> }) {
  await startSimulationLoop();
  await ensureSeeded();
  const { id } = await ctx.params;
  const citizen = await getCitizen(id);
  if (!citizen || citizen.type !== "AI") {
    return NextResponse.json({ error: "AI agent not found" }, { status: 404 });
  }
  return NextResponse.json({
    agent: {
      id: citizen.id,
      name: citizen.name,
      occupation: citizen.occupation,
      personality: citizen.personality,
      goal: citizen.goal,
    },
    skills: getAgentSkills(citizen.occupation),
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

  const skill = getAgentSkill(citizen.occupation, parsed.data.skillId);
  if (!skill) {
    return NextResponse.json({ error: "Unknown skill for this agent" }, { status: 400 });
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
  });
}
