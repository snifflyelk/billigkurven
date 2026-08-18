import { NextResponse } from "next/server";
import { getChainQualitySnapshot, getReceiptTruthSummary } from "@/lib/quality-monitor";
import { serverError } from "@/lib/api-response";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  try {
    const url = new URL(request.url);
    const daysParam = Number(url.searchParams.get("days") ?? "7");
    const days = Number.isFinite(daysParam) && daysParam > 0 ? Math.min(30, Math.round(daysParam)) : 7;

    const [chains, receiptTruth] = await Promise.all([
      getChainQualitySnapshot(days),
      getReceiptTruthSummary(days),
    ]);

    return NextResponse.json({
      windowDays: days,
      generatedAt: new Date().toISOString(),
      chains,
      receiptTruth,
    });
  } catch (error) {
    return serverError(error, "Kunne ikke hente kvalitetsrapport akkurat nå.");
  }
}
