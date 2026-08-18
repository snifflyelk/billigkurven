import { prisma } from "@/lib/prisma";
import { unstable_cache } from "next/cache";

export type CityInsight = {
  city: string;
  postalPrefix: string;
  winningChain: string;
  winningStore: string;
  basketEstimate: number;
  spread: number;
  dataFreshnessHours: number | null;
  trackedProducts: number;
  summary: string;
};

const cityConfig = [
  { city: "Oslo", postalPrefix: "0" },
  { city: "Bergen", postalPrefix: "5" },
  { city: "Trondheim", postalPrefix: "7" },
  { city: "Stavanger", postalPrefix: "4" },
] as const;

const getPlatformStatusMetricsCached = unstable_cache(
  async () => {
  const since24h = new Date(Date.now() - 24 * 60 * 60 * 1000);
  const since72h = new Date(Date.now() - 72 * 60 * 60 * 1000);

  const [
    trackedProducts,
    stores,
    totalPrices,
    freshPrices24h,
    stalePrices72h,
    reviewedReceipts,
    activeAlerts,
    quarantinedRows,
  ] = await Promise.all([
    prisma.product.count({
      where: {
        NOT: [
          { name: { startsWith: "Vare " } },
          { name: { startsWith: "vare " } },
        ],
      },
    }).catch(() => 0),
    prisma.store.count().catch(() => 0),
    prisma.price.count().catch(() => 0),
    prisma.price.count({ where: { date: { gte: since24h }, isQuarantined: false } }).catch(() => 0),
    prisma.price.count({ where: { date: { lt: since72h }, isQuarantined: false } }).catch(() => 0),
    prisma.receiptSubmission.count({ where: { status: "REVIEWED" } }).catch(() => 0),
    prisma.priceAlert.count({ where: { isActive: true } }).catch(() => 0),
    prisma.price.count({ where: { isQuarantined: true } }).catch(() => 0),
  ]);

  const freshnessRatio = totalPrices > 0 ? Math.round((freshPrices24h / totalPrices) * 100) : 0;
  const staleRatio = totalPrices > 0 ? Math.round((stalePrices72h / totalPrices) * 100) : 0;
  const ingestionHealth = Math.max(0, Math.min(100, freshnessRatio - Math.round(staleRatio * 0.45)));
  const trustHealth = Math.max(0, Math.min(100, Math.round((reviewedReceipts > 0 ? 65 : 35) + (activeAlerts > 0 ? 8 : 0) + (freshnessRatio * 0.22) - (staleRatio * 0.2))));

  return {
    trackedProducts,
    stores,
    totalPrices,
    freshPrices24h,
    stalePrices72h,
    reviewedReceipts,
    activeAlerts,
    quarantinedRows,
    freshnessRatio,
    staleRatio,
    ingestionHealth,
    trustHealth,
    updatedAt: new Date().toISOString(),
  };
  },
  ["platform-status-metrics-v1"],
  { revalidate: 120 },
);

export async function getPlatformStatusMetrics() {
  return getPlatformStatusMetricsCached();
}

async function computeCityInsight(city: string, postalPrefix: string): Promise<CityInsight> {
  const stores = await prisma.store.findMany({
    where: { postalCode: { startsWith: postalPrefix } },
    select: { id: true, name: true, chain: true },
    take: 50,
  }).catch(() => []);

  if (stores.length === 0) {
    return {
      city,
      postalPrefix,
      winningChain: "Ingen data",
      winningStore: "Ingen data",
      basketEstimate: 0,
      spread: 0,
      dataFreshnessHours: null,
      trackedProducts: 0,
      summary: "Ingen lokale butikker med sporbare data enda.",
    };
  }

  const storeIds = stores.map((store) => store.id);

  const products = await prisma.product.findMany({
    where: {
      NOT: [
        { name: { startsWith: "Vare " } },
        { name: { startsWith: "vare " } },
      ],
      prices: {
        some: { storeId: { in: storeIds }, isQuarantined: false },
      },
    },
    include: {
      prices: {
        where: { storeId: { in: storeIds }, isQuarantined: false },
        include: { store: { select: { id: true, name: true, chain: true } } },
        orderBy: { date: "desc" },
        take: 180,
      },
    },
    take: 120,
  }).catch(() => []);

  const totals = new Map<string, { storeName: string; chain: string; total: number; covered: number }>();
  const freshnessHours: number[] = [];

  for (const product of products) {
    const seen = new Set<string>();
    for (const row of product.prices) {
      if (seen.has(row.storeId)) continue;
      seen.add(row.storeId);

      const current = totals.get(row.storeId) ?? { storeName: row.store.name, chain: row.store.chain, total: 0, covered: 0 };
      current.total += Number(row.price);
      current.covered += 1;
      totals.set(row.storeId, current);

      freshnessHours.push((Date.now() - row.date.getTime()) / (1000 * 60 * 60));
    }
  }

  const ranked = Array.from(totals.values())
    .filter((entry) => entry.covered >= 8)
    .sort((a, b) => a.total - b.total);

  const winner = ranked[0];
  const loser = ranked[ranked.length - 1];
  const trackedProducts = products.length;
  const spread = winner && loser ? Number((loser.total - winner.total).toFixed(2)) : 0;
  const dataFreshnessHours = freshnessHours.length > 0 ? Number(Math.min(...freshnessHours).toFixed(1)) : null;

  return {
    city,
    postalPrefix,
    winningChain: winner?.chain ?? "Ingen data",
    winningStore: winner?.storeName ?? "Ingen data",
    basketEstimate: winner ? Number(winner.total.toFixed(2)) : 0,
    spread,
    dataFreshnessHours,
    trackedProducts,
    summary: winner
      ? `${winner.chain} leder i ${city} med estimert kurv ${Math.round(winner.total)} kr og spread ${Math.round(spread)} kr.`
      : `For lite dekningsdata i ${city} akkurat nå.`,
  };
}

export async function getCityInsights(city?: string) {
  const targets = city
    ? cityConfig.filter((entry) => entry.city.toLowerCase() === city.toLowerCase())
    : cityConfig;

  const insights = await unstable_cache(
    async () => Promise.all(targets.map((target) => computeCityInsight(target.city, target.postalPrefix))),
    ["city-insights-v1", city?.toLowerCase() ?? "all"],
    { revalidate: 180 },
  )();
  return insights;
}

export async function getPublicPriceSnapshot() {
  const [status, insights] = await Promise.all([getPlatformStatusMetrics(), getCityInsights()]);
  return {
    generatedAt: new Date().toISOString(),
    status,
    highlights: insights.slice(0, 3).map((insight) => ({
      city: insight.city,
      winner: insight.winningChain,
      estimate: insight.basketEstimate,
      spread: insight.spread,
      freshnessHours: insight.dataFreshnessHours,
    })),
  };
}
