import { prisma } from "@/lib/prisma";
import { assessPriceRowQuality } from "@/lib/price-quality";

export type ChainQualitySnapshot = {
  chain: string;
  qualityScore: number;
  status: "sterk" | "moderat" | "svak";
  rows: number;
  trackedProducts: number;
  stores: number;
  acceptanceRate: number;
  avgPriceAgeDays: number | null;
  quarantineRate: number;
};

export type ReceiptTruthSummary = {
  sampleCount: number;
  usableSampleCount: number;
  averageMatchRate: number;
  highConfidenceRate: number;
  medianAbsErrorPct: number | null;
  checks: {
    minimumSample: boolean;
    matchRate: boolean;
    highConfidence: boolean;
    priceError: boolean;
  };
  overallPass: boolean;
};

type ReceiptTruthInput = {
  detectedTotal: number | null;
  estimatedDetectedStoreTotal: number | null;
  matchedItems: number | null;
  totalItems: number | null;
  confidence: string | null;
};

function median(values: number[]) {
  if (values.length === 0) return null;
  const sorted = values.slice().sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  if (sorted.length % 2 === 0) return (sorted[mid - 1] + sorted[mid]) / 2;
  return sorted[mid];
}

function pct(value: number) {
  return Number((value * 100).toFixed(1));
}

export function evaluateReceiptTruthSummary(items: ReceiptTruthInput[]): ReceiptTruthSummary {
  const sampleCount = items.length;

  const matchRates = items
    .map((item) => {
      if (!item.totalItems || item.totalItems <= 0 || !item.matchedItems || item.matchedItems < 0) return null;
      return Math.min(1, item.matchedItems / item.totalItems);
    })
    .filter((value): value is number => value !== null);

  const errorRatios = items
    .map((item) => {
      if (item.detectedTotal === null || item.estimatedDetectedStoreTotal === null || item.detectedTotal <= 0) return null;
      return Math.abs(item.detectedTotal - item.estimatedDetectedStoreTotal) / item.detectedTotal;
    })
    .filter((value): value is number => value !== null);

  const highConfidenceCount = items.filter((item) => item.confidence === "hoy").length;
  const usableSampleCount = errorRatios.length;

  const averageMatchRate = matchRates.length > 0 ? matchRates.reduce((sum, value) => sum + value, 0) / matchRates.length : 0;
  const highConfidenceRate = sampleCount > 0 ? highConfidenceCount / sampleCount : 0;
  const medianAbsErrorPct = median(errorRatios);

  const checks = {
    minimumSample: sampleCount >= 20,
    matchRate: averageMatchRate >= 0.75,
    highConfidence: highConfidenceRate >= 0.6,
    priceError: medianAbsErrorPct !== null && medianAbsErrorPct <= 0.05,
  };

  return {
    sampleCount,
    usableSampleCount,
    averageMatchRate: pct(averageMatchRate),
    highConfidenceRate: pct(highConfidenceRate),
    medianAbsErrorPct: medianAbsErrorPct === null ? null : pct(medianAbsErrorPct),
    checks,
    overallPass: checks.minimumSample && checks.matchRate && checks.highConfidence && checks.priceError,
  };
}

export async function getChainQualitySnapshot(days = 7): Promise<ChainQualitySnapshot[]> {
  const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000);

  const [trackedProducts, rows, quarantinedRows] = await Promise.all([
    prisma.product.count(),
    prisma.price.findMany({
      where: { date: { gte: since }, isQuarantined: false },
      orderBy: { date: "desc" },
      take: 9000,
      select: {
        date: true,
        source: true,
        sourceUrl: true,
        price: true,
        unitPrice: true,
        product: {
          select: {
            name: true,
            brand: true,
            packageQuantity: true,
            packageUnit: true,
          },
        },
        store: {
          select: {
            chain: true,
            id: true,
          },
        },
      },
    }),
    prisma.price.findMany({
      where: { date: { gte: since }, isQuarantined: true },
      orderBy: { date: "desc" },
      take: 5000,
      select: {
        store: {
          select: {
            chain: true,
          },
        },
      },
    }),
  ]);

  const chains = new Map<string, {
    rows: number;
    accepted: number;
    freshnessSamples: number[];
    productKeys: Set<string>;
    stores: Set<string>;
    quarantinedRows: number;
  }>();

  for (const row of rows) {
    const chain = row.store.chain || "Ukjent";
    const state = chains.get(chain) ?? {
      rows: 0,
      accepted: 0,
      freshnessSamples: [],
      productKeys: new Set<string>(),
      stores: new Set<string>(),
      quarantinedRows: 0,
    };

    state.rows += 1;
    state.productKeys.add(`${row.product.name}::${row.product.brand}`);
    state.stores.add(row.store.id);
    state.freshnessSamples.push((Date.now() - row.date.getTime()) / (1000 * 60 * 60 * 24));

    const quality = assessPriceRowQuality({
      productName: row.product.name,
      productBrand: row.product.brand,
      source: row.source,
      sourceUrl: row.sourceUrl,
      packageQuantity: row.product.packageQuantity,
      packageUnit: row.product.packageUnit,
      price: Number(row.price),
      unitPrice: Number(row.unitPrice),
    });

    if (quality.accepted) state.accepted += 1;
    chains.set(chain, state);
  }

  for (const row of quarantinedRows) {
    const chain = row.store.chain || "Ukjent";
    const state = chains.get(chain) ?? {
      rows: 0,
      accepted: 0,
      freshnessSamples: [],
      productKeys: new Set<string>(),
      stores: new Set<string>(),
      quarantinedRows: 0,
    };
    state.quarantinedRows += 1;
    chains.set(chain, state);
  }

  const snapshots = Array.from(chains.entries()).map(([chain, state]) => {
    const acceptanceRate = state.rows > 0 ? state.accepted / state.rows : 0;
    const avgPriceAgeDays =
      state.freshnessSamples.length > 0
        ? Number((state.freshnessSamples.reduce((sum, value) => sum + value, 0) / state.freshnessSamples.length).toFixed(2))
        : null;
    const freshnessScore = avgPriceAgeDays === null ? 0 : Math.max(0, Math.min(100, Math.round((1 - avgPriceAgeDays / 7) * 100)));
    const coverageScore = trackedProducts > 0 ? Math.min(100, Math.round((state.productKeys.size / trackedProducts) * 100)) : 0;
    const quarantineRate = state.rows + state.quarantinedRows > 0 ? state.quarantinedRows / (state.rows + state.quarantinedRows) : 0;
    const quarantineScore = Math.max(0, 100 - Math.round(quarantineRate * 100));
    const alignmentScore = Math.round(acceptanceRate * 100);

    const qualityScore = Math.round(coverageScore * 0.3 + freshnessScore * 0.25 + alignmentScore * 0.35 + quarantineScore * 0.1);
    const status = qualityScore >= 80 ? "sterk" : qualityScore >= 60 ? "moderat" : "svak";

    return {
      chain,
      qualityScore,
      status,
      rows: state.rows,
      trackedProducts: state.productKeys.size,
      stores: state.stores.size,
      acceptanceRate: pct(acceptanceRate),
      avgPriceAgeDays,
      quarantineRate: pct(quarantineRate),
    } satisfies ChainQualitySnapshot;
  });

  return snapshots.sort((a, b) => b.qualityScore - a.qualityScore);
}

export async function getReceiptTruthSummary(days = 7): Promise<ReceiptTruthSummary> {
  const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000);

  const rows = await prisma.receiptSubmission.findMany({
    where: {
      status: "REVIEWED",
      reviewedAt: { gte: since },
    },
    select: {
      detectedTotal: true,
      estimatedDetectedStoreTotal: true,
      matchedItems: true,
      totalItems: true,
      savingsConfidence: true,
    },
  });

  return evaluateReceiptTruthSummary(
    rows.map((row) => ({
      detectedTotal: row.detectedTotal !== null ? Number(row.detectedTotal) : null,
      estimatedDetectedStoreTotal: row.estimatedDetectedStoreTotal !== null ? Number(row.estimatedDetectedStoreTotal) : null,
      matchedItems: row.matchedItems,
      totalItems: row.totalItems,
      confidence: row.savingsConfidence,
    })),
  );
}
