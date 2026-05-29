import { prisma } from "@/lib/prisma";
import { filterLogicalPriceEntries } from "@/lib/pricing-sanity";

export type StoreTotal = {
  storeId: string;
  storeName: string;
  totalPrice: number;
  coveredItems: number;
  averageAgeDays: number | null;
  newestHours: number | null;
  sourceCount: number;
  promoAppliedItems: number;
  loyaltyAppliedItems: number;
  membershipLockedItems: number;
  membershipLockedProducts: string[];
};

export type DriverItem = {
  productId: string;
  productName: string;
  cheapestPrice: number;
  highestPrice: number;
  difference: number;
  trend: {
    last7Avg: number | null;
    previous7Avg: number | null;
    changePct: number | null;
    action: "kjop-na" | "vent" | "ukjent";
  };
};

export type CompareResult = {
  cheapestStore: StoreTotal | null;
  totals: StoreTotal[];
  estimatedSavings: number;
  priceyDrivers: DriverItem[];
  analyzedItems: number;
  coveredItems: number;
  coverageScore: number;
  dataPoints: number;
  confidence: "lav" | "medium" | "hoy";
  trustMetrics: {
    trustScore: number;
    averagePriceAgeDays: number | null;
    newestObservationHours: number | null;
    sourceDiversity: number;
    comparedStores: number;
    filteredOutlierStores: number;
  };
  recommendation: {
    shouldAutoRecommend: boolean;
    mode: "strong" | "guarded";
    message: string;
    recommendedStore: StoreTotal | null;
    why: string[];
    riskFlags: string[];
    nextActions: string[];
    timingSummary: {
      buyNow: number;
      wait: number;
      neutral: number;
    };
    timingImpact: {
      buyNowValue: number;
      waitValue: number;
    };
  };
};

export async function compareShoppingList(shoppingListId: string): Promise<CompareResult> {
  const shoppingList = await prisma.shoppingList.findUnique({
    where: { id: shoppingListId },
    include: {
      user: { include: { preference: true } },
      items: {
        include: {
          product: {
            include: {
              prices: {
                include: { store: true },
                where: { isQuarantined: false },
                orderBy: { date: "desc" },
              },
            },
          },
        },
      },
    },
  });

  if (!shoppingList) {
    return {
      cheapestStore: null,
      totals: [],
      estimatedSavings: 0,
      priceyDrivers: [],
      analyzedItems: 0,
      coveredItems: 0,
      coverageScore: 0,
      dataPoints: 0,
      confidence: "lav",
      trustMetrics: {
        trustScore: 0,
        averagePriceAgeDays: null,
        newestObservationHours: null,
        sourceDiversity: 0,
        comparedStores: 0,
        filteredOutlierStores: 0,
      },
      recommendation: {
        shouldAutoRecommend: false,
        mode: "guarded",
        message: "Mangler handlelistegrunnlag.",
        recommendedStore: null,
        why: [],
        riskFlags: ["Ingen handleliste valgt."],
        nextActions: ["Legg til minst 3 varer i handlelisten for a aktivere anbefaling."],
        timingSummary: {
          buyNow: 0,
          wait: 0,
          neutral: 0,
        },
        timingImpact: {
          buyNowValue: 0,
          waitValue: 0,
        },
      },
    };
  }

  const useMembershipPricing = shoppingList.user.preference?.useMembershipPricing ?? true;

  function effectivePriceForRow(priceRow: {
    price: unknown;
    promoPrice: unknown;
    loyaltyPrice: unknown;
    promoValidFrom: Date | null;
    promoValidTo: Date | null;
    requiresMembership: boolean;
  }) {
    const basePrice = Number(priceRow.price);
    const promoPrice = priceRow.promoPrice !== null ? Number(priceRow.promoPrice) : null;
    const loyaltyPrice = priceRow.loyaltyPrice !== null ? Number(priceRow.loyaltyPrice) : null;
    const now = Date.now();
    const promoActive =
      (!priceRow.promoValidFrom || priceRow.promoValidFrom.getTime() <= now) &&
      (!priceRow.promoValidTo || priceRow.promoValidTo.getTime() >= now);

    const candidates: Array<{ price: number; type: "base" | "promo" | "loyalty" }> = [{ price: basePrice, type: "base" }];
    if (promoPrice !== null && promoActive) candidates.push({ price: promoPrice, type: "promo" });
    if (loyaltyPrice !== null && (!priceRow.requiresMembership || useMembershipPricing)) candidates.push({ price: loyaltyPrice, type: "loyalty" });

    const picked = candidates.sort((left, right) => left.price - right.price)[0] ?? { price: basePrice, type: "base" as const };

    return {
      price: picked.price,
      usedPromo: picked.type === "promo",
      usedLoyalty: picked.type === "loyalty",
      membershipLocked: Boolean(priceRow.requiresMembership && loyaltyPrice !== null && !useMembershipPricing),
    };
  }

  const storeTotals = new Map<string, StoreTotal>();
  const storeStats = new Map<string, {
    coveredItems: number;
    freshnessSamples: number[];
    sources: Set<string>;
    promoAppliedItems: number;
    loyaltyAppliedItems: number;
    membershipLockedItems: number;
    membershipLockedProducts: Set<string>;
  }>();
  const priceDrivers: DriverItem[] = [];
  const freshnessSamples: number[] = [];
  const allSources = new Set<string>();
  const globallyFilteredOutlierStores = new Set<string>();
  let coveredItems = 0;
  let dataPoints = 0;
  const nowMs = Date.now();

  for (const item of shoppingList.items) {
    const latestByStore = new Map<string, {
      storeName: string;
      price: number;
      unitPrice: number;
      date: Date;
      source: string;
      usedPromo: boolean;
      usedLoyalty: boolean;
      membershipLocked: boolean;
    }>();

    for (const priceRow of item.product.prices) {
      if (latestByStore.has(priceRow.storeId)) continue;
      const effective = effectivePriceForRow(priceRow);
      latestByStore.set(priceRow.storeId, {
        storeName: priceRow.store.name,
        price: effective.price,
        unitPrice: Number(priceRow.unitPrice),
        date: priceRow.date,
        source: priceRow.source,
        usedPromo: effective.usedPromo,
        usedLoyalty: effective.usedLoyalty,
        membershipLocked: effective.membershipLocked,
      });
    }

    const priceEntries = Array.from(latestByStore.entries());
    const filteredEntries = filterLogicalPriceEntries(
      priceEntries.map(([storeId, entry]) => ({ storeId, entry })),
      (row) => row.entry.price,
      (row) => row.entry.unitPrice,
      {
        category: item.product.category,
        packageUnit: item.product.packageUnit,
        packageQuantity: item.product.packageQuantity,
      },
    );
    for (const outlierStoreId of Array.from(filteredEntries.outlierStoreIds.values())) {
      globallyFilteredOutlierStores.add(outlierStoreId);
    }
    const logicalPriceEntries = filteredEntries.validEntries.map((row) => [row.storeId, row.entry] as const);
    if (logicalPriceEntries.length === 0) continue;
    coveredItems += 1;
    dataPoints += logicalPriceEntries.length;

    let minPrice = Number.POSITIVE_INFINITY;
    let maxPrice = 0;

    for (const [storeId, entry] of logicalPriceEntries) {
      const totalForItem = entry.price * item.quantity;
      const ageDays = (nowMs - entry.date.getTime()) / (1000 * 60 * 60 * 24);
      freshnessSamples.push(ageDays);
      allSources.add(entry.source || "unknown");
      const stats = storeStats.get(storeId) ?? {
        coveredItems: 0,
        freshnessSamples: [],
        sources: new Set<string>(),
        promoAppliedItems: 0,
        loyaltyAppliedItems: 0,
        membershipLockedItems: 0,
        membershipLockedProducts: new Set<string>(),
      };
      stats.coveredItems += 1;
      stats.freshnessSamples.push(ageDays);
      stats.sources.add(entry.source || "unknown");
      if (entry.usedPromo) stats.promoAppliedItems += 1;
      if (entry.usedLoyalty) stats.loyaltyAppliedItems += 1;
      if (entry.membershipLocked) {
        stats.membershipLockedItems += 1;
        stats.membershipLockedProducts.add(item.product.name);
      }
      storeStats.set(storeId, stats);
      const existing = storeTotals.get(storeId);
      if (existing) {
        existing.totalPrice += totalForItem;
      } else {
        storeTotals.set(storeId, {
          storeId,
          storeName: entry.storeName,
          totalPrice: totalForItem,
          coveredItems: 0,
          averageAgeDays: null,
          newestHours: null,
          sourceCount: 0,
          promoAppliedItems: 0,
          loyaltyAppliedItems: 0,
          membershipLockedItems: 0,
          membershipLockedProducts: [],
        });
      }

      minPrice = Math.min(minPrice, entry.price);
      maxPrice = Math.max(maxPrice, entry.price);
    }

    const last7Cutoff = nowMs - 7 * 24 * 60 * 60 * 1000;
    const prev7Cutoff = nowMs - 14 * 24 * 60 * 60 * 1000;
    const last7 = item.product.prices
      .filter((priceRow) => priceRow.date.getTime() >= last7Cutoff)
      .map((priceRow) => effectivePriceForRow(priceRow).price);
    const previous7 = item.product.prices
      .filter((priceRow) => {
        const ts = priceRow.date.getTime();
        return ts >= prev7Cutoff && ts < last7Cutoff;
      })
      .map((priceRow) => effectivePriceForRow(priceRow).price);

    const avg = (values: number[]) => (values.length > 0 ? values.reduce((sum, value) => sum + value, 0) / values.length : null);
    const last7Avg = avg(last7);
    const previous7Avg = avg(previous7);
    const changePct =
      last7Avg !== null && previous7Avg !== null && previous7Avg > 0
        ? Number((((last7Avg - previous7Avg) / previous7Avg) * 100).toFixed(1))
        : null;

    const action: DriverItem["trend"]["action"] =
      changePct === null ? "ukjent" : changePct <= -3 ? "kjop-na" : changePct >= 3 ? "vent" : "ukjent";

    priceDrivers.push({
      productId: item.productId,
      productName: item.product.name,
      cheapestPrice: minPrice,
      highestPrice: maxPrice,
      difference: (maxPrice - minPrice) * item.quantity,
      trend: {
        last7Avg: last7Avg !== null ? Number(last7Avg.toFixed(2)) : null,
        previous7Avg: previous7Avg !== null ? Number(previous7Avg.toFixed(2)) : null,
        changePct,
        action,
      },
    });
  }

  const totals = Array.from(storeTotals.values())
    .map((entry) => {
      const stats = storeStats.get(entry.storeId);
      const averageAgeDays = stats && stats.freshnessSamples.length > 0
        ? Number((stats.freshnessSamples.reduce((sum, value) => sum + value, 0) / stats.freshnessSamples.length).toFixed(2))
        : null;
      const newestHours = stats && stats.freshnessSamples.length > 0
        ? Number((Math.min(...stats.freshnessSamples) * 24).toFixed(1))
        : null;

      return {
        ...entry,
        coveredItems: stats?.coveredItems ?? 0,
        averageAgeDays,
        newestHours,
        sourceCount: stats?.sources.size ?? 0,
        promoAppliedItems: stats?.promoAppliedItems ?? 0,
        loyaltyAppliedItems: stats?.loyaltyAppliedItems ?? 0,
        membershipLockedItems: stats?.membershipLockedItems ?? 0,
        membershipLockedProducts: stats ? Array.from(stats.membershipLockedProducts.values()) : [],
      };
    })
    .sort((a, b) => a.totalPrice - b.totalPrice);
  const cheapestStore = totals[0] ?? null;
  const mostExpensive = totals[totals.length - 1];
  const analyzedItems = shoppingList.items.length;
  const coverageRatio = analyzedItems > 0 ? coveredItems / analyzedItems : 0;
  const coverageScore = Math.round(coverageRatio * 100);

  let confidence: "lav" | "medium" | "hoy" = "lav";
  if (coverageRatio >= 0.8 && dataPoints >= analyzedItems * 3) confidence = "hoy";
  else if (coverageRatio >= 0.5 && dataPoints >= analyzedItems * 2) confidence = "medium";

  const averagePriceAgeDays = freshnessSamples.length > 0
    ? Number((freshnessSamples.reduce((sum, value) => sum + value, 0) / freshnessSamples.length).toFixed(2))
    : null;
  const newestObservationHours = freshnessSamples.length > 0
    ? Number((Math.min(...freshnessSamples) * 24).toFixed(1))
    : null;
  const sourceDiversity = allSources.size;
  const freshnessScore = averagePriceAgeDays === null ? 0 : Math.max(0, Math.min(100, Math.round((1 - averagePriceAgeDays / 14) * 100)));
  const sourceScore = Math.max(0, Math.min(100, sourceDiversity * 25));
  const trustScore = Math.round(coverageScore * 0.5 + freshnessScore * 0.3 + sourceScore * 0.2);

  const minCoveredForRecommendation = Math.max(3, Math.ceil(analyzedItems * 0.6));
  const shouldAutoRecommend = Boolean(
    cheapestStore &&
      (
        confidence === "hoy" ||
        (confidence === "medium" && coveredItems >= minCoveredForRecommendation)
      ),
  );

  const buyNowCount = priceDrivers.filter((item) => item.trend.action === "kjop-na").length;
  const waitCount = priceDrivers.filter((item) => item.trend.action === "vent").length;
  const neutralCount = Math.max(0, priceDrivers.length - buyNowCount - waitCount);
  const buyNowValue = Number(
    priceDrivers
      .filter((item) => item.trend.action === "kjop-na")
      .reduce((sum, item) => sum + item.difference, 0)
      .toFixed(2),
  );
  const waitValue = Number(
    priceDrivers
      .filter((item) => item.trend.action === "vent")
      .reduce((sum, item) => sum + item.difference, 0)
      .toFixed(2),
  );

  const riskFlags: string[] = [];
  if (coverageScore < 65) riskFlags.push("Lav handleliste-dekning gir hoyere beslutningsrisiko.");
  if ((averagePriceAgeDays ?? 99) > 3) riskFlags.push("Prisgrunnlaget er eldre enn 3 dager i snitt.");
  if (sourceDiversity < 2) riskFlags.push("Lav kildediversitet for denne sammenligningen.");
  if (globallyFilteredOutlierStores.size > 0) riskFlags.push(`${globallyFilteredOutlierStores.size} butikkdatasett ble filtrert som prisavvik.`);
  if ((cheapestStore?.membershipLockedItems ?? 0) > 0) riskFlags.push("Noen gevinster krever medlemspris.");

  const why: string[] = [];
  if (cheapestStore) {
    why.push(`Billigste observerte total er ${Number(cheapestStore.totalPrice.toFixed(2))} hos ${cheapestStore.storeName}.`);
  }
  why.push(`Dekning ${coveredItems}/${analyzedItems} varer med ${dataPoints} datapunkter.`);
  why.push(`Tillitsscore ${trustScore}/100 basert pa dekning, prisalder og kildediversitet.`);

  const nextActions: string[] = [];
  if (!shouldAutoRecommend) {
    nextActions.push("Last opp en kvittering for a styrke verifisert matching.");
    nextActions.push("Legg til flere varer i handlelisten for bredere dekning.");
  }
  if (waitCount > buyNowCount) {
    nextActions.push("Sett prisvarsel pa varene med vent-signal for bedre kjopstidspunkt.");
  }
  if ((cheapestStore?.membershipLockedItems ?? 0) > 0) {
    nextActions.push("Aktiver medlemspriser i preferanser hvis du har medlemskap.");
  }
  if (nextActions.length === 0) {
    nextActions.push("Kjor planen i dag og verifiser resultatet med kvittering etter handel.");
  }

  const recommendation = shouldAutoRecommend
    ? {
        shouldAutoRecommend: true,
        mode: "strong" as const,
        message: "Datagrunnlaget er sterkt nok til en tydelig anbefaling i dag.",
        recommendedStore: cheapestStore,
        why,
        riskFlags,
        nextActions,
        timingSummary: {
          buyNow: buyNowCount,
          wait: waitCount,
          neutral: neutralCount,
        },
        timingImpact: {
          buyNowValue,
          waitValue,
        },
      }
    : {
        shouldAutoRecommend: false,
        mode: "guarded" as const,
        message: "Datagrunnlaget er fortsatt for svakt til en hard anbefaling. Bruk sammenligningen som veiledning.",
        recommendedStore: null,
        why,
        riskFlags,
        nextActions,
        timingSummary: {
          buyNow: buyNowCount,
          wait: waitCount,
          neutral: neutralCount,
        },
        timingImpact: {
          buyNowValue,
          waitValue,
        },
      };

  return {
    cheapestStore,
    totals: totals.map((entry) => ({ ...entry, totalPrice: Number(entry.totalPrice.toFixed(2)) })),
    estimatedSavings: cheapestStore && mostExpensive ? Number((mostExpensive.totalPrice - cheapestStore.totalPrice).toFixed(2)) : 0,
    priceyDrivers: priceDrivers.sort((a, b) => b.difference - a.difference).slice(0, 5),
    analyzedItems,
    coveredItems,
    coverageScore,
    dataPoints,
    confidence,
    trustMetrics: {
      trustScore,
      averagePriceAgeDays,
      newestObservationHours,
      sourceDiversity,
      comparedStores: totals.length,
      filteredOutlierStores: globallyFilteredOutlierStores.size,
    },
    recommendation,
  };
}
