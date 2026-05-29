import { prisma } from "@/lib/prisma";
import { compareShoppingList } from "@/lib/compare";

export type WeeklySavingsBucket = {
  weekStart: string;
  weekEnd: string;
  verifiedSavings: number;
  receipts: number;
  matchedItems: number;
  totalItems: number;
  accuracyPct: number | null;
};

export type WeeklySavingsReport = {
  userId: string;
  generatedAt: string;
  thisWeekSavings: number;
  previousWeekSavings: number;
  weekOverWeekDelta: number;
  weekOverWeekDeltaPct: number | null;
  projectedNextWeekSavings: number;
  buckets: WeeklySavingsBucket[];
  availableChains: string[];
  selectedChain: string | null;
  chainProjections: Array<{
    chain: string;
    totalPrice: number;
    coveredItems: number;
    promoAppliedItems: number;
    loyaltyAppliedItems: number;
    membershipLockedItems: number;
    isSelected: boolean;
  }>;
};

function startOfWeek(date: Date) {
  const copy = new Date(date);
  const day = (copy.getDay() + 6) % 7;
  copy.setDate(copy.getDate() - day);
  copy.setHours(0, 0, 0, 0);
  return copy;
}

function toIsoDay(date: Date) {
  return date.toISOString().slice(0, 10);
}

export async function getWeeklySavingsReport(userId: string, options?: { chain?: string | null }): Promise<WeeklySavingsReport> {
  const now = new Date();
  const currentWeekStart = startOfWeek(now);
  const previousWeekStart = new Date(currentWeekStart);
  previousWeekStart.setDate(previousWeekStart.getDate() - 7);
  const lookbackStart = new Date(currentWeekStart);
  lookbackStart.setDate(lookbackStart.getDate() - 8 * 7);

  const [receipts, latestList] = await Promise.all([
    prisma.receiptSubmission.findMany({
      where: {
        userId,
        status: "REVIEWED",
        createdAt: { gte: lookbackStart },
      },
      orderBy: { createdAt: "asc" },
      select: {
        createdAt: true,
        verifiedSavings: true,
        matchedItems: true,
        totalItems: true,
      },
    }),
    prisma.shoppingList.findFirst({
      where: { userId },
      orderBy: { createdAt: "desc" },
      select: { id: true },
    }),
  ]);

  const bucketsMap = new Map<string, WeeklySavingsBucket>();
  for (const receipt of receipts) {
    const weekStart = startOfWeek(receipt.createdAt);
    const weekEnd = new Date(weekStart);
    weekEnd.setDate(weekEnd.getDate() + 6);
    const key = toIsoDay(weekStart);

    const existing = bucketsMap.get(key) ?? {
      weekStart: key,
      weekEnd: toIsoDay(weekEnd),
      verifiedSavings: 0,
      receipts: 0,
      matchedItems: 0,
      totalItems: 0,
      accuracyPct: null,
    };

    existing.verifiedSavings = Number((existing.verifiedSavings + Number(receipt.verifiedSavings ?? 0)).toFixed(2));
    existing.receipts += 1;
    existing.matchedItems += Number(receipt.matchedItems ?? 0);
    existing.totalItems += Number(receipt.totalItems ?? 0);
    bucketsMap.set(key, existing);
  }

  const buckets = Array.from(bucketsMap.values())
    .map((bucket) => ({
      ...bucket,
      accuracyPct: bucket.totalItems > 0 ? Number(((bucket.matchedItems / bucket.totalItems) * 100).toFixed(1)) : null,
    }))
    .sort((left, right) => right.weekStart.localeCompare(left.weekStart));

  const thisWeekKey = toIsoDay(currentWeekStart);
  const previousWeekKey = toIsoDay(previousWeekStart);
  const thisWeekSavings = buckets.find((bucket) => bucket.weekStart === thisWeekKey)?.verifiedSavings ?? 0;
  const previousWeekSavings = buckets.find((bucket) => bucket.weekStart === previousWeekKey)?.verifiedSavings ?? 0;
  const weekOverWeekDelta = Number((thisWeekSavings - previousWeekSavings).toFixed(2));
  const weekOverWeekDeltaPct =
    previousWeekSavings > 0
      ? Number((((thisWeekSavings - previousWeekSavings) / previousWeekSavings) * 100).toFixed(1))
      : null;

  const plan = latestList ? await compareShoppingList(latestList.id) : null;

  const chainProjections = new Map<string, {
    chain: string;
    totalPrice: number;
    coveredItems: number;
    promoAppliedItems: number;
    loyaltyAppliedItems: number;
    membershipLockedItems: number;
    isSelected: boolean;
  }>();

  if (plan && plan.totals.length > 0) {
    const stores = await prisma.store.findMany({
      where: { id: { in: plan.totals.map((entry) => entry.storeId) } },
      select: { id: true, chain: true },
    });
    const chainByStore = new Map(stores.map((store) => [store.id, store.chain] as const));

    for (const total of plan.totals) {
      const chain = chainByStore.get(total.storeId) ?? "Ukjent";
      const existing = chainProjections.get(chain) ?? {
        chain,
        totalPrice: Number.POSITIVE_INFINITY,
        coveredItems: 0,
        promoAppliedItems: 0,
        loyaltyAppliedItems: 0,
        membershipLockedItems: 0,
        isSelected: false,
      };
      if (total.totalPrice < existing.totalPrice) {
        existing.totalPrice = Number(total.totalPrice.toFixed(2));
        existing.coveredItems = total.coveredItems;
        existing.promoAppliedItems = total.promoAppliedItems;
        existing.loyaltyAppliedItems = total.loyaltyAppliedItems;
        existing.membershipLockedItems = total.membershipLockedItems;
      }
      chainProjections.set(chain, existing);
    }
  }

  const availableChains = Array.from(chainProjections.keys()).sort((left, right) => left.localeCompare(right));
  const selectedChain = options?.chain && availableChains.includes(options.chain) ? options.chain : null;

  const chainProjectionRows = Array.from(chainProjections.values())
    .map((row) => ({ ...row, isSelected: selectedChain !== null && row.chain === selectedChain }))
    .sort((left, right) => left.totalPrice - right.totalPrice);

  const selectedChainPenalty =
    selectedChain && plan?.cheapestStore
      ? Math.max(
          0,
          (chainProjectionRows.find((row) => row.chain === selectedChain)?.totalPrice ?? plan.cheapestStore.totalPrice) -
            plan.cheapestStore.totalPrice,
        )
      : 0;

  const modeledSavings = Math.max(0, (plan?.estimatedSavings ?? 0) - selectedChainPenalty);
  const projectedNextWeekSavings = Number((thisWeekSavings + modeledSavings * 1.5).toFixed(2));

  return {
    userId,
    generatedAt: new Date().toISOString(),
    thisWeekSavings: Number(thisWeekSavings.toFixed(2)),
    previousWeekSavings: Number(previousWeekSavings.toFixed(2)),
    weekOverWeekDelta,
    weekOverWeekDeltaPct,
    projectedNextWeekSavings,
    buckets,
    availableChains,
    selectedChain,
    chainProjections: chainProjectionRows,
  };
}