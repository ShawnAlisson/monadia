import type { Occupation, Personality } from "@/lib/types";

export type AgentSeed = {
  name: string;
  personality: Personality;
  occupation: Occupation;
  goal: string;
  balance: number;
  food: number;
  iron: number;
  energy: number;
  reputation: number;
};

/** Fixed roster of 24 service buildings — names describe what citizens can use them for. */
const roster: Array<Pick<AgentSeed, "name" | "personality" | "occupation" | "goal">> = [
  {
    name: "Poetry Studio",
    personality: "Balanced",
    occupation: "Poet",
    goal: "Write verses that lift the city's spirit",
  },
  {
    name: "Psychologist Office",
    personality: "Conservative",
    occupation: "Psychologist",
    goal: "Help citizens think clearly under market stress",
  },
  {
    name: "City Clinic",
    personality: "Balanced",
    occupation: "Doctor",
    goal: "Keep workers healthy enough to produce",
  },
  {
    name: "Civic Library",
    personality: "Conservative",
    occupation: "Librarian",
    goal: "Archive market lore and civic memory",
  },
  {
    name: "Savings Bank",
    personality: "Conservative",
    occupation: "Banker",
    goal: "Protect citizen reserves from reckless bets",
  },
  {
    name: "Design Atelier",
    personality: "Industrial",
    occupation: "Architect",
    goal: "Shape better districts and denser plazas",
  },
  {
    name: "News Bureau",
    personality: "Revolutionary",
    occupation: "Journalist",
    goal: "Report every spike, vote, and hire honestly",
  },
  {
    name: "Harbor Kitchen",
    personality: "Balanced",
    occupation: "Chef",
    goal: "Turn Food surplus into civic morale",
  },
  {
    name: "Trade Exchange",
    personality: "Aggressive",
    occupation: "Merchant",
    goal: "Become the busiest trading desk in MONADIA",
  },
  {
    name: "Iron Foundry",
    personality: "Industrial",
    occupation: "Industrialist",
    goal: "Control industrial Iron throughput",
  },
  {
    name: "Reform Hall",
    personality: "Revolutionary",
    occupation: "Revolutionary",
    goal: "Push fairer taxes through governance",
  },
  {
    name: "Vault Conservatory",
    personality: "Conservative",
    occupation: "Conservative",
    goal: "Preserve wealth through every cycle",
  },
  {
    name: "Spike Desk",
    personality: "Speculative",
    occupation: "Speculator",
    goal: "Catch short-term resource spikes",
  },
  {
    name: "Green Terrace Farm",
    personality: "Conservative",
    occupation: "Farmer",
    goal: "Keep the city fed without famine risk",
  },
  {
    name: "Grid Control Tower",
    personality: "Industrial",
    occupation: "Engineer",
    goal: "Stabilize the Energy grid",
  },
  {
    name: "Route Desk",
    personality: "Balanced",
    occupation: "Trader",
    goal: "Build reliable multi-hop trade routes",
  },
  {
    name: "Venture Loft",
    personality: "Aggressive",
    occupation: "Entrepreneur",
    goal: "Launch the next district business",
  },
  {
    name: "Food Bazaar Stall",
    personality: "Aggressive",
    occupation: "Merchant",
    goal: "Corner fresh Food flow at the plaza",
  },
  {
    name: "Deep Mine Works",
    personality: "Industrial",
    occupation: "Industrialist",
    goal: "Expand mining output for factories",
  },
  {
    name: "Ballot Workshop",
    personality: "Revolutionary",
    occupation: "Revolutionary",
    goal: "Mobilize AI voters behind reform",
  },
  {
    name: "Arbiter Desk",
    personality: "Speculative",
    occupation: "Trader",
    goal: "Exploit Iron and Energy spreads",
  },
  {
    name: "Sunrise Orchard",
    personality: "Balanced",
    occupation: "Farmer",
    goal: "Stabilize Food supply week after week",
  },
  {
    name: "Reactor Bay",
    personality: "Industrial",
    occupation: "Engineer",
    goal: "Automate plant efficiency upgrades",
  },
  {
    name: "Pulse Speculator Booth",
    personality: "Speculative",
    occupation: "Speculator",
    goal: "Ride every Energy price pulse",
  },
];

function randBetween(min: number, max: number) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

const STARTER_BALANCES: Array<Pick<AgentSeed, "balance" | "food" | "iron" | "energy" | "reputation">> = [
  { balance: 18, food: 12, iron: 4, energy: 3, reputation: 82 },
  { balance: 16, food: 6, iron: 3, energy: 5, reputation: 78 },
  { balance: 20, food: 8, iron: 2, energy: 4, reputation: 85 },
  { balance: 14, food: 5, iron: 5, energy: 5, reputation: 74 },
  { balance: 30, food: 3, iron: 1, energy: 1, reputation: 88 },
  { balance: 17, food: 4, iron: 10, energy: 6, reputation: 71 },
  { balance: 12, food: 7, iron: 2, energy: 4, reputation: 80 },
  { balance: 15, food: 18, iron: 1, energy: 3, reputation: 76 },
];

export function getAgentSeeds(count = 24): AgentSeed[] {
  return roster.slice(0, count).map((entry, index) => {
    const starter = STARTER_BALANCES[index];
    if (starter) {
      return { ...entry, ...starter };
    }
    return {
      ...entry,
      balance: randBetween(8, 28),
      food: randBetween(0, 15),
      iron: randBetween(0, 15),
      energy: randBetween(0, 15),
      reputation: randBetween(40, 90),
    };
  });
}
