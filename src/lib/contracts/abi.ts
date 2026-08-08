export const civilizationAbi = [
  {
    type: "constructor",
    inputs: [],
    stateMutability: "nonpayable",
  },
  {
    type: "function",
    name: "joinCivilization",
    inputs: [{ name: "name", type: "string" }],
    outputs: [],
    stateMutability: "nonpayable",
  },
  {
    type: "function",
    name: "buyResource",
    inputs: [
      { name: "resourceId", type: "uint8" },
      { name: "amount", type: "uint256" },
    ],
    outputs: [],
    stateMutability: "payable",
  },
  {
    type: "function",
    name: "sellResource",
    inputs: [
      { name: "resourceId", type: "uint8" },
      { name: "amount", type: "uint256" },
    ],
    outputs: [],
    stateMutability: "nonpayable",
  },
  {
    type: "function",
    name: "createBusiness",
    inputs: [
      { name: "businessType", type: "uint8" },
      { name: "name", type: "string" },
    ],
    outputs: [],
    stateMutability: "payable",
  },
  {
    type: "function",
    name: "hireAgent",
    inputs: [
      { name: "agent", type: "address" },
      { name: "dailyRate", type: "uint256" },
    ],
    outputs: [],
    stateMutability: "payable",
  },
  {
    type: "function",
    name: "vote",
    inputs: [
      { name: "proposalId", type: "uint256" },
      { name: "support", type: "bool" },
    ],
    outputs: [],
    stateMutability: "nonpayable",
  },
  {
    type: "function",
    name: "registerAI",
    inputs: [
      { name: "agent", type: "address" },
      { name: "name", type: "string" },
      { name: "occupation", type: "uint8" },
    ],
    outputs: [],
    stateMutability: "nonpayable",
  },
  {
    type: "function",
    name: "createProposal",
    inputs: [
      { name: "description", type: "string" },
      { name: "durationSeconds", type: "uint256" },
    ],
    outputs: [],
    stateMutability: "nonpayable",
  },
  {
    type: "function",
    name: "produce",
    inputs: [{ name: "businessId", type: "uint256" }],
    outputs: [],
    stateMutability: "nonpayable",
  },
  {
    type: "function",
    name: "fundMarket",
    inputs: [],
    outputs: [],
    stateMutability: "payable",
  },
  {
    type: "function",
    name: "getPrices",
    inputs: [],
    outputs: [
      { name: "", type: "uint256" },
      { name: "", type: "uint256" },
      { name: "", type: "uint256" },
    ],
    stateMutability: "view",
  },
  {
    type: "function",
    name: "getInventory",
    inputs: [{ name: "citizen", type: "address" }],
    outputs: [
      { name: "", type: "uint256" },
      { name: "", type: "uint256" },
      { name: "", type: "uint256" },
    ],
    stateMutability: "view",
  },
  {
    type: "function",
    name: "getMetrics",
    inputs: [],
    outputs: [
      { name: "", type: "uint256" },
      { name: "", type: "uint256" },
      { name: "", type: "uint256" },
      { name: "", type: "uint256" },
      { name: "", type: "uint256" },
      { name: "", type: "uint256" },
      { name: "", type: "uint256" },
    ],
    stateMutability: "view",
  },
  {
    type: "function",
    name: "citizens",
    inputs: [{ name: "", type: "address" }],
    outputs: [
      { name: "name", type: "string" },
      { name: "isAI", type: "bool" },
      { name: "joined", type: "bool" },
      { name: "reputation", type: "uint256" },
      { name: "occupation", type: "uint8" },
      { name: "employer", type: "address" },
      { name: "hireRate", type: "uint256" },
    ],
    stateMutability: "view",
  },
  {
    type: "function",
    name: "foodPrice",
    inputs: [],
    outputs: [{ name: "", type: "uint256" }],
    stateMutability: "view",
  },
  {
    type: "function",
    name: "ironPrice",
    inputs: [],
    outputs: [{ name: "", type: "uint256" }],
    stateMutability: "view",
  },
  {
    type: "function",
    name: "energyPrice",
    inputs: [],
    outputs: [{ name: "", type: "uint256" }],
    stateMutability: "view",
  },
  {
    type: "function",
    name: "token",
    inputs: [],
    outputs: [{ name: "", type: "address" }],
    stateMutability: "view",
  },
  {
    type: "function",
    name: "taxBps",
    inputs: [],
    outputs: [{ name: "", type: "uint256" }],
    stateMutability: "view",
  },
  {
    type: "function",
    name: "tokenTreasury",
    inputs: [],
    outputs: [{ name: "", type: "uint256" }],
    stateMutability: "view",
  },
  {
    type: "function",
    name: "welcomeBonus",
    inputs: [],
    outputs: [{ name: "", type: "uint256" }],
    stateMutability: "view",
  },
  {
    type: "event",
    name: "WelcomeBonusGranted",
    inputs: [
      { name: "citizen", type: "address", indexed: true },
      { name: "amount", type: "uint256", indexed: false },
    ],
  },
  {
    type: "event",
    name: "TaxCollected",
    inputs: [
      { name: "citizen", type: "address", indexed: true },
      { name: "amount", type: "uint256", indexed: false },
    ],
  },
  {
    type: "event",
    name: "CitizenJoined",
    inputs: [
      { name: "citizen", type: "address", indexed: true },
      { name: "name", type: "string", indexed: false },
      { name: "isAI", type: "bool", indexed: false },
    ],
  },
  {
    type: "event",
    name: "ResourceBought",
    inputs: [
      { name: "citizen", type: "address", indexed: true },
      { name: "resourceId", type: "uint8", indexed: false },
      { name: "amount", type: "uint256", indexed: false },
      { name: "totalCost", type: "uint256", indexed: false },
      { name: "isAI", type: "bool", indexed: false },
    ],
  },
  {
    type: "event",
    name: "ResourceSold",
    inputs: [
      { name: "citizen", type: "address", indexed: true },
      { name: "resourceId", type: "uint8", indexed: false },
      { name: "amount", type: "uint256", indexed: false },
      { name: "totalRevenue", type: "uint256", indexed: false },
      { name: "isAI", type: "bool", indexed: false },
    ],
  },
  {
    type: "event",
    name: "BusinessCreated",
    inputs: [
      { name: "businessId", type: "uint256", indexed: true },
      { name: "owner", type: "address", indexed: true },
      { name: "businessType", type: "uint8", indexed: false },
      { name: "name", type: "string", indexed: false },
    ],
  },
  {
    type: "event",
    name: "ProposalCreated",
    inputs: [
      { name: "proposalId", type: "uint256", indexed: true },
      { name: "description", type: "string", indexed: false },
    ],
  },
  {
    type: "event",
    name: "AgentHired",
    inputs: [
      { name: "employer", type: "address", indexed: true },
      { name: "agent", type: "address", indexed: true },
      { name: "dailyRate", type: "uint256", indexed: false },
    ],
  },
  {
    type: "event",
    name: "Voted",
    inputs: [
      { name: "proposalId", type: "uint256", indexed: true },
      { name: "voter", type: "address", indexed: true },
      { name: "support", type: "bool", indexed: false },
      { name: "isAI", type: "bool", indexed: false },
    ],
  },
] as const;

/** Minimal ERC-20 ABI for MonadiaCoin (MDA). */
export const monadiaCoinAbi = [
  {
    type: "function",
    name: "balanceOf",
    inputs: [{ name: "", type: "address" }],
    outputs: [{ name: "", type: "uint256" }],
    stateMutability: "view",
  },
  {
    type: "function",
    name: "symbol",
    inputs: [],
    outputs: [{ name: "", type: "string" }],
    stateMutability: "view",
  },
  {
    type: "function",
    name: "decimals",
    inputs: [],
    outputs: [{ name: "", type: "uint8" }],
    stateMutability: "view",
  },
  {
    type: "function",
    name: "totalSupply",
    inputs: [],
    outputs: [{ name: "", type: "uint256" }],
    stateMutability: "view",
  },
  {
    type: "function",
    name: "transfer",
    inputs: [
      { name: "to", type: "address" },
      { name: "value", type: "uint256" },
    ],
    outputs: [{ name: "", type: "bool" }],
    stateMutability: "nonpayable",
  },
  {
    type: "event",
    name: "Transfer",
    inputs: [
      { name: "from", type: "address", indexed: true },
      { name: "to", type: "address", indexed: true },
      { name: "value", type: "uint256", indexed: false },
    ],
  },
] as const;

export const CIVILIZATION_ADDRESS = (process.env.NEXT_PUBLIC_CIVILIZATION_ADDRESS ||
  "0x0000000000000000000000000000000000000000") as `0x${string}`;

export const EXPLORER_URL =
  process.env.NEXT_PUBLIC_EXPLORER_URL || "https://testnet.monadvision.com";

export const MONAD_RPC =
  process.env.MONAD_RPC_URL ||
  process.env.NEXT_PUBLIC_MONAD_RPC_URL ||
  "https://testnet-rpc.monad.xyz";
