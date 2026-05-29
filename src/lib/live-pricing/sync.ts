import { Prisma, PrismaClient } from "@prisma/client";

import { prisma } from "@/lib/prisma";
import { derivePackageMetadata } from "@/lib/package-metadata";

import { liveCatalog } from "./catalog";
import { buildSearchQuery, scoreTextMatch } from "./helpers";
import { odaProvider } from "./providers/oda";
import { menyProvider } from "./providers/meny";
import { sparProvider } from "./providers/spar";
import { jokerProvider } from "./providers/joker";
import { foodoraProvider } from "./providers/foodora";
import { woltProvider } from "./providers/wolt";
import { isLikelyProductImageUrl, shouldReplaceExistingImage } from "./providers/media";
import type { LivePriceCandidate, LivePriceProvider } from "./providers/types";

const providers: LivePriceProvider[] = [odaProvider, menyProvider, sparProvider, jokerProvider, foodoraProvider, woltProvider];
const norgesgruppenProviders = new Set(["meny", "spar", "joker"]);

const MAX_PRODUCTS = Number(process.env.LIVE_PRICING_MAX_PRODUCTS ?? 80);
const SKIP_DUPLICATE_WITHIN_HOURS = Number(process.env.LIVE_PRICING_MIN_INTERVAL_HOURS ?? 6);

type SyncItem = {
  productId: string;
  productName: string;
  provider: string;
  storeName: string;
  price: number;
  unitPrice: number;
  url: string;
  imageUrl?: string | null;
};

type SyncProduct = {
  id: string;
  name: string;
  brand: string;
  category: string;
  imageUrl: string | null;
  packageQuantity: number | null;
  packageUnit: "G" | "ML" | "STK" | null;
};

type SyncLivePriceOptions = {
  allowedChains?: string[];
  productIds?: string[];
  maxProducts?: number;
};

type ProviderRuntimeState = {
  provider: LivePriceProvider;
  attemptedProducts: number;
  matchedProducts: number;
  matchedPrices: number;
  skippedDuplicates: number;
  consecutiveMisses: number;
  disabled: boolean;
  disabledReason: string | null;
  degradedFromHistory: boolean;
  recentRows7d: number;
  latestObservationHours: number | null;
};

type PackHint = {
  value: number;
  unit: string;
};

type NormalizedPackHint = {
  value: number;
  baseUnit: "g" | "ml" | "stk";
};

type PackageCompatibility = "match" | "mismatch" | "unknown";

function normalizeTokenText(value: string) {
  return value
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/æ/g, "ae")
    .replace(/ø/g, "o")
    .replace(/å/g, "a")
    .replace(/[^a-z0-9]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function extractPercentHint(text: string) {
  const match = text
    .toLowerCase()
    .replace(/\s+/g, "")
    .match(/(\d+(?:[.,]\d+)?)%/);
  if (!match?.[1]) return null;

  const value = Number(match[1].replace(",", "."));
  return Number.isFinite(value) ? value : null;
}

function fatPercentageCompatible(productText: string, candidateText: string) {
  const productPercent = extractPercentHint(productText);
  const candidatePercent = extractPercentHint(candidateText);
  if (productPercent === null || candidatePercent === null) return true;
  return Math.abs(productPercent - candidatePercent) <= 0.2;
}

function hasModifierToken(text: string, token: string) {
  return normalizeTokenText(text).split(" ").includes(token);
}

function variantModifiersCompatible(productText: string, candidateText: string) {
  const trackedModifiers = ["laktosefri", "okologisk", "protein", "barista"];

  for (const token of trackedModifiers) {
    const inProduct = hasModifierToken(productText, token);
    const inCandidate = hasModifierToken(candidateText, token);
    if (inProduct !== inCandidate) {
      return false;
    }
  }

  return true;
}

function tokenOverlapRatio(left: string, right: string) {
  const noiseTokens = new Set(["g", "kg", "ml", "l", "stk", "pk"]);
  const leftTokens = new Set(
    normalizeTokenText(left)
      .split(" ")
      .filter((token) => token && !noiseTokens.has(token) && !/^\d+(?:[.,]\d+)?$/.test(token)),
  );
  const rightTokens = new Set(
    normalizeTokenText(right)
      .split(" ")
      .filter((token) => token && !noiseTokens.has(token) && !/^\d+(?:[.,]\d+)?$/.test(token)),
  );
  if (leftTokens.size === 0 || rightTokens.size === 0) return 0;

  let overlap = 0;
  for (const token of Array.from(leftTokens)) {
    if (rightTokens.has(token)) overlap += 1;
  }

  return overlap / leftTokens.size;
}

const categoryKeywords: Record<string, string[]> = {
  meieri: ["meieri", "melk", "yoghurt", "ost", "smor", "egg"],
  bakeri: ["bakeri", "brod", "rundstykke", "baguette"],
  gront: ["gront", "gronnsak", "frukt", "banan", "tomat", "agurk", "potet", "eple"],
  kjott: ["kjott", "kylling", "svin", "storfe", "fisk"],
  middag: ["middag", "pasta", "spagetti", "ris", "saus", "ferdig"],
};

function inferCategoryGroup(text: string) {
  const normalized = normalizeTokenText(text);

  for (const [group, keywords] of Object.entries(categoryKeywords)) {
    if (keywords.some((keyword) => normalized.includes(keyword))) {
      return group;
    }
  }

  return null;
}

function extractPackHint(text: string): PackHint | null {
  const match = text.toLowerCase().match(/(\d+(?:[.,]\d+)?)\s*(kg|g|l|ml|stk|pk|pakke)/i);
  if (!match?.[1] || !match[2]) return null;
  const value = Number(match[1].replace(",", "."));
  if (!Number.isFinite(value)) return null;
  return { value, unit: match[2] };
}

function comparableUnit(unit: string) {
  if (unit === "pk" || unit === "pakke") return "stk";
  return unit;
}

function normalizePackHint(hint: PackHint): NormalizedPackHint | null {
  const unit = comparableUnit(hint.unit.toLowerCase());

  if (unit === "kg") return { value: hint.value * 1000, baseUnit: "g" };
  if (unit === "g") return { value: hint.value, baseUnit: "g" };
  if (unit === "l") return { value: hint.value * 1000, baseUnit: "ml" };
  if (unit === "ml") return { value: hint.value, baseUnit: "ml" };
  if (unit === "stk") return { value: hint.value, baseUnit: "stk" };

  return null;
}

function packHintCompatible(productText: string, candidateText: string) {
  const left = extractPackHint(productText);
  const right = extractPackHint(candidateText);
  if (!left || !right) return true;

  const normalizedLeft = normalizePackHint(left);
  const normalizedRight = normalizePackHint(right);
  if (!normalizedLeft || !normalizedRight) return true;
  if (normalizedLeft.baseUnit !== normalizedRight.baseUnit) return false;

  const maxValue = Math.max(normalizedLeft.value, normalizedRight.value);
  const tolerance = normalizedLeft.baseUnit === "stk" ? 0.35 : Math.max(60, maxValue * 0.12);
  return Math.abs(normalizedLeft.value - normalizedRight.value) <= tolerance;
}

function evaluatePackageCompatibility(product: SyncProduct, candidateText: string): PackageCompatibility {
  if (!product.packageQuantity || !product.packageUnit) return "unknown";

  const right = extractPackHint(candidateText);
  if (!right) return "unknown";

  const candidateHint = normalizePackHint(right);
  if (!candidateHint) return "unknown";

  const productBaseUnit = product.packageUnit === "G" ? "g" : product.packageUnit === "ML" ? "ml" : "stk";
  if (candidateHint.baseUnit !== productBaseUnit) return "mismatch";

  const maxValue = Math.max(product.packageQuantity, candidateHint.value);
  const tolerance = candidateHint.baseUnit === "stk" ? 0.15 : Math.max(40, maxValue * 0.07);
  return Math.abs(product.packageQuantity - candidateHint.value) <= tolerance ? "match" : "mismatch";
}

function isSyncableProduct(product: SyncProduct) {
  const genericName = /^vare\s*\d+$/i.test(product.name.trim());
  const genericBrand = /^(merke|brand|ukjent)$/i.test(product.brand.trim());
  return !genericName && !genericBrand;
}

function shouldReplaceProductImage(existingImageUrl: string | null, candidateImageUrl: string | null | undefined) {
  if (!isLikelyProductImageUrl(candidateImageUrl)) return false;
  return shouldReplaceExistingImage(existingImageUrl);
}

function pickBestCandidate(product: SyncProduct, query: string, candidates: LivePriceCandidate[]) {
  let bestCandidate: LivePriceCandidate | null = null;
  let bestScore = 0;
  const productText = buildSearchQuery([product.brand, product.name, product.category]);

  for (const candidate of candidates) {
    const candidateText = buildSearchQuery([candidate.title, candidate.details]);
    const baseScore = scoreTextMatch(query, candidateText);
    const nameOverlap = tokenOverlapRatio(product.name, candidate.title);
    const brandOverlap = tokenOverlapRatio(product.brand, candidateText);
    const packageCompatibility = evaluatePackageCompatibility(product, candidateText);
    const productCategoryGroup = inferCategoryGroup(product.category);
    const candidateCategoryGroup = inferCategoryGroup(candidateText);

    if (!variantModifiersCompatible(productText, candidateText)) {
      continue;
    }

    if (!fatPercentageCompatible(productText, candidateText)) {
      continue;
    }

    if (!packHintCompatible(product.name, candidateText)) {
      continue;
    }

    if (packageCompatibility === "mismatch") {
      continue;
    }

    if (productCategoryGroup && candidateCategoryGroup && productCategoryGroup !== candidateCategoryGroup && nameOverlap < 0.6) {
      continue;
    }

    const score = baseScore + nameOverlap * 2 + brandOverlap + (packageCompatibility === "match" ? 0.6 : 0);

    // Keep mismatch protection, but allow slightly looser overlap for real-world catalog naming variants.
    const hasSemanticAnchor =
      nameOverlap >= 0.24 ||
      baseScore >= 4 ||
      (brandOverlap >= 0.34 && baseScore >= 2);
    if (!hasSemanticAnchor) {
      continue;
    }

    const needsStrongAnchorForUnknownPackage =
      Boolean(product.packageQuantity && product.packageUnit) && packageCompatibility === "unknown";
    if (needsStrongAnchorForUnknownPackage) {
      const strongAnchor = nameOverlap >= 0.52 || baseScore >= 5 || (nameOverlap >= 0.42 && brandOverlap >= 0.3);
      if (!strongAnchor) {
        continue;
      }
    }

    if (score > bestScore) {
      bestScore = score;
      bestCandidate = candidate;
    }
  }

  return bestCandidate ? { candidate: bestCandidate, score: bestScore } : null;
}

async function ensureStore(client: PrismaClient, provider: LivePriceProvider) {
  const existingStore = await client.store.findFirst({
    where: { name: provider.storeName },
  });

  if (existingStore) {
    return client.store.update({
      where: { id: existingStore.id },
      data: {
        chain: provider.chain,
        location: provider.location,
      },
    });
  }

  return client.store.create({
    data: {
      name: provider.storeName,
      chain: provider.chain,
      location: provider.location,
    },
  });
}

async function ensureLiveProduct(client: PrismaClient, item: (typeof liveCatalog)[number]) {
  const derivedPackage = derivePackageMetadata(item.name);

  return client.product.upsert({
    where: { ean: item.ean },
    update: {
      name: item.name,
      brand: item.brand,
      category: item.category,
      imageUrl: item.imageUrl,
      packageQuantity: item.packageQuantity ?? derivedPackage.packageQuantity,
      packageUnit: item.packageUnit ?? derivedPackage.packageUnit,
    },
    create: {
      ean: item.ean,
      name: item.name,
      brand: item.brand,
      category: item.category,
      imageUrl: item.imageUrl,
      packageQuantity: item.packageQuantity ?? derivedPackage.packageQuantity,
      packageUnit: item.packageUnit ?? derivedPackage.packageUnit,
    },
  });
}

function buildProductQueries(product: SyncProduct) {
  const compactName = product.name.replace(/\b\d+(?:[.,]\d+)?\s*(?:g|kg|ml|l|stk|pk)\b/gi, "").trim();
  const coreTokens = normalizeTokenText(product.name)
    .split(" ")
    .filter((token) => token.length >= 3 && !/^\d+(?:[.,]\d+)?$/.test(token) && !["kg", "g", "l", "ml", "stk", "pk"].includes(token));
  const coreQuery = coreTokens.slice(0, 2).join(" ");

  const raw = [
    buildSearchQuery([product.brand, product.name]),
    buildSearchQuery([product.name]),
    compactName ? buildSearchQuery([product.brand, compactName]) : null,
    compactName || null,
    product.packageQuantity && product.packageUnit
      ? buildSearchQuery([
          product.brand,
          compactName || product.name,
          `${(product.packageUnit === "ML" || product.packageUnit === "G") ? Number((product.packageQuantity / 1000).toFixed(2)).toString().replace(".", ",") : product.packageQuantity} ${product.packageUnit === "ML" ? "l" : product.packageUnit === "G" ? "kg" : "stk"}`,
        ])
      : null,
    coreQuery || null,
  ];

  const seen = new Set<string>();
  const queries: string[] = [];

  for (const query of raw) {
    if (!query) continue;
    const key = query.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    queries.push(query);
  }

  return queries;
}

async function listProductsToSync(client: PrismaClient, options?: SyncLivePriceOptions): Promise<SyncProduct[]> {
  const seeded = await Promise.all(liveCatalog.map((item) => ensureLiveProduct(client, item)));
  const productIdSet = options?.productIds?.length ? new Set(options.productIds) : null;
  const take = Math.max(options?.maxProducts ?? MAX_PRODUCTS, 1);

  const fromDb = await client.product.findMany({
    ...(productIdSet ? { where: { id: { in: Array.from(productIdSet) } } } : {}),
    orderBy: { updatedAt: "desc" },
    take,
    select: {
      id: true,
      name: true,
      brand: true,
      category: true,
      imageUrl: true,
      packageQuantity: true,
      packageUnit: true,
    },
  });

  const merged = new Map<string, SyncProduct>();
  for (const product of [...seeded, ...fromDb]) {
    merged.set(product.id, {
      id: product.id,
      name: product.name,
      brand: product.brand,
      category: product.category,
      imageUrl: product.imageUrl,
      packageQuantity: product.packageQuantity,
      packageUnit: product.packageUnit,
    });
  }

  return Array.from(merged.values())
    .filter((product) => (productIdSet ? productIdSet.has(product.id) : true))
    .filter(isSyncableProduct)
    .slice(0, take);
}

async function shouldCreatePriceRow(
  client: PrismaClient,
  input: {
    productId: string;
    storeId: string;
    source: string;
    price: number;
    unitPrice: number;
    now: Date;
  },
) {
  const latest = await client.price.findFirst({
    where: {
      productId: input.productId,
      storeId: input.storeId,
      source: input.source,
    },
    orderBy: { date: "desc" },
  });

  if (!latest) return true;

  const samePrice = Number(latest.price) === input.price && Number(latest.unitPrice) === input.unitPrice;
  if (!samePrice) return true;

  const diffMs = input.now.getTime() - latest.date.getTime();
  const minIntervalMs = SKIP_DUPLICATE_WITHIN_HOURS * 60 * 60 * 1000;
  return diffMs >= minIntervalMs;
}

async function buildProviderRuntimeState(client: PrismaClient, selectedProviders: LivePriceProvider[]) {
  const now = Date.now();
  const sevenDaysAgo = new Date(now - 7 * 24 * 60 * 60 * 1000);

  const states = await Promise.all(
    selectedProviders.map(async (provider) => {
      const [recentRows7d, latestRow] = await Promise.all([
        client.price.count({
          where: {
            source: provider.provider,
            date: { gte: sevenDaysAgo },
          },
        }),
        client.price.findFirst({
          where: { source: provider.provider },
          orderBy: { date: "desc" },
          select: { date: true },
        }),
      ]);

      const latestObservationHours = latestRow
        ? Number(((now - latestRow.date.getTime()) / (1000 * 60 * 60)).toFixed(1))
        : null;

      const degradedFromHistory = Boolean(
        (latestObservationHours !== null && latestObservationHours > 96) ||
          (latestObservationHours !== null && latestObservationHours > 48 && recentRows7d === 0) ||
          (norgesgruppenProviders.has(provider.provider) && recentRows7d === 0),
      );

      const state: ProviderRuntimeState = {
        provider,
        attemptedProducts: 0,
        matchedProducts: 0,
        matchedPrices: 0,
        skippedDuplicates: 0,
        consecutiveMisses: degradedFromHistory ? 2 : 0,
        disabled: false,
        disabledReason: null,
        degradedFromHistory,
        recentRows7d,
        latestObservationHours,
      };

      return state;
    }),
  );

  return new Map(states.map((state) => [state.provider.provider, state]));
}

export async function syncLivePrices(client: PrismaClient = prisma, options?: SyncLivePriceOptions) {
  const createdAt = new Date();
  const results: SyncItem[] = [];
  let skippedDuplicates = 0;

  const allowedChainSet = options?.allowedChains?.length
    ? new Set(options.allowedChains.map((chain) => chain.trim().toLowerCase()).filter(Boolean))
    : null;

  const selectedProviders = providers.filter((provider) =>
    allowedChainSet ? allowedChainSet.has(provider.chain.trim().toLowerCase()) : true,
  );

  const products = await listProductsToSync(client, options);
  if (selectedProviders.length === 0 || products.length === 0) {
    return {
      productsEvaluated: products.length,
      providersEvaluated: selectedProviders.length,
      matchedPrices: 0,
      skippedDuplicates: 0,
      providerMetrics: [],
      results,
    };
  }

  const stores = await Promise.all(selectedProviders.map((provider) => ensureStore(client, provider)));
  const storeLookup = new Map(selectedProviders.map((provider, index) => [provider.provider, stores[index]]));
  const providerState = await buildProviderRuntimeState(client, selectedProviders);
  const ngColdStart = Array.from(providerState.values()).some(
    (state) => norgesgruppenProviders.has(state.provider.provider) && state.recentRows7d === 0,
  );
  const orderedProviders = [...selectedProviders].sort((left, right) => {
    const leftState = providerState.get(left.provider);
    const rightState = providerState.get(right.provider);
    const leftRows = leftState?.recentRows7d ?? 0;
    const rightRows = rightState?.recentRows7d ?? 0;

    const leftPenalty = norgesgruppenProviders.has(left.provider) && leftRows === 0 ? 50 : 0;
    const rightPenalty = norgesgruppenProviders.has(right.provider) && rightRows === 0 ? 50 : 0;

    const leftBoost = ngColdStart && (left.provider === "foodora" || left.provider === "wolt") ? -15 : 0;
    const rightBoost = ngColdStart && (right.provider === "foodora" || right.provider === "wolt") ? -15 : 0;

    const leftScore = leftPenalty + leftBoost - Math.min(leftRows, 100);
    const rightScore = rightPenalty + rightBoost - Math.min(rightRows, 100);
    if (leftScore !== rightScore) return leftScore - rightScore;

    return left.provider.localeCompare(right.provider);
  });

  const missStreakDisable = {
    healthy: 11,
    degraded: 7,
    norgesgruppenCold: 4,
  };

  const degradedAttemptCap = Math.max(12, Math.ceil(products.length * 0.4));

  for (const product of products) {
    const searchQueries = buildProductQueries(product);

    for (const provider of orderedProviders) {
      const runtime = providerState.get(provider.provider);
      if (!runtime || runtime.disabled) {
        continue;
      }

      if (runtime.degradedFromHistory && runtime.attemptedProducts >= degradedAttemptCap && runtime.matchedProducts === 0) {
        runtime.disabled = true;
        runtime.disabledReason = "Mange nulltreff i degradert modus; skrudd ned midlertidig.";
        continue;
      }

      runtime.attemptedProducts += 1;
      let bestMatch: { candidate: LivePriceCandidate; score: number } | null = null;

      for (const query of searchQueries) {
        const candidates = await provider.search(query);
        const candidateMatch = pickBestCandidate(product, query, candidates);
        if (!candidateMatch) continue;

        if (!bestMatch || candidateMatch.score > bestMatch.score) {
          bestMatch = candidateMatch;
        }
      }

      const minScore = provider.minScore ?? 3;
      if (!bestMatch || bestMatch.score < minScore) {
        runtime.consecutiveMisses += 1;
        const threshold =
          norgesgruppenProviders.has(provider.provider) && runtime.degradedFromHistory
            ? missStreakDisable.norgesgruppenCold
            : runtime.degradedFromHistory
              ? missStreakDisable.degraded
              : missStreakDisable.healthy;
        if (runtime.consecutiveMisses >= threshold) {
          runtime.disabled = true;
          runtime.disabledReason = "Automatisk nedjustert etter vedvarende nulltreff.";
        }
        continue;
      }

      runtime.matchedProducts += 1;
      runtime.consecutiveMisses = 0;

      const store = storeLookup.get(provider.provider);
      if (!store) {
        continue;
      }

      const candidateImageUrl = bestMatch.candidate.imageUrl ?? null;
      if (shouldReplaceProductImage(product.imageUrl, candidateImageUrl)) {
        await client.product.update({
          where: { id: product.id },
          data: { imageUrl: candidateImageUrl },
        });
        product.imageUrl = candidateImageUrl;
      }

      const createRow = await shouldCreatePriceRow(client, {
        productId: product.id,
        storeId: store.id,
        source: provider.provider,
        price: bestMatch.candidate.price,
        unitPrice: bestMatch.candidate.unitPrice,
        now: createdAt,
      });

      if (!createRow) {
        skippedDuplicates += 1;
        runtime.skippedDuplicates += 1;
        continue;
      }

      const derivedPackage = derivePackageMetadata(product.name, bestMatch.candidate.title, bestMatch.candidate.details);
      const shouldUpdatePackageMetadata =
        Boolean(derivedPackage.packageQuantity !== null && derivedPackage.packageUnit) &&
        (!product.packageQuantity ||
          !product.packageUnit ||
          (product.packageUnit === derivedPackage.packageUnit &&
            derivedPackage.packageQuantity !== null &&
            Math.abs(product.packageQuantity - derivedPackage.packageQuantity) <=
              Math.max(40, product.packageQuantity * 0.07)));

      if (shouldUpdatePackageMetadata && derivedPackage.packageQuantity && derivedPackage.packageUnit) {
        await client.product.update({
          where: { id: product.id },
          data: {
            packageQuantity: derivedPackage.packageQuantity,
            packageUnit: derivedPackage.packageUnit,
          },
        });
      }

      await client.price.create({
        data: {
          productId: product.id,
          storeId: store.id,
          source: provider.provider,
          sourceUrl: bestMatch.candidate.url,
          price: new Prisma.Decimal(bestMatch.candidate.price),
          unitPrice: new Prisma.Decimal(bestMatch.candidate.unitPrice),
          date: createdAt,
        },
      });

      results.push({
        productId: product.id,
        productName: product.name,
        provider: provider.provider,
        storeName: store.name,
        price: bestMatch.candidate.price,
        unitPrice: bestMatch.candidate.unitPrice,
        url: bestMatch.candidate.url,
        imageUrl: bestMatch.candidate.imageUrl,
      });
      runtime.matchedPrices += 1;
    }
  }

  const providerMetrics = Array.from(providerState.values()).map((state) => {
    const hitRate = state.attemptedProducts > 0
      ? Number(((state.matchedProducts / state.attemptedProducts) * 100).toFixed(1))
      : 0;

    return {
      provider: state.provider.provider,
      chain: state.provider.chain,
      attemptedProducts: state.attemptedProducts,
      matchedProducts: state.matchedProducts,
      matchedPrices: state.matchedPrices,
      skippedDuplicates: state.skippedDuplicates,
      hitRate,
      degradedFromHistory: state.degradedFromHistory,
      disabled: state.disabled,
      disabledReason: state.disabledReason,
      recentRows7d: state.recentRows7d,
      latestObservationHours: state.latestObservationHours,
    };
  });

  return {
    productsEvaluated: products.length,
    providersEvaluated: selectedProviders.length,
    matchedPrices: results.length,
    skippedDuplicates,
    providerMetrics,
    results,
  };
}