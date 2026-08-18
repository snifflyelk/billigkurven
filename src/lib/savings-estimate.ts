import { prisma } from "@/lib/prisma";
import {
  deriveMaxTravelKm,
  haversineKm,
  resolvePostalCodeCoordinates,
  sanitizePostalCode,
  sanitizePostalPrefix as sanitizePostalPrefixValue,
  toCoordinates,
} from "@/lib/geo";

type HouseholdType = "student" | "singel" | "par" | "familie";

const PRICE_LOOKBACK_DAYS = 45;

const householdMultipliers: Record<HouseholdType, number> = {
  student: 0.75,
  singel: 0.9,
  par: 1,
  familie: 1.35,
};

function clamp(value: number, min: number, max: number) {
  return Math.max(min, Math.min(max, value));
}

function normalizeChainName(chain: string | null | undefined, fallback: string) {
  const value = (chain ?? "").trim();
  if (!value) return fallback;
  return value.toUpperCase();
}

export type SavingsEstimateInput = {
  postalPrefix?: string | null;
  postalCode?: string | null;
  travelMode?: "DRIVE" | "WALK" | null;
  maxTravelMinutes?: number | null;
  maxTravelKm?: number | null;
  household?: string | null;
  weeklyBudget?: number | null;
};

export type SavingsEstimateOutput = {
  postalCode: string | null;
  postalPrefix: string;
  household: HouseholdType;
  weeklyBudget: number;
  weeklySavings: number;
  monthlySavings: number;
  annualSavings: number;
  savingsRate: number;
  observedProducts: number;
  observedStores: number;
  freshnessHours: number | null;
  basis: "postal" | "national";
  lookbackDays: number;
  methodology: "median-vs-cheapest";
};

function toHousehold(value: string | null | undefined): HouseholdType {
  const normalized = (value ?? "").toLowerCase();
  if (normalized === "student" || normalized === "singel" || normalized === "par" || normalized === "familie") {
    return normalized;
  }
  return "familie";
}

function toWeeklyBudget(value: number | null | undefined) {
  if (typeof value !== "number" || !Number.isFinite(value) || value <= 0) return 1800;
  return Math.round(value);
}

async function loadPriceRows(postalPrefix: string) {
  const lookbackDate = new Date(Date.now() - PRICE_LOOKBACK_DAYS * 24 * 60 * 60 * 1000);

  const postalRows = await prisma.price.findMany({
    where: {
      isQuarantined: false,
      date: { gte: lookbackDate },
      store: {
        postalCode: {
          startsWith: postalPrefix,
        },
      },
    },
    orderBy: { date: "desc" },
    take: 4000,
    select: {
      productId: true,
      storeId: true,
      price: true,
      date: true,
      store: {
        select: {
          chain: true,
          name: true,
          postalCode: true,
          latitude: true,
          longitude: true,
        },
      },
    },
  });

  if (postalRows.length > 0) {
    return { rows: postalRows, basis: "postal" as const };
  }

  const nationalRows = await prisma.price.findMany({
    where: {
      isQuarantined: false,
      date: { gte: lookbackDate },
    },
    orderBy: { date: "desc" },
    take: 4000,
    select: {
      productId: true,
      storeId: true,
      price: true,
      date: true,
      store: {
        select: {
          chain: true,
          name: true,
          postalCode: true,
          latitude: true,
          longitude: true,
        },
      },
    },
  });

  return { rows: nationalRows, basis: "national" as const };
}

export async function calculateSavingsEstimate(input: SavingsEstimateInput): Promise<SavingsEstimateOutput> {
  const normalizedPostalCode = sanitizePostalCode(input.postalCode);
  const postalPrefix = (normalizedPostalCode.slice(0, 1) || sanitizePostalPrefixValue(input.postalPrefix) || "0");
  const household = toHousehold(input.household);
  const weeklyBudget = toWeeklyBudget(input.weeklyBudget);
  const travelMode = input.travelMode === "WALK" ? "WALK" : "DRIVE";
  const maxTravelKm = deriveMaxTravelKm({
    travelMode,
    maxTravelKm: input.maxTravelKm ?? null,
    maxTravelMinutes: input.maxTravelMinutes ?? null,
  });

  const { rows, basis } = await loadPriceRows(postalPrefix);
  const userCoordinates = await resolvePostalCodeCoordinates(normalizedPostalCode || null);

  const accessibleChains = new Set<string>();
  const hasDistanceConstraints = Boolean(userCoordinates && maxTravelKm !== null);

  if (hasDistanceConstraints && userCoordinates && maxTravelKm !== null) {
    const seenStores = new Set<string>();
    for (const row of rows) {
      if (seenStores.has(row.storeId)) continue;
      seenStores.add(row.storeId);
      const chainId = normalizeChainName(row.store.chain, row.store.name);
      const coordinates =
        toCoordinates({ latitude: row.store.latitude, longitude: row.store.longitude }) ??
        (await resolvePostalCodeCoordinates(row.store.postalCode));
      if (!coordinates) continue;
      const distanceKm = haversineKm(userCoordinates, coordinates);
      if (distanceKm <= maxTravelKm) {
        accessibleChains.add(chainId);
      }
    }
  }

  const latestByProductStore = new Map<string, { productId: string; chainId: string; price: number; date: Date }>();
  for (const row of rows) {
    const chainId = normalizeChainName(row.store.chain, row.store.name);
    if (hasDistanceConstraints && accessibleChains.size > 0 && !accessibleChains.has(chainId)) continue;
    const key = `${row.productId}:${chainId}`;
    if (!latestByProductStore.has(key)) {
      latestByProductStore.set(key, {
        productId: row.productId,
        chainId,
        price: Number(row.price),
        date: row.date,
      });
    }
  }

  const byProduct = new Map<string, Array<{ chainId: string; price: number }>>();
  const stores = new Set<string>();
  let latestObservationMs = 0;

  for (const entry of Array.from(latestByProductStore.values())) {
    const bucket = byProduct.get(entry.productId) ?? [];
    bucket.push({ chainId: entry.chainId, price: entry.price });
    byProduct.set(entry.productId, bucket);
    stores.add(entry.chainId);
    latestObservationMs = Math.max(latestObservationMs, entry.date.getTime());
  }

  let typicalSum = 0;
  let deltaSum = 0;
  let observedProducts = 0;

  for (const prices of Array.from(byProduct.values())) {
    if (prices.length < 2) continue;
    const values = prices.map((item) => item.price).filter((value) => Number.isFinite(value) && value > 0);
    if (values.length < 2) continue;
    values.sort((a, b) => a - b);
    const cheapest = values[0];
    const median = values[Math.floor(values.length / 2)];
    if (!Number.isFinite(cheapest) || !Number.isFinite(median) || median <= 0 || cheapest <= 0) continue;

    typicalSum += median;
    deltaSum += Math.max(0, median - cheapest);
    observedProducts += 1;
  }

  const rawRate = typicalSum > 0 ? deltaSum / typicalSum : 0.08;
  const dataRate = clamp(rawRate, 0.03, 0.2);

  const productQuality = clamp(observedProducts / 35, 0.55, 1);
  const storeQuality = clamp(stores.size / 5, 0.65, 1);

  const freshnessHours =
    latestObservationMs > 0 ? Math.max(0, Math.round((Date.now() - latestObservationMs) / (1000 * 60 * 60))) : null;
  const freshnessQuality =
    freshnessHours === null ? 0.75 : freshnessHours <= 72 ? 1 : clamp(1 - (freshnessHours - 72) / (24 * 10), 0.7, 1);

  const dataQuality = productQuality * storeQuality * freshnessQuality;
  const householdRate = dataRate * householdMultipliers[household] * dataQuality;
  const savingsRate = clamp(householdRate, 0.03, 0.22);

  const weeklySavings = Math.max(0, Math.round(weeklyBudget * savingsRate));
  const monthlySavings = weeklySavings * 4;
  const annualSavings = monthlySavings * 12;

  return {
    postalCode: normalizedPostalCode || null,
    postalPrefix,
    household,
    weeklyBudget,
    weeklySavings,
    monthlySavings,
    annualSavings,
    savingsRate: Number((savingsRate * 100).toFixed(1)),
    observedProducts,
    observedStores: stores.size,
    freshnessHours,
    basis,
    lookbackDays: PRICE_LOOKBACK_DAYS,
    methodology: "median-vs-cheapest",
  };
}
