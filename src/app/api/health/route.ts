import { NextResponse } from "next/server";
import { ensureDatabase, publicDatabaseError } from "@/lib/db";
import { requiresOnchainVerification } from "@/lib/contracts/verify";
import { isOnChainAiEnabled } from "@/lib/sim/onchain";

export const dynamic = "force-dynamic";

/** Lightweight deployment probe: never returns keys, URLs, or wallet details. */
export async function GET() {
  try {
    await ensureDatabase();
    return NextResponse.json({
      ok: true,
      database: "connected",
      monadSettlement: requiresOnchainVerification(),
      onchainAi: isOnChainAiEnabled(),
    });
  } catch (error) {
    return NextResponse.json(
      {
        ok: false,
        database: "unavailable",
        error: publicDatabaseError(error),
      },
      { status: 503 },
    );
  }
}
