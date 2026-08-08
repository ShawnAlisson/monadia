import type { Business, Citizen, CivilizationEvent } from "@/lib/types";

/** Deterministic hash of a string → 32-bit uint. */
export function hash(str: string): number {
  let h = 2166136261;
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

/** Deterministic pseudo-random in [0, 1) from a string + salt. */
export function rand(seed: string, salt = 0): number {
  return ((hash(seed) ^ Math.imul(salt + 1, 2654435761)) >>> 0) / 4294967296;
}

export type Vec2 = { x: number; z: number };

/** Points of interest in world coordinates. */
export const POI = {
  MARKET: { x: 0, z: 0 },
  GOVERNMENT: { x: 0, z: -22 },
  FARM: { x: -24, z: 10 },
  MINE: { x: 24, z: 10 },
  PLANT: { x: 0, z: 24 },
} as const;

export type PoiKey = keyof typeof POI;

export const POI_LABELS: Record<PoiKey, string> = {
  MARKET: "MARKET PLAZA",
  GOVERNMENT: "GOVERNMENT",
  FARM: "FARMLANDS",
  MINE: "IRON MINE",
  PLANT: "ENERGY PLANT",
};

type AgentDistrict = "MARKET" | "GOVERNMENT" | "FARM" | "MINE" | "PLANT";

// The seeded agents are deliberately spaced into service districts. These are
// fixed offsets, not random points, so their towers never collide or obscure a
// landmark. New operator-created agents use the safe outer-ring fallback.
const AGENT_IDS_BY_DISTRICT: Record<AgentDistrict, readonly string[]> = {
  MARKET: ["ai-0", "ai-4", "ai-5", "ai-6", "ai-9", "ai-11", "ai-13", "ai-14", "ai-18", "ai-20"],
  GOVERNMENT: ["ai-2", "ai-3", "ai-10", "ai-15", "ai-19"],
  FARM: ["ai-8", "ai-16", "ai-21"],
  MINE: ["ai-1", "ai-12", "ai-22"],
  PLANT: ["ai-7", "ai-17", "ai-23"],
};

const AGENT_BUILDING_SLOTS: Record<AgentDistrict, readonly Vec2[]> = {
  MARKET: [
    { x: 0, z: 12 }, { x: 7, z: 10 }, { x: 11, z: 4 }, { x: 11, z: -4 }, { x: 7, z: -10 },
    { x: 0, z: -12 }, { x: -7, z: -10 }, { x: -11, z: -4 }, { x: -11, z: 4 }, { x: -7, z: 10 },
  ],
  GOVERNMENT: [{ x: -9, z: -7 }, { x: 0, z: -10 }, { x: 9, z: -7 }, { x: -11, z: 0 }, { x: 11, z: 0 }],
  FARM: [{ x: -10, z: -6 }, { x: -11, z: 2 }, { x: -8, z: 8 }],
  MINE: [{ x: 10, z: -6 }, { x: 11, z: 2 }, { x: 8, z: 8 }],
  PLANT: [{ x: -8, z: 10 }, { x: 0, z: 12 }, { x: 8, z: 10 }],
};

function districtForAgent(c: Citizen): AgentDistrict {
  if (c.occupation === "Farmer" || c.occupation === "Chef") return "FARM";
  if (c.occupation === "Industrialist") return "MINE";
  if (c.occupation === "Engineer" || c.occupation === "Architect") return "PLANT";
  if (
    c.occupation === "Revolutionary" ||
    c.occupation === "Conservative" ||
    c.occupation === "Journalist" ||
    c.occupation === "Librarian" ||
    c.occupation === "Psychologist"
  ) {
    return "GOVERNMENT";
  }
  return "MARKET";
}

/** Home position for a citizen from its 1..8 map grid + deterministic jitter. */
export function homePosition(c: Citizen): Vec2 {
  const gx = Math.min(8, Math.max(1, c.mapX));
  const gy = Math.min(8, Math.max(1, c.mapY));
  const jx = (rand(c.id, 11) - 0.5) * 4.5;
  const jz = (rand(c.id, 23) - 0.5) * 4.5;
  return { x: (gx - 4.5) * 7.5 + jx, z: (gy - 4.5) * 7.5 + jz };
}

/**
 * AI citizens are permanent service buildings. Group them around the district
 * that explains their work instead of scattering them through the human grid.
 * The stable hash keeps every address visually fixed across visits.
 */
export function agentBuildingPosition(c: Citizen): Vec2 {
  const district = districtForAgent(c);
  const anchor = POI[district];
  const slot = AGENT_IDS_BY_DISTRICT[district].indexOf(c.id);
  const offset = slot >= 0 ? AGENT_BUILDING_SLOTS[district][slot] : undefined;
  if (offset) return { x: anchor.x + offset.x, z: anchor.z + offset.z };

  const angle = rand(c.id, 53) * Math.PI * 2;
  const radius = 15 + rand(c.id, 61) * 4;
  return {
    x: anchor.x + Math.cos(angle) * radius,
    z: anchor.z + Math.sin(angle) * radius,
  };
}

/** Where a business building sits: ringed around the POI matching its type. */
export function businessPosition(b: Business): Vec2 {
  const anchor =
    b.businessType === 0 ? POI.FARM : b.businessType === 1 ? POI.MINE : POI.PLANT;
  const angle = rand(b.id, 7) * Math.PI * 2;
  const radius = 6.5 + rand(b.id, 13) * 5;
  return {
    x: anchor.x + Math.cos(angle) * radius,
    z: anchor.z + Math.sin(angle) * radius,
  };
}

/** Which POI an event should send its actor toward. */
export function eventTarget(kind: string): PoiKey | null {
  switch (kind) {
    case "BUY":
    case "SELL":
    case "HIRE":
      return "MARKET";
    case "VOTE":
    case "JOIN":
      return "GOVERNMENT";
    case "PRODUCE":
      return "PLANT";
    case "BUSINESS":
      return "MINE";
    default:
      return null;
  }
}

/** Accent color per event kind (hex). */
export function eventColor(kind: string): string {
  switch (kind) {
    case "BUY":
      return "#3de6c1";
    case "SELL":
      return "#f0b35a";
    case "VOTE":
      return "#b085f5";
    case "BUSINESS":
      return "#5ab6f0";
    case "PRODUCE":
      return "#8ef05a";
    case "HIRE":
      return "#f05a9e";
    default:
      return "#3de6c1";
  }
}

/** Ambient filler towers so the city reads as a skyline (deterministic). */
export function fillerBuildings(count = 90) {
  const out: { x: number; z: number; h: number; w: number; seed: number }[] = [];
  let placed = 0;
  let i = 0;
  while (placed < count && i < count * 4) {
    i++;
    const seed = `tower-${i}`;
    const angle = rand(seed, 1) * Math.PI * 2;
    const radius = 14 + rand(seed, 2) * 34;
    const x = Math.cos(angle) * radius;
    const z = Math.sin(angle) * radius;
    // keep clear of POIs
    const nearPoi = Object.values(POI).some(
      (p) => (p.x - x) ** 2 + (p.z - z) ** 2 < 8 ** 2
    );
    if (nearPoi) continue;
    out.push({
      x,
      z,
      h: 1.5 + rand(seed, 3) * 6.5,
      w: 1.4 + rand(seed, 4) * 1.8,
      seed: hash(seed),
    });
    placed++;
  }
  return out;
}

const clip = (s: string, n: number) => (s.length > n ? s.slice(0, n - 1) + "…" : s);

/** Short bubble text for an event. */
export function bubbleText(e: CivilizationEvent): string {
  const msg = e.message.replace(/^([🤖👤🏭💰🏛️⚡🌾⛏]|\s)+/u, "");
  return clip(msg, 44);
}
