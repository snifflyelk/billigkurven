import { prisma } from "@/lib/prisma";

export type TransparencyMetrics = {
  trackedProducts: number;
  trackedStores: number;
  nonQuarantinedPrices: number;
  freshPrices24h: number;
  verifiedReceipts: number;
  quarantinedRows: number;
  sourceDiversity: number;
  sourceNames: string[];
  freshestObservationHours: number | null;
  freshnessRatio: number;
  stalePrices72h: number;
  staleRatio72h: number;
  quarantineRatio: number;
};

export async function getTransparencyMetrics(): Promise<TransparencyMetrics> {
  const since24h = new Date(Date.now() - 24 * 60 * 60 * 1000);
  const since72h = new Date(Date.now() - 72 * 60 * 60 * 1000);

  const [trackedProducts, trackedStores, nonQuarantinedPrices, freshPrices24h, stalePrices72h, verifiedReceipts, quarantinedRows, latestPrice, sourceRows] =
    await Promise.all([
      prisma.product.count().catch(() => 0),
      prisma.store.count().catch(() => 0),
      prisma.price.count({ where: { isQuarantined: false } }).catch(() => 0),
      prisma.price.count({ where: { isQuarantined: false, date: { gte: since24h } } }).catch(() => 0),
      prisma.price.count({ where: { isQuarantined: false, date: { lt: since72h } } }).catch(() => 0),
      prisma.receiptSubmission.count({ where: { status: "REVIEWED" } }).catch(() => 0),
      prisma.price.count({ where: { isQuarantined: true } }).catch(() => 0),
      prisma.price.findFirst({ where: { isQuarantined: false }, orderBy: { date: "desc" }, select: { date: true } }).catch(() => null),
      prisma.price.findMany({ where: { isQuarantined: false }, distinct: ["source"], select: { source: true } }).catch(() => []),
    ]);

  const freshestObservationHours = latestPrice
    ? Number(((Date.now() - latestPrice.date.getTime()) / (1000 * 60 * 60)).toFixed(1))
    : null;
  const sourceNames = sourceRows.map((row) => row.source).filter(Boolean);
  const totalPrices = nonQuarantinedPrices + quarantinedRows;

  return {
    trackedProducts,
    trackedStores,
    nonQuarantinedPrices,
    freshPrices24h,
    verifiedReceipts,
    quarantinedRows,
    sourceDiversity: sourceNames.length,
    sourceNames,
    freshestObservationHours,
    freshnessRatio: nonQuarantinedPrices > 0 ? Math.round((freshPrices24h / nonQuarantinedPrices) * 100) : 0,
    stalePrices72h,
    staleRatio72h: nonQuarantinedPrices > 0 ? Math.round((stalePrices72h / nonQuarantinedPrices) * 100) : 0,
    quarantineRatio: totalPrices > 0 ? Math.round((quarantinedRows / totalPrices) * 100) : 0,
  };
}