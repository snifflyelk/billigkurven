import { NextRequest, NextResponse } from "next/server";
import { calculateSavingsEstimate } from "@/lib/savings-estimate";

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const postalPrefix = searchParams.get("postalPrefix");
  const postalCode = searchParams.get("postalCode");
  const travelModeParam = searchParams.get("travelMode");
  const travelMode = travelModeParam === "WALK" ? "WALK" : travelModeParam === "DRIVE" ? "DRIVE" : null;
  const maxTravelMinutesRaw = Number(searchParams.get("maxTravelMinutes") ?? "");
  const maxTravelMinutes = Number.isFinite(maxTravelMinutesRaw) ? maxTravelMinutesRaw : null;
  const maxTravelKmRaw = Number(searchParams.get("maxTravelKm") ?? "");
  const maxTravelKm = Number.isFinite(maxTravelKmRaw) ? maxTravelKmRaw : null;
  const household = searchParams.get("household");
  const weeklyBudgetRaw = Number(searchParams.get("weeklyBudget") ?? "");
  const weeklyBudget = Number.isFinite(weeklyBudgetRaw) ? weeklyBudgetRaw : null;

  const estimate = await calculateSavingsEstimate({
    postalPrefix,
    postalCode,
    travelMode,
    maxTravelMinutes,
    maxTravelKm,
    household,
    weeklyBudget,
  });

  return NextResponse.json(estimate, {
    headers: {
      "cache-control": "public, s-maxage=120, stale-while-revalidate=300",
    },
  });
}
