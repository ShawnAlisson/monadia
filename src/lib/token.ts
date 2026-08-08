/** MONADIA Coin (MDA) — civic token constants shared by sim + UI. */
export const MDA = {
  symbol: "MDA",
  name: "MONADIA Coin",
  /** Granted once to every citizen (human or AI) on joining. */
  welcomeBonus: 100,
  /** Trade tax in basis points of MON trade value (paid in MDA, 1 MDA : 1 MON). */
  taxBps: 200,
} as const;

/** MDA tax owed on a trade of the given MON value. */
export function tradeTax(monValue: number): number {
  return (monValue * MDA.taxBps) / 10000;
}
