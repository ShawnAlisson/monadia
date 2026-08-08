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
  Poet: [
    {
      id: "city-verse",
      name: "City Verse",
      description: "Commission a short poem about MONADIA or a citizen.",
      promptHint: "Write 4-8 lines of vivid poetry. Stay warm and concrete.",
    },
    {
      id: "market-ode",
      name: "Market Ode",
      description: "Turn today's prices into a lyrical toast or warning.",
      promptHint: "Make Food, Iron, or Energy feel mythic in a short ode.",
    },
  ],
  Psychologist: [
    {
      id: "stress-check",
      name: "Stress Check",
      description: "Talk through FOMO, loss fear, or overtrading urges.",
      promptHint: "Be a calm psychologist. Name the feeling and one grounding move.",
    },
    {
      id: "decision-frame",
      name: "Decision Frame",
      description: "Reframe a tough hire, sell, or vote decision.",
      promptHint: "Separate emotion from evidence in 3 short steps.",
    },
  ],
  Doctor: [
    {
      id: "shift-plan",
      name: "Shift Plan",
      description: "Plan a sustainable work/rest cycle for agents and humans.",
      promptHint: "Give practical stamina advice tied to city labor.",
    },
    {
      id: "triage-note",
      name: "Triage Note",
      description: "Prioritize who needs help first in a busy district.",
      promptHint: "Triage like a clinic: urgent vs can wait.",
    },
  ],
  Librarian: [
    {
      id: "lore-lookup",
      name: "Lore Lookup",
      description: "Recall civic rules, districts, or past market patterns.",
      promptHint: "Answer like a librarian citing MONADIA lore briefly.",
    },
    {
      id: "reading-list",
      name: "Reading List",
      description: "Suggest 3 'readings' (topics) before a big decision.",
      promptHint: "Give a tiny curated reading list of city topics.",
    },
  ],
  Banker: [
    {
      id: "budget-split",
      name: "Budget Split",
      description: "Allocate MON across spend, reserve, and opportunity.",
      promptHint: "Be a prudent banker with clear percentages.",
    },
    {
      id: "credit-check",
      name: "Credit Check",
      description: "Judge whether a hire or transfer looks affordable.",
      promptHint: "Approve or caution a spend with one reason.",
    },
  ],
  Architect: [
    {
      id: "district-sketch",
      name: "District Sketch",
      description: "Suggest how to improve a plaza or production district.",
      promptHint: "Speak like an architect about flow, landmarks, and density.",
    },
    {
      id: "build-brief",
      name: "Build Brief",
      description: "Outline a Farm, Factory, or Plant placement idea.",
      promptHint: "Give a compact building brief with site rationale.",
    },
  ],
  Journalist: [
    {
      id: "headline",
      name: "Headline",
      description: "Get a sharp headline about the latest city event.",
      promptHint: "Write one punchy headline and a one-sentence lede.",
    },
    {
      id: "field-report",
      name: "Field Report",
      description: "Summarize who is winning Food, Iron, or Energy right now.",
      promptHint: "File a terse field report with one non-obvious angle.",
    },
  ],
  Chef: [
    {
      id: "menu-plan",
      name: "Menu Plan",
      description: "Turn Food inventory into a morale-boosting menu.",
      promptHint: "Be a chef: practical Food use that lifts the city.",
    },
    {
      id: "surplus-recipe",
      name: "Surplus Recipe",
      description: "Advise when to cook vs sell Food into the market.",
      promptHint: "Recommend cook vs sell with a short recipe metaphor.",
    },
  ],
};

export function getAgentSkills(occupation: Occupation): AgentSkill[] {
  return BY_OCCUPATION[occupation] ?? BY_OCCUPATION.Trader;
}

export function getAgentSkill(occupation: Occupation, skillId: string): AgentSkill | null {
  return getAgentSkills(occupation).find((s) => s.id === skillId) ?? null;
}
