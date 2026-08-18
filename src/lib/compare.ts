import { prisma } from "@/lib/prisma";
import { filterLogicalPriceEntries } from "@/lib/pricing-sanity";
import { assessPriceRowQuality } from "@/lib/price-quality";
import { buildBuyWindowPrediction } from "@/lib/price-prediction";
import {
  deriveMaxTravelKm,
  haversineKm,
  resolvePostalCodeCoordinates,
  sanitizePostalCode,
  sanitizePostalPrefix,
  toCoordinates,
} from "@/lib/geo";

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

function normalizeChainName(chain: string | null | undefined, fallback: string) {
  const value = (chain ?? "").trim();
  if (!value) return fallback;
  return value.toUpperCase();
}

function median(values: number[]) {
  if (values.length === 0) return null;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  if (sorted.length % 2 === 0) {
    return (sorted[mid - 1] + sorted[mid]) / 2;
  }
  return sorted[mid];
}

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
    buyWindowScore: number | null;
    confidencePct: number | null;
    windowHint: string;
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
    qualityScore: number;
    qualityCheckedRows: number;
    qualityRejectedRows: number;
    qualitySignals: Record<string, number>;
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
  personalization: {
    postalFilter: string | null;
    filteredStoreCount: number;
    availableStoreCount: number;
  };
  pricingTruth: {
    promoAppliedItems: number;
    loyaltyAppliedItems: number;
    membershipLockedItems: number;
  };
};

export async function compareShoppingList(
  shoppingListId: string,
  options?: {
    postalPrefix?: string | null;
    postalCode?: string | null;
    travelMode?: "DRIVE" | "WALK" | null;
    maxTravelMinutes?: number | null;
    maxTravelKm?: number | null;
  },
): Promise<CompareResult> {
  const normalizedPostalPrefixOption = sanitizePostalPrefix(options?.postalPrefix ?? null) || null;
  const normalizedPostalCodeOption = sanitizePostalCode(options?.postalCode ?? null) || null;
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
                take: 320,
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
        qualityScore: 0,
        qualityCheckedRows: 0,
        qualityRejectedRows: 0,
        qualitySignals: {},
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
        nextActions: ["Legg til minst 3 varer i handlelisten for å aktivere anbefaling."],
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
      personalization: {
        postalFilter: normalizedPostalPrefixOption ?? (normalizedPostalCodeOption ? normalizedPostalCodeOption.slice(0, 1) : null),
        filteredStoreCount: 0,
        availableStoreCount: 0,
      },
      pricingTruth: {
        promoAppliedItems: 0,
        loyaltyAppliedItems: 0,
        membershipLockedItems: 0,
      },
    };
  }

  const preferencePostalCode = sanitizePostalCode(shoppingList.user.preference?.postalCode ?? null) || null;
  const preferencePostalPrefix = sanitizePostalPrefix(shoppingList.user.preference?.postalPrefix ?? null) || null;
  const normalizedPostalCode = normalizedPostalCodeOption ?? preferencePostalCode;
  const normalizedPostalPrefix = normalizedPostalPrefixOption ?? (normalizedPostalCode ? normalizedPostalCode.slice(0, 1) : preferencePostalPrefix);
  const travelMode = options?.travelMode ?? shoppingList.user.preference?.travelMode ?? "DRIVE";
  const maxTravelKm = deriveMaxTravelKm({
    travelMode,
    maxTravelKm: options?.maxTravelKm ?? shoppingList.user.preference?.maxTravelKm ?? null,
    maxTravelMinutes: options?.maxTravelMinutes ?? shoppingList.user.preference?.maxTravelMinutes ?? null,
  });

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
  const allChainsEncountered = new Set<string>();
  const filteredChainsEncountered = new Set<string>();
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
  const rowQualitySignals = new Map<string, number>();
  let qualityCheckedRows = 0;
  let qualityRejectedRows = 0;
  let coveredItems = 0;
  let dataPoints = 0;
  const nowMs = Date.now();

  const knownStores = new Map<string, {
    chainName: string;
    postalCode: string | null;
    latitude: number | null;
    longitude: number | null;
  }>();

  for (const item of shoppingList.items) {
    for (const priceRow of item.product.prices) {
      const chainKey = normalizeChainName(priceRow.store.chain, priceRow.store.name);
      if (!knownStores.has(priceRow.storeId)) {
        knownStores.set(priceRow.storeId, {
          chainName: chainKey,
          postalCode: priceRow.store.postalCode,
          latitude: priceRow.store.latitude,
          longitude: priceRow.store.longitude,
        });
      }
      allChainsEncountered.add(chainKey);
    }
  }

  let accessibleChains = new Set<string>(allChainsEncountered);
  const userCoordinates = await resolvePostalCodeCoordinates(normalizedPostalCode);
  const hasDistanceConstraints = Boolean(userCoordinates && maxTravelKm !== null);

  if (hasDistanceConstraints && userCoordinates && maxTravelKm !== null) {
    accessibleChains = new Set<string>();
    const storeEntries = Array.from(knownStores.values());
    const resolvedStoreCoordinates = await Promise.all(
      storeEntries.map(async (store) => {
        const directCoordinates = toCoordinates({ latitude: store.latitude, longitude: store.longitude });
        if (directCoordinates) return { store, coordinates: directCoordinates };
        const postalCoordinates = await resolvePostalCodeCoordinates(store.postalCode);
        return { store, coordinates: postalCoordinates };
      }),
    );

    for (const entry of resolvedStoreCoordinates) {
      if (!entry.coordinates) continue;
      const distanceKm = haversineKm(userCoordinates, entry.coordinates);
      if (distanceKm <= maxTravelKm) {
        accessibleChains.add(entry.store.chainName);
      }
    }
  }

  if (accessibleChains.size === 0 && normalizedPostalPrefix) {
    for (const store of Array.from(knownStores.values())) {
      if ((store.postalCode ?? "").startsWith(normalizedPostalPrefix)) {
        accessibleChains.add(store.chainName);
      }
    }
  }

  if (accessibleChains.size === 0) {
    accessibleChains = new Set<string>(allChainsEncountered);
  }

  for (const item of shoppingList.items) {
    const latestByStore = new Map<string, {
      storeName: string;
      chainName: string;
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

      const quality = assessPriceRowQuality({
        productName: item.product.name,
        productBrand: item.product.brand,
        source: priceRow.source,
        sourceUrl: priceRow.sourceUrl,
        packageQuantity: item.product.packageQuantity,
        packageUnit: item.product.packageUnit,
        price: Number(priceRow.price),
        unitPrice: Number(priceRow.unitPrice),
      });

      qualityCheckedRows += 1;
      if (!quality.accepted) {
        qualityRejectedRows += 1;
        for (const reason of quality.reasons) {
          rowQualitySignals.set(reason, (rowQualitySignals.get(reason) ?? 0) + 1);
        }
        continue;
      }

      const effective = effectivePriceForRow(priceRow);
      const chainName = normalizeChainName(priceRow.store.chain, priceRow.store.name);
      latestByStore.set(priceRow.storeId, {
        storeName: priceRow.store.name,
        chainName,
        price: effective.price,
        unitPrice: Number(priceRow.unitPrice),
        date: priceRow.date,
        source: priceRow.source,
        usedPromo: effective.usedPromo,
        usedLoyalty: effective.usedLoyalty,
        membershipLocked: effective.membershipLocked,
      });
    }

    const priceEntries = Array.from(latestByStore.entries()).filter(([, entry]) => {
      return accessibleChains.has(entry.chainName);
    });
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
    const logicalPriceEntries = filteredEntries.validEntries.map((row) => row.entry);

    const chainGroups = new Map<string, {
      prices: number[];
      unitPrices: number[];
      dates: Date[];
      sources: string[];
      promoUsed: boolean;
      loyaltyUsed: boolean;
      membershipLocked: boolean;
    }>();

    for (const entry of logicalPriceEntries) {
      filteredChainsEncountered.add(entry.chainName);
      const bucket = chainGroups.get(entry.chainName) ?? {
        prices: [],
        unitPrices: [],
        dates: [],
        sources: [],
        promoUsed: false,
        loyaltyUsed: false,
        membershipLocked: false,
      };
      bucket.prices.push(entry.price);
      bucket.unitPrices.push(entry.unitPrice);
      bucket.dates.push(entry.date);
      bucket.sources.push(entry.source || "unknown");
      if (entry.usedPromo) bucket.promoUsed = true;
      if (entry.usedLoyalty) bucket.loyaltyUsed = true;
      if (entry.membershipLocked) bucket.membershipLocked = true;
      chainGroups.set(entry.chainName, bucket);
    }

    const chainEntries = Array.from(chainGroups.entries())
      .map(([chainName, bucket]) => {
        const chainPrice = median(bucket.prices);
        const chainUnitPrice = median(bucket.unitPrices);
        if (chainPrice === null || chainUnitPrice === null) return null;
        const latestDate = bucket.dates.sort((a, b) => b.getTime() - a.getTime())[0] ?? new Date();
        return {
          chainName,
          price: chainPrice,
          unitPrice: chainUnitPrice,
          date: latestDate,
          source: bucket.sources[0] ?? "unknown",
          usedPromo: bucket.promoUsed,
          usedLoyalty: bucket.loyaltyUsed,
          membershipLocked: bucket.membershipLocked,
        };
      })
      .filter((entry): entry is NonNullable<typeof entry> => Boolean(entry));

    if (chainEntries.length === 0) continue;
    coveredItems += 1;
    dataPoints += chainEntries.length;

    let minPrice = Number.POSITIVE_INFINITY;
    let maxPrice = 0;

    for (const entry of chainEntries) {
      const chainId = entry.chainName;
      const totalForItem = entry.price * item.quantity;
      const ageDays = (nowMs - entry.date.getTime()) / (1000 * 60 * 60 * 24);
      freshnessSamples.push(ageDays);
      allSources.add(entry.source || "unknown");
      const stats = storeStats.get(chainId) ?? {
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
      storeStats.set(chainId, stats);
      const existing = storeTotals.get(chainId);
      if (existing) {
        existing.totalPrice += totalForItem;
      } else {
        storeTotals.set(chainId, {
          storeId: chainId,
          storeName: chainId,
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

    const prediction = buildBuyWindowPrediction(
      item.product.prices.map((priceRow) => ({
        price: effectivePriceForRow(priceRow).price,
        date: priceRow.date,
      })),
    );
    const action: DriverItem["trend"]["action"] = prediction.action;
    const confidencePct = prediction.confidencePct;
    const buyWindowScore = prediction.buyWindowScore;
    const windowHint = prediction.windowHint;

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
        buyWindowScore,
        confidencePct,
        windowHint,
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
  const qualityScore = qualityCheckedRows > 0 ? Math.round(((qualityCheckedRows - qualityRejectedRows) / qualityCheckedRows) * 100) : 0;
  const trustScore = Math.round(coverageScore * 0.45 + freshnessScore * 0.25 + sourceScore * 0.15 + qualityScore * 0.15);

  const minCoveredForRecommendation = Math.max(3, Math.ceil(analyzedItems * 0.6));
  const shouldAutoRecommend = Boolean(
    cheapestStore &&
      (
        confidence === "hoy" ||
        (confidence === "medium" && coveredItems >= minCoveredForRecommendation)
      ) &&
      qualityScore >= 70,
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
  if (coverageScore < 65) riskFlags.push("Lav handleliste-dekning gir høyere beslutningsrisiko.");
  if ((averagePriceAgeDays ?? 99) > 3) riskFlags.push("Prisgrunnlaget er eldre enn 3 dager i snitt.");
  if (sourceDiversity < 2) riskFlags.push("Lav kildediversitet for denne sammenligningen.");
  if (qualityScore < 70) riskFlags.push("For mange prisrader ble avvist i kvalitetskontrollen av produktmatch.");
  if (globallyFilteredOutlierStores.size > 0) riskFlags.push(`${globallyFilteredOutlierStores.size} kjededatasett ble filtrert som prisavvik.`);
  if ((cheapestStore?.membershipLockedItems ?? 0) > 0) riskFlags.push("Noen gevinster krever medlemspris.");

  const why: string[] = [];
  if (cheapestStore) {
    why.push(`Billigste observerte total er ${Number(cheapestStore.totalPrice.toFixed(2))} hos ${cheapestStore.storeName}.`);
  }
  why.push(`Dekning ${coveredItems}/${analyzedItems} varer med ${dataPoints} datapunkter.`);
  why.push(`Tillitsscore ${trustScore}/100 basert på dekning, prisalder, kildediversitet og kvalitetsmatch.`);

  const nextActions: string[] = [];
  if (!shouldAutoRecommend) {
    nextActions.push("Last opp en kvittering for å styrke verifisert matching.");
    nextActions.push("Legg til flere varer i handlelisten for bredere dekning.");
  }
  if (waitCount > buyNowCount) {
    nextActions.push("Sett prisvarsel på varene med vent-signal for bedre kjøpstidspunkt.");
  }
  if (qualityScore < 70) {
    nextActions.push("Forbedre datakvalitet: prioriter kjeder og varer med svak produktmatch i kilde-URLer.");
  }
  if ((cheapestStore?.membershipLockedItems ?? 0) > 0) {
    nextActions.push("Aktiver medlemspriser i preferanser hvis du har medlemskap.");
  }
  if (nextActions.length === 0) {
    nextActions.push("Kjør planen i dag og verifiser resultatet med kvittering etter handel.");
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

  const promoAppliedItems = totals.reduce((sum, row) => sum + row.promoAppliedItems, 0);
  const loyaltyAppliedItems = totals.reduce((sum, row) => sum + row.loyaltyAppliedItems, 0);
  const membershipLockedItems = totals.reduce((sum, row) => sum + row.membershipLockedItems, 0);

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
      qualityScore,
      qualityCheckedRows,
      qualityRejectedRows,
      qualitySignals: Object.fromEntries(Array.from(rowQualitySignals.entries()).sort((a, b) => b[1] - a[1])),
      averagePriceAgeDays,
      newestObservationHours,
      sourceDiversity,
      comparedStores: totals.length,
      filteredOutlierStores: globallyFilteredOutlierStores.size,
    },
    recommendation,
    personalization: {
      postalFilter: normalizedPostalPrefix,
      filteredStoreCount:
        normalizedPostalPrefix || hasDistanceConstraints ? filteredChainsEncountered.size : allChainsEncountered.size,
      availableStoreCount: allChainsEncountered.size,
    },
    pricingTruth: {
      promoAppliedItems,
      loyaltyAppliedItems,
      membershipLockedItems,
    },
  };
}
