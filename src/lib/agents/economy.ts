/** Economy knobs for player-deployed AI agent buildings. */
export const AGENT_DEPLOY = {
  /** World MON charged to deploy one custom agent. */
  createCost: 5,
  /** Max custom agents a single human may own. */
  maxPerHuman: 3,
  /** Skills allowed on one custom agent. */
  maxSkills: 3,
  /** Default price visitors pay per skill use. */
  defaultSkillPrice: 0.5,
  /** Min/max skill price the owner can set. */
  minSkillPrice: 0,
  maxSkillPrice: 25,
  /** Share of each skill fee that goes to the city treasury. */
  cityTaxShare: 0.1,
} as const;
