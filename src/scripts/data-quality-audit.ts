import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";

type SuspiciousRow = {
  priceId: string;
  productName: string;
  source: string;
  price: number;
  unitPrice: number;
  signal: string;
  sourceUrl: string | null;
};

function normalize(input: string) {
  return input
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/æ/g, "ae")
    .replace(/ø/g, "o")
    .replace(/å/g, "a")
    .replace(/[^a-z0-9æøå]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function extractPercentHint(input: string) {
  const match = input
    .toLowerCase()
    .replace(/\s+/g, "")
    .match(/(\d+(?:[.,]\d+)?)%/);
  if (!match?.[1]) return null;
  const value = Number(match[1].replace(",", "."));
  return Number.isFinite(value) ? value : null;
}

function extractMilkFatPercentFromSlug(input: string) {
  const normalized = normalize(input).replace(/\s+/g, "-");

  const explicitSplit = normalized.match(/(?:lettmelk|helmelk|melk)-([0-9])(?:-|_)([0-9])(?:-|_|$)/);
  if (explicitSplit?.[1] && explicitSplit[2]) {
    const value = Number(`${explicitSplit[1]}.${explicitSplit[2]}`);
    if (Number.isFinite(value)) return value;
  }

  const compact = normalized.match(/(?:lettmelk|helmelk|melk)-([0-9]{2})(?:-|_|$)/);
  if (compact?.[1]) {
    const digits = compact[1];
    const value = Number(`${digits[0]}.${digits[1]}`);
    if (Number.isFinite(value)) return value;
  }

  return null;
}

const ignoredTokens = new Set([
  "g",
  "kg",
  "mg",
  "ml",
  "cl",
  "dl",
  "l",
  "pk",
  "stk",
  "pose",
  "poser",
  "x",
]);

const tokenVariants: Record<string, string> = {
  spagetti: "spaghetti",
  spaghetti: "spaghetti",
  yoghurt: "yogurt",
  joghurt: "yogurt",
  chevre: "chevre",
  chevreost: "chevre",
  brod: "brod",
  grovbrod: "brod",
};

const overlapThresholdBySource: Record<string, number> = {
  oda: 0.16,
  meny: 0.14,
  spar: 0.14,
  joker: 0.14,
};

const weakAnchorTokens = new Set([
  "lett",
  "fri",
  "stor",
  "store",
  "liten",
  "smak",
  "original",
  "classic",
  "zero",
]);

const AUDIT_WINDOW_HOURS = Number(process.env.PRICE_QUALITY_AUDIT_WINDOW_HOURS ?? 168);

function canonicalToken(token: string) {
  return tokenVariants[token] ?? token;
}

function toComparableTokens(input: string) {
  return normalize(input)
    .split(" ")
    .filter(Boolean)
    .filter((token) => !ignoredTokens.has(token))
    .filter((token) => !/^\d+$/.test(token))
    .map(canonicalToken);
}

function tokenMatches(leftToken: string, rightToken: string) {
  if (leftToken === rightToken) return true;
  const shorter = leftToken.length <= rightToken.length ? leftToken : rightToken;
  const longer = shorter === leftToken ? rightToken : leftToken;
  if (shorter.length < 5) return false;
  if (weakAnchorTokens.has(shorter)) return false;

  // Allow compound-token matches, but only when token lengths are similar enough.
  if (longer.includes(shorter) && shorter.length / longer.length >= 0.72) return true;
  return false;
}

function hasStrongUrlAnchor(productName: string, sourceUrl: string) {
  const productTokens = Array.from(new Set(toComparableTokens(productName))).filter(
    (token) => token.length >= 5 && !weakAnchorTokens.has(token),
  );
  if (productTokens.length === 0) return true;

  const urlTokens = Array.from(new Set(toComparableTokens(sourceUrl)));
  return productTokens.some((productToken) =>
    urlTokens.some((urlToken) => tokenMatches(productToken, urlToken)),
  );
}

function tokenOverlap(left: string, right: string) {
  const leftTokens = Array.from(new Set(toComparableTokens(left)));
  const rightTokens = Array.from(new Set(toComparableTokens(right)));
  if (leftTokens.length === 0 || rightTokens.length === 0) return 0;

  let overlap = 0;
  for (const leftToken of leftTokens) {
    const hasMatch = rightTokens.some((rightToken) => tokenMatches(leftToken, rightToken));
    if (hasMatch) overlap += 1;
  }

  return overlap / leftTokens.length;
}

function overlapThresholdForSource(source: string) {
  return overlapThresholdBySource[source] ?? 0.15;
}

function overlapWeightForProductTokenCount(tokenCount: number) {
  if (tokenCount <= 1) return 0.45;
  if (tokenCount <= 2) return 0.7;
  return 1;
}

async function main() {
  const windowHours = Number.isFinite(AUDIT_WINDOW_HOURS) && AUDIT_WINDOW_HOURS > 0 ? AUDIT_WINDOW_HOURS : 168;
  const since = new Date(Date.now() - windowHours * 60 * 60 * 1000);

  const rows = await prisma.price.findMany({
    where: {
      date: { gte: since },
      source: { not: "seed" },
    },
    include: {
      product: true,
      store: true,
    },
    orderBy: { date: "desc" },
    take: 1500,
  });

  const suspicious: SuspiciousRow[] = [];
  const reasonsByPriceId = new Map<string, Set<string>>();
  const quarantineScoreByPriceId = new Map<string, number>();

  function markSuspicious(entry: SuspiciousRow, score = 1) {
    suspicious.push(entry);
    const existing = reasonsByPriceId.get(entry.priceId) ?? new Set<string>();
    existing.add(entry.signal);
    reasonsByPriceId.set(entry.priceId, existing);
    const currentScore = quarantineScoreByPriceId.get(entry.priceId) ?? 0;
    quarantineScoreByPriceId.set(entry.priceId, currentScore + score);
  }

  for (const row of rows) {
    const price = Number(row.price);
    const unitPrice = Number(row.unitPrice);
    const ratio = price > 0 ? unitPrice / price : 0;

    if (price <= 0 || unitPrice <= 0) {
      markSuspicious({
        priceId: row.id,
        productName: row.product.name,
        source: row.source,
        price,
        unitPrice,
        signal: "non_positive_price",
        sourceUrl: row.sourceUrl,
      }, 2);
      continue;
    }

    if (ratio > 12 || ratio < 0.1) {
      markSuspicious({
        priceId: row.id,
        productName: row.product.name,
        source: row.source,
        price,
        unitPrice,
        signal: "unit_ratio_outlier",
        sourceUrl: row.sourceUrl,
      }, 1);
    }

    if (row.sourceUrl) {
      const productTokens = Array.from(new Set(toComparableTokens(row.product.name)));
      const overlap = tokenOverlap(row.product.name, row.sourceUrl);
      const overlapThreshold = overlapThresholdForSource(row.source);
      const productPercent = extractPercentHint(row.product.name);
      const urlPercent = extractPercentHint(row.sourceUrl.replace(/-/g, ","));
      const slugMilkPercent = extractMilkFatPercentFromSlug(row.sourceUrl);
      const comparedPercent = urlPercent ?? slugMilkPercent;

      if (productPercent !== null && comparedPercent !== null && Math.abs(productPercent - comparedPercent) > 0.2) {
        markSuspicious({
          priceId: row.id,
          productName: row.product.name,
          source: row.source,
          price,
          unitPrice,
          signal: "variant_percent_mismatch",
          sourceUrl: row.sourceUrl,
        }, 1.2);
      }

      if (!hasStrongUrlAnchor(row.product.name, row.sourceUrl)) {
        markSuspicious({
          priceId: row.id,
          productName: row.product.name,
          source: row.source,
          price,
          unitPrice,
          signal: "missing_strong_url_anchor",
          sourceUrl: row.sourceUrl,
        }, 1.5);
      }

      if (overlap < overlapThreshold) {
        const overlapWeight = overlapWeightForProductTokenCount(productTokens.length);
        markSuspicious({
          priceId: row.id,
          productName: row.product.name,
          source: row.source,
          price,
          unitPrice,
          signal: "low_name_url_overlap",
          sourceUrl: row.sourceUrl,
        }, overlapWeight);
      }
    }
  }

  const suspiciousIds = Array.from(quarantineScoreByPriceId.entries())
    .filter(([, score]) => score >= 1)
    .map(([priceId]) => priceId);
  const now = new Date();

  await prisma.price.updateMany({
    where: {
      date: { gte: since },
      source: { not: "seed" },
      isQuarantined: true,
      id: { notIn: suspiciousIds.length > 0 ? suspiciousIds : ["__none__"] },
    },
    data: {
      isQuarantined: false,
      quarantineReasons: Prisma.DbNull,
      auditedAt: now,
    },
  });

  for (const priceId of suspiciousIds) {
    const reasons = reasonsByPriceId.get(priceId) ?? new Set<string>();
    await prisma.price.update({
      where: { id: priceId },
      data: {
        isQuarantined: true,
        quarantineReasons: Array.from(reasons),
        auditedAt: now,
      },
    });
  }

  const bySignal = suspicious.reduce<Record<string, number>>((acc, item) => {
    acc[item.signal] = (acc[item.signal] ?? 0) + 1;
    return acc;
  }, {});

  const bySource = rows.reduce<Record<string, number>>((acc, row) => {
    acc[row.source] = (acc[row.source] ?? 0) + 1;
    return acc;
  }, {});

  console.log(
    JSON.stringify(
      {
        windowHours,
        checkedRows: rows.length,
        bySource,
        suspiciousCount: suspicious.length,
        suspiciousRate: rows.length > 0 ? Number(((suspicious.length / rows.length) * 100).toFixed(2)) : 0,
        bySignal,
        overlapThresholdBySource,
        quarantinedRowsUpdated: suspiciousIds.length,
        sample: suspicious.slice(0, 25),
      },
      null,
      2,
    ),
  );
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });

export {};
