import type { Occupation } from "@/lib/types";

export type AgentSkill = {
  id: string;
  name: string;
  description: string;
  promptHint: string;
};

const BY_OCCUPATION: Record<Occupation, AgentSkill[]> = {
  Merchant: [
    {
      id: "price-brief",
      name: "Price Brief",
      description: "Ask for a quick buy/sell take on Food, Iron, or Energy.",
      promptHint: "Give a sharp merchant brief with one recommended action.",
    },
    {
      id: "trade-route",
      name: "Trade Route",
      description: "Design a short trade loop using current inventory.",
      promptHint: "Propose a concrete 2-step trade route with quantities.",
    },
  ],
  Industrialist: [
    {
      id: "output-plan",
      name: "Output Plan",
      description: "Get a production plan focused on Iron throughput.",
      promptHint: "Prioritize industrial output and worker efficiency.",
    },
    {
      id: "supply-audit",
      name: "Supply Audit",
      description: "Audit bottlenecks in materials and energy.",
      promptHint: "Identify the bottleneck and one fix.",
    },
  ],
  Revolutionary: [
    {
      id: "policy-pitch",
      name: "Policy Pitch",
      description: "Draft a civic proposal angle for governance.",
      promptHint: "Pitch a reform that helps citizens without crashing markets.",
    },
    {
      id: "rally-cry",
      name: "Rally Cry",
      description: "Get a short speech to mobilize voters.",
      promptHint: "Write a punchy 2-sentence rally cry.",
    },
  ],
  Conservative: [
    {
      id: "risk-check",
      name: "Risk Check",
      description: "Stress-test a spending or hire decision.",
      promptHint: "Warn about downside risk and preserve capital.",
    },
    {
      id: "reserve-plan",
      name: "Reserve Plan",
      description: "Recommend a safe MON/MDA reserve split.",
      promptHint: "Propose a conservative reserve allocation.",
    },
  ],
  Speculator: [
    {
      id: "spike-call",
      name: "Spike Call",
      description: "Call the next resource likely to spike.",
      promptHint: "Make a bold short-term speculation with conviction.",
    },
    {
      id: "flip-setup",
      name: "Flip Setup",
      description: "Set up a quick flip with entry and exit.",
      promptHint: "Give entry, target, and exit in one breath.",
    },
  ],
  Farmer: [
    {
      id: "harvest-advice",
      name: "Harvest Advice",
      description: "Ask when to sell Food vs hold for the city.",
      promptHint: "Balance feeding the city with profitable sales.",
    },
    {
      id: "crop-cycle",
      name: "Crop Cycle",
      description: "Plan the next Food production cycle.",
      promptHint: "Give a practical farm cycle for the next day.",
    },
  ],
  Engineer: [
    {
      id: "grid-status",
      name: "Grid Status",
      description: "Diagnose Energy grid health and upgrades.",
      promptHint: "Talk like a systems engineer about the power plant.",
    },
    {
      id: "efficiency-hack",
      name: "Efficiency Hack",
      description: "Suggest one upgrade to cut Energy waste.",
      promptHint: "One concrete efficiency hack only.",
    },
  ],
  Trader: [
    {
      id: "arb-scan",
      name: "Arb Scan",
      description: "Scan for a cross-resource arbitrage idea.",
      promptHint: "Find a small arbitrage between two resources.",
    },
    {
      id: "desk-note",
      name: "Desk Note",
      description: "Get a trading-desk note for the next hour.",
      promptHint: "Write a terse trading desk note.",
    },
  ],
  Entrepreneur: [
    {
      id: "venture-pitch",
      name: "Venture Pitch",
      description: "Pitch a business idea inside MONADIA.",
      promptHint: "Pitch a venture using Farm, Factory, or Power Plant.",
    },
    {
      id: "hire-brief",
      name: "Hire Brief",
      description: "Advise whether hiring an AI agent is worth it.",
      promptHint: "Advise on hiring with ROI framing.",
    },
  ],
};

export function getAgentSkills(occupation: Occupation): AgentSkill[] {
  return BY_OCCUPATION[occupation] ?? BY_OCCUPATION.Trader;
}

export function getAgentSkill(occupation: Occupation, skillId: string): AgentSkill | null {
  return getAgentSkills(occupation).find((s) => s.id === skillId) ?? null;
}
