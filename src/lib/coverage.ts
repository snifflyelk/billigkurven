import { unstable_cache } from "next/cache";
import { prisma } from "@/lib/prisma";

function safeNumber(value: number, digits = 2) {
  return Number(value.toFixed(digits));
}

export type CoverageBucket = {
  label: string;
  stores: number;
  coveredProducts: number;
  coverageRatio: number;
  averageAgeDays: number | null;
  sourceDiversity: number;
};

export type CoverageMetrics = {
  region: string | null;
  postalCode: string | null;
  postalPrefix: string | null;
  products: number;
  stores: number;
  coveredProducts: number;
  coverageRatio: number;
  averageAgeDays: number | null;
  sourceDiversity: number;
  score: {
    overall: number;
    coverage: number;
    freshness: number;
    sourceDiversity: number;
  };
  postalMap: CoverageBucket[];
  chainMap: CoverageBucket[];
  priorityPostals: CoverageBucket[];
  priorityChains: CoverageBucket[];
  note: string;
};

async function computeCoverageMetrics({
  region = "",
  postalCode = "",
  postalPrefix = "",
}: {
  region?: string;
  postalCode?: string;
  postalPrefix?: string;
} = {}): Promise<CoverageMetrics> {
  const stores = await prisma.store.findMany({
    where: {
      ...(region
        ? {
            OR: [
              { location: { contains: region, mode: "insensitive" } },
              { chain: { contains: region, mode: "insensitive" } },
              { name: { contains: region, mode: "insensitive" } },
            ],
          }
        : {}),
      ...(postalCode ? { postalCode } : {}),
      ...(postalPrefix ? { postalCode: { startsWith: postalPrefix } } : {}),
    },
    select: { id: true, chain: true, postalCode: true },
  });

  const storeIds = new Set(stores.map((store) => store.id));
  const productsCount = await prisma.product.count();

  const rows = await prisma.price.findMany({
    where: {
      isQuarantined: false,
      ...(stores.length > 0 ? { storeId: { in: Array.from(storeIds) } } : {}),
    },
    orderBy: { date: "desc" },
    take: 4500,
    select: {
      productId: true,
      storeId: true,
      source: true,
      date: true,
    },
  });

  const latestByProductStore = new Map<string, (typeof rows)[number]>();
  for (const row of rows) {
    const key = `${row.productId}:${row.storeId}`;
    if (!latestByProductStore.has(key)) {
      latestByProductStore.set(key, row);
    }
  }

  const storesByProduct = new Map<string, Set<string>>();
  const sources = new Set<string>();
  const freshnessDays: number[] = [];
  const storeById = new Map(stores.map((store) => [store.id, store]));
  const postalMatrix = new Map<string, { stores: Set<string>; products: Set<string>; recencyDays: number[]; sources: Set<string> }>();
  const chainMatrix = new Map<string, { stores: Set<string>; products: Set<string>; recencyDays: number[]; sources: Set<string> }>();

  for (const row of Array.from(latestByProductStore.values())) {
    const set = storesByProduct.get(row.productId) ?? new Set<string>();
    set.add(row.storeId);
    storesByProduct.set(row.productId, set);
    sources.add(row.source || "unknown");
    const ageDays = (Date.now() - row.date.getTime()) / (1000 * 60 * 60 * 24);
    freshnessDays.push(ageDays);

    const store = storeById.get(row.storeId);
    const postalLabel = store?.postalCode ?? "ukjent";
    const postalBucket = postalMatrix.get(postalLabel) ?? {
      stores: new Set<string>(),
      products: new Set<string>(),
      recencyDays: [],
      sources: new Set<string>(),
    };
    postalBucket.stores.add(row.storeId);
    postalBucket.products.add(row.productId);
    postalBucket.recencyDays.push(ageDays);
    postalBucket.sources.add(row.source || "unknown");
    postalMatrix.set(postalLabel, postalBucket);

    const chainLabel = store?.chain?.trim() || "Ukjent kjede";
    const chainBucket = chainMatrix.get(chainLabel) ?? {
      stores: new Set<string>(),
      products: new Set<string>(),
      recencyDays: [],
      sources: new Set<string>(),
    };
    chainBucket.stores.add(row.storeId);
    chainBucket.products.add(row.productId);
    chainBucket.recencyDays.push(ageDays);
    chainBucket.sources.add(row.source || "unknown");
    chainMatrix.set(chainLabel, chainBucket);
  }

  const coveredProducts = Array.from(storesByProduct.values()).filter((set) => set.size >= 2).length;
  const coverageRatio = productsCount > 0 ? coveredProducts / productsCount : 0;
  const averageAgeDays = freshnessDays.length > 0 ? safeNumber(freshnessDays.reduce((a, b) => a + b, 0) / freshnessDays.length) : null;

  const coverageScore = Math.round(coverageRatio * 100);
  const freshnessScore = averageAgeDays === null ? 0 : Math.max(0, Math.min(100, Math.round((1 - averageAgeDays / 14) * 100)));
  const sourceScore = Math.max(0, Math.min(100, sources.size * 25));
  const overallScore = Math.round(coverageScore * 0.5 + freshnessScore * 0.3 + sourceScore * 0.2);

  const toBuckets = (matrix: Map<string, { stores: Set<string>; products: Set<string>; recencyDays: number[]; sources: Set<string> }>) =>
    Array.from(matrix.entries())
      .map(([label, bucket]) => {
        const avgRecency =
          bucket.recencyDays.length > 0 ? safeNumber(bucket.recencyDays.reduce((a, b) => a + b, 0) / bucket.recencyDays.length) : null;
        const bucketCoverage = productsCount > 0 ? bucket.products.size / productsCount : 0;
        return {
          label,
          stores: bucket.stores.size,
          coveredProducts: bucket.products.size,
          coverageRatio: safeNumber(bucketCoverage, 4),
          averageAgeDays: avgRecency,
          sourceDiversity: bucket.sources.size,
        };
      })
      .sort((a, b) => b.coverageRatio - a.coverageRatio);

  const postalMap = toBuckets(postalMatrix);
  const chainMap = toBuckets(chainMatrix);
  const prioritySorter = (left: CoverageBucket, right: CoverageBucket) => {
    const leftPriority = (1 - left.coverageRatio) * Math.max(1, left.stores) * Math.max(1, left.coveredProducts || 1);
    const rightPriority = (1 - right.coverageRatio) * Math.max(1, right.stores) * Math.max(1, right.coveredProducts || 1);
    return rightPriority - leftPriority;
  };

  return {
    region: region || null,
    postalCode: postalCode || null,
    postalPrefix: postalPrefix || null,
    products: productsCount,
    stores: stores.length,
    coveredProducts,
    coverageRatio: safeNumber(coverageRatio, 4),
    averageAgeDays,
    sourceDiversity: sources.size,
    score: {
      overall: overallScore,
      coverage: coverageScore,
      freshness: freshnessScore,
      sourceDiversity: sourceScore,
    },
    postalMap,
    chainMap,
    priorityPostals: [...postalMap].filter((bucket) => bucket.stores > 0).sort(prioritySorter).slice(0, 8),
    priorityChains: [...chainMap].filter((bucket) => bucket.stores > 0).sort(prioritySorter).slice(0, 8),
    note: "Coverage kan filtreres med postalCode eller postalPrefix. Vi viser også dekningsbildet per kjede og postnummer.",
  };
}

export async function getCoverageMetrics({
  region = "",
  postalCode = "",
  postalPrefix = "",
}: {
  region?: string;
  postalCode?: string;
  postalPrefix?: string;
} = {}): Promise<CoverageMetrics> {
  const normalizedRegion = region.trim().toLowerCase();
  const normalizedPostalCode = postalCode.trim();
  const normalizedPostalPrefix = postalPrefix.trim();

  return unstable_cache(
    async () =>
      computeCoverageMetrics({
        region: normalizedRegion,
        postalCode: normalizedPostalCode,
        postalPrefix: normalizedPostalPrefix,
      }),
    ["coverage-metrics-v2", normalizedRegion || "-", normalizedPostalCode || "-", normalizedPostalPrefix || "-"],
    { revalidate: 180 },
  )();
}
