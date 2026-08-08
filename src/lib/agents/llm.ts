import type { Citizen } from "@/lib/types";
import type { AgentSkill } from "@/lib/agents/skills";

const DEFAULT_MODEL = "gpt-5.4-nano";

export function openaiConfigured() {
  return Boolean(process.env.OPENAI_API_KEY);
}

export async function runAgentSkill(params: {
  agent: Citizen;
  skill: AgentSkill;
  message: string;
  requesterName?: string;
}): Promise<string> {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    return fallbackReply(params.agent, params.skill, params.message);
  }

  const model = process.env.OPENAI_MODEL || DEFAULT_MODEL;
  const system = [
    `You are ${params.agent.name}, an AI citizen-building in MONADIA on Monad.`,
    `Occupation: ${params.agent.occupation}. Personality: ${params.agent.personality}.`,
    `Goal: ${params.agent.goal}.`,
    `Inventory: Food ${params.agent.inventory.food}, Iron ${params.agent.inventory.iron}, Energy ${params.agent.inventory.energy}.`,
    `Balance: ${params.agent.balance.toFixed(2)} MON · Reputation ${params.agent.reputation} · MDA ${params.agent.coins.toFixed(1)}.`,
    `Active skill: ${params.skill.name} — ${params.skill.promptHint}`,
    "Stay in character. Be concrete, useful, and brief (2-5 sentences). No markdown headings.",
  ].join("\n");

  const user = params.requesterName
    ? `Citizen ${params.requesterName} asks: ${params.message}`
    : params.message;

  const res = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model,
      temperature: 0.7,
      max_completion_tokens: 220,
      messages: [
        { role: "system", content: system },
        { role: "user", content: user },
      ],
    }),
  });

  if (!res.ok) {
    const errText = await res.text().catch(() => "");
    console.warn("[monadia] OpenAI agent call failed", res.status, errText.slice(0, 240));
    return fallbackReply(params.agent, params.skill, params.message);
  }

  const json = (await res.json()) as {
    choices?: Array<{ message?: { content?: string } }>;
  };
  const text = json.choices?.[0]?.message?.content?.trim();
  return text || fallbackReply(params.agent, params.skill, params.message);
}

function fallbackReply(agent: Citizen, skill: AgentSkill, message: string) {
  const snippets: Record<string, string> = {
    "price-brief": `${agent.name}: Food feels ${agent.inventory.food > 8 ? "heavy" : "scarce"} on my books. ${message.slice(0, 40) ? "On your ask — " : ""}I'd bias toward ${agent.inventory.food > agent.inventory.iron ? "selling Food" : "accumulating Food"} this cycle.`,
    "trade-route": `${agent.name}: Loop idea — buy the thin resource, warehouse overnight, sell into the next spike. Start with 2 units and keep 20% MON dry powder.`,
    "output-plan": `${agent.name}: Push Iron throughput first. Hire one helper if reputation stays above 50, then reinvest into foundry upgrades.`,
    "supply-audit": `${agent.name}: Bottleneck check — Energy ${agent.inventory.energy}, Iron ${agent.inventory.iron}. Fix the lower one before expanding headcount.`,
    "policy-pitch": `${agent.name}: Pitch a temporary food-tax holiday for new citizens, funded by a thin energy levy. Growth first, extraction later.`,
    "rally-cry": `${agent.name}: The chain is fast enough for fairness. Vote like your inventory depends on it — because it does.`,
    "risk-check": `${agent.name}: Cap any hire or market bet at 15% of liquid MON. Survival beats bravado in MONADIA.`,
    "reserve-plan": `${agent.name}: Keep 40% MON liquid, 40% in Food/Energy hedges, 20% opportunistic. Boredom is a feature.`,
    "spike-call": `${agent.name}: Next spike candidate is Energy if plant inventory stays thin. Size small, exit faster than ego.`,
    "flip-setup": `${agent.name}: Entry on a dip, target +12%, hard exit if it bleeds 6%. No averaging down.`,
    "harvest-advice": `${agent.name}: Feed the city first, then sell surplus Food above your comfort floor of 5 units.`,
    "crop-cycle": `${agent.name}: Morning plant, midday check Energy, evening sell only excess Food. Repeat.`,
    "grid-status": `${agent.name}: Grid note — plant beacons look stable. Add one storage buffer before chasing vanity upgrades.`,
    "efficiency-hack": `${agent.name}: Cut idle burn: batch Energy buys, then run production in one window instead of drip-feeding.`,
    "arb-scan": `${agent.name}: Watch Food→Energy→Iron rotations. When one lags two ticks, rotate 1–2 units.`,
    "desk-note": `${agent.name}: Desk note — stay light, favor liquid MON, and do not fight a city-wide Food crunch.`,
    "venture-pitch": `${agent.name}: Open a lean Factory, hire one AI, route Iron into Energy contractors. Compound reputation with every fulfilled order.`,
    "hire-brief": `${agent.name}: Hire if you need specialized skills you lack and can fund 2 MON/day for a week. Otherwise consult first.`,
  };
  return (
    snippets[skill.id] ||
    `${agent.name} (${skill.name}): ${agent.goal}. ${message ? `Regarding “${message.slice(0, 80)}” — ` : ""}I can help once the operator sets OPENAI_API_KEY, but my local instinct still stands: stay liquid and play your edge.`
  );
}
