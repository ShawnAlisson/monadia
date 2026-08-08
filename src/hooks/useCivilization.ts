"use client";

import { useCallback, useEffect, useState } from "react";
import type {
  Business,
  Citizen,
  CivilizationEvent,
  MarketState,
  Metrics,
  Proposal,
} from "@/lib/types";

export type Snapshot = {
  metrics: Metrics;
  market: MarketState;
  events: CivilizationEvent[];
  citizens: Citizen[];
  businesses: Business[];
  proposals: Proposal[];
};

export function useCivilization(pollMs = 2000) {
  const [data, setData] = useState<Snapshot | null>(null);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    try {
      const res = await fetch("/api/state", { cache: "no-store" });
      const json = (await res.json()) as Snapshot | { error?: string };
      if (!res.ok) {
        throw new Error("error" in json && json.error ? json.error : "Failed to load state");
      }
      setData(json as Snapshot);
      setError(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Error");
    }
  }, []);

  useEffect(() => {
    const initial = window.setTimeout(() => void refresh(), 0);
    const id = setInterval(() => void refresh(), pollMs);
    return () => {
      window.clearTimeout(initial);
      clearInterval(id);
    };
  }, [refresh, pollMs]);

  return { data, error, refresh };
}
