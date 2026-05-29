import { NextResponse } from "next/server";

import { syncLivePrices } from "@/lib/live-pricing/sync";
import { serverError } from "@/lib/api-response";

export async function POST() {
  try {
    const result = await syncLivePrices();
    const providerLabel = result.providersEvaluated === 1 ? "kilde" : "kilder";

    return NextResponse.json({
      message: `Synkroniserte ${result.matchedPrices} prislinjer fra ${result.providersEvaluated} ${providerLabel}.`,
      ...result,
    });
  } catch (error) {
    return serverError(error, "Sjekk nettverkstilgang mot de eksterne prisleverandorene og prov igjen.");
  }
}