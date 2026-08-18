import { NextResponse } from "next/server";
import { getPlatformStatusMetrics } from "@/lib/market-intelligence";

export async function GET() {
  const status = await getPlatformStatusMetrics();

  const healthy = status.ingestionHealth >= 50 && status.freshnessRatio >= 35;

  return NextResponse.json(
    {
      ok: healthy,
      ingestionHealth: status.ingestionHealth,
      freshnessRatio: status.freshnessRatio,
      staleRatio: status.staleRatio,
      checkedAt: new Date().toISOString(),
    },
    { status: healthy ? 200 : 503 },
  );
}
