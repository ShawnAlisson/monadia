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
  | "Entrepreneur"
  | "Poet"
  | "Psychologist"
  | "Doctor"
  | "Librarian"
  | "Banker"
  | "Architect"
  | "Journalist"
  | "Chef";

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
  /** Human citizen who deployed this AI agent (player-owned agents only). */
  creatorId?: string | null;
  creatorName?: string | null;
  /** World MON charged per skill use; paid to the creator. */
  skillPrice: number;
  /** Lifetime world MON earned from skill uses. */
  skillEarnings: number;
  skillUses: number;
  mapX: number;
  mapY: number;
  /** Live/last world coordinates in the 3D city (not the 1..8 map grid). */
  worldX: number | null;
  worldZ: number | null;
  /** Last presence heartbeat from the client (ms epoch). */
  lastSeenAt: number | null;
  /** True when lastSeenAt is recent enough to count as online. */
  online: boolean;
  lastReasoning?: string | null;
  createdAt: number;
  updatedAt: number;
};

export type CustomAgentSkill = {
  id: string;
  skillKey: string;
  name: string;
  description: string;
  promptHint: string;
};

export type SocialMessage = {
  id: string;
  fromId: string;
  fromName: string;
  toId: string;
  toName: string;
  body: string;
  createdAt: number;
  readAt: number | null;
};

export type MoneyRequest = {
  id: string;
  fromId: string;
  fromName: string;
  toId: string;
  toName: string;
  amount: number;
  note: string;
  status: "pending" | "paid" | "declined" | "cancelled";
  createdAt: number;
  resolvedAt: number | null;
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
