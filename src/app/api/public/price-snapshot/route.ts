import { NextResponse } from "next/server";
import { getPublicPriceSnapshot } from "@/lib/market-intelligence";

export async function GET() {
  const payload = await getPublicPriceSnapshot();
  return NextResponse.json(payload, {
    headers: {
      "cache-control": "public, s-maxage=300, stale-while-revalidate=600",
    },
  });
}
