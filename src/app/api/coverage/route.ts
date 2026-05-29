import { NextResponse } from "next/server";
import { getCoverageMetrics } from "@/lib/coverage";
import { serverError } from "@/lib/api-response";

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const region = searchParams.get("region")?.trim().toLowerCase() ?? "";
    const postalCode = searchParams.get("postalCode")?.trim() ?? "";
    const postalPrefix = searchParams.get("postalPrefix")?.trim() ?? "";
    const metrics = await getCoverageMetrics({ region, postalCode, postalPrefix });

    return NextResponse.json({
      ...metrics,
      postalMap: metrics.postalMap.map((bucket) => ({
        postalCode: bucket.label,
        stores: bucket.stores,
        coveredProducts: bucket.coveredProducts,
        coverageRatio: bucket.coverageRatio,
        averageAgeDays: bucket.averageAgeDays,
        sourceDiversity: bucket.sourceDiversity,
      })),
      chainMap: metrics.chainMap.map((bucket) => ({
        chain: bucket.label,
        stores: bucket.stores,
        coveredProducts: bucket.coveredProducts,
        coverageRatio: bucket.coverageRatio,
        averageAgeDays: bucket.averageAgeDays,
        sourceDiversity: bucket.sourceDiversity,
      })),
      priorityPostals: metrics.priorityPostals.map((bucket) => ({
        postalCode: bucket.label,
        stores: bucket.stores,
        coveredProducts: bucket.coveredProducts,
        coverageRatio: bucket.coverageRatio,
        averageAgeDays: bucket.averageAgeDays,
        sourceDiversity: bucket.sourceDiversity,
      })),
      priorityChains: metrics.priorityChains.map((bucket) => ({
        chain: bucket.label,
        stores: bucket.stores,
        coveredProducts: bucket.coveredProducts,
        coverageRatio: bucket.coverageRatio,
        averageAgeDays: bucket.averageAgeDays,
        sourceDiversity: bucket.sourceDiversity,
      })),
    });
  } catch (error) {
    return serverError(error, "Kunne ikke beregne dekningsscore.");
  }
}
