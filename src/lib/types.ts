export type CitizenType = "HUMAN" | "AI";

export type Personality =
  | "Aggressive"
  | "Industrial"
  | "Revolutionary"
  | "Conservative"
  | "Speculative"
  | "Balanced";

export type Occupation =
  | "Merchant"
  | "Industrialist"
  | "Revolutionary"
  | "Conservative"
  | "Speculator"
  | "Farmer"
  | "Engineer"
  | "Trader"
  | "Entrepreneur";

export type ResourceId = 0 | 1 | 2;

export const RESOURCES = [
  { id: 0 as ResourceId, key: "food", label: "Food", emoji: "🌾" },
  { id: 1 as ResourceId, key: "iron", label: "Iron", emoji: "⛏" },
  { id: 2 as ResourceId, key: "energy", label: "Energy", emoji: "⚡" },
] as const;

export type Inventory = {
  food: number;
  iron: number;
  energy: number;
};

export type Citizen = {
  id: string;
  name: string;
  walletAddress: string;
  type: CitizenType;
  balance: number;
  personality: Personality;
  goal: string;
  occupation: Occupation;
  inventory: Inventory;
  reputation: number;
  /** MDA (MONADIA Coin) balance — civic token. */
  coins: number;
  netWorth: number;
  employerId?: string | null;
  mapX: number;
  mapY: number;
  lastReasoning?: string | null;
  createdAt: number;
  updatedAt: number;
};

export type CivilizationEvent = {
  id: string;
  ts: number;
  kind: string;
  actorName: string;
  actorType: CitizenType;
  message: string;
  txHash?: string | null;
  meta?: Record<string, unknown>;
};

export type Business = {
  id: string;
  onChainId?: number | null;
  ownerId: string;
  ownerName: string;
  name: string;
  businessType: 0 | 1 | 2;
  employees: number;
  revenuePerDay: number;
  createdAt: number;
  active: boolean;
};

export type Proposal = {
  id: string;
  onChainId?: number | null;
  description: string;
  yesVotes: number;
  noVotes: number;
  deadline: number;
  active: boolean;
};

export type PricePoint = {
  ts: number;
  food: number;
  iron: number;
  energy: number;
};

export type MarketState = {
  food: number;
  iron: number;
  energy: number;
  history: PricePoint[];
};

export type Metrics = {
  transactions: number;
  aiTransactions: number;
  humanTransactions: number;
  economicEvents: number;
  population: number;
  aiCitizens: number;
  humanCitizens: number;
  treasury: number;
  /** MDA collected by the government via trade tax. */
  coinTreasury: number;
};
