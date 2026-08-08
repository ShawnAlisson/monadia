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

const named: AgentSeed[] = [
  {
    name: "Maya",
    personality: "Aggressive",
    occupation: "Merchant",
    goal: "Become the richest citizen",
    balance: 18,
    food: 12,
    iron: 4,
    energy: 3,
    reputation: 82,
  },
  {
    name: "Atlas",
    personality: "Industrial",
    occupation: "Industrialist",
    goal: "Control the iron market",
    balance: 22,
    food: 5,
    iron: 28,
    energy: 6,
    reputation: 74,
  },
  {
    name: "Nora",
    personality: "Revolutionary",
    occupation: "Revolutionary",
    goal: "Gain political influence",
    balance: 11,
    food: 8,
    iron: 2,
    energy: 4,
    reputation: 91,
  },
  {
    name: "Leo",
    personality: "Conservative",
    occupation: "Conservative",
    goal: "Preserve wealth",
    balance: 30,
    food: 3,
    iron: 1,
    energy: 1,
    reputation: 66,
  },
  {
    name: "Zara",
    personality: "Speculative",
    occupation: "Speculator",
    goal: "Maximize short-term profit",
    balance: 14,
    food: 6,
    iron: 6,
    energy: 10,
    reputation: 58,
  },
];

const extras: Array<Pick<AgentSeed, "name" | "personality" | "occupation" | "goal">> = [
  { name: "Kai", personality: "Balanced", occupation: "Trader", goal: "Build steady trade routes" },
  { name: "Iris", personality: "Aggressive", occupation: "Merchant", goal: "Corner the food market" },
  { name: "Orion", personality: "Industrial", occupation: "Engineer", goal: "Power the city grid" },
  { name: "Vera", personality: "Conservative", occupation: "Farmer", goal: "Feed the civilization" },
  { name: "Rex", personality: "Speculative", occupation: "Trader", goal: "Flip energy for profit" },
  { name: "Lyra", personality: "Revolutionary", occupation: "Revolutionary", goal: "Reform market taxes" },
  { name: "Juno", personality: "Balanced", occupation: "Merchant", goal: "Grow a diversified portfolio" },
  { name: "Cass", personality: "Industrial", occupation: "Industrialist", goal: "Expand mining output" },
  { name: "Nyx", personality: "Speculative", occupation: "Speculator", goal: "Ride every price spike" },
  { name: "Sol", personality: "Aggressive", occupation: "Trader", goal: "Dominate energy trades" },
  { name: "Echo", personality: "Conservative", occupation: "Conservative", goal: "Never go bankrupt" },
  { name: "Pax", personality: "Balanced", occupation: "Farmer", goal: "Stabilize food supply" },
  { name: "Voss", personality: "Industrial", occupation: "Engineer", goal: "Automate production" },
  { name: "Quinn", personality: "Aggressive", occupation: "Merchant", goal: "Outtrade Maya" },
  { name: "Ash", personality: "Revolutionary", occupation: "Revolutionary", goal: "Mobilize AI voters" },
  { name: "Rune", personality: "Speculative", occupation: "Trader", goal: "Exploit iron volatility" },
  { name: "Tess", personality: "Conservative", occupation: "Farmer", goal: "Accumulate quiet wealth" },
  { name: "Blade", personality: "Industrial", occupation: "Industrialist", goal: "Own the foundries" },
  { name: "Mira", personality: "Balanced", occupation: "Engineer", goal: "Balance the grid" },
];

function randBetween(min: number, max: number) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

export function getAgentSeeds(count = 24): AgentSeed[] {
  const generated = extras.map((e) => ({
    ...e,
    balance: randBetween(8, 28),
    food: randBetween(0, 15),
    iron: randBetween(0, 15),
    energy: randBetween(0, 15),
    reputation: randBetween(40, 90),
  }));
  return [...named, ...generated].slice(0, count);
}
