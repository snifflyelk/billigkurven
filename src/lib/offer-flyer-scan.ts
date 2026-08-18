import { prisma } from "@/lib/prisma";
import { buildBuyWindowPrediction } from "@/lib/price-prediction";

type OfferCandidate = {
  label: string;
  offerPrice: number;
};

type ProductMatch = {
  productId: string;
  productName: string;
  brand: string;
  category: string;
  score: number;
};

export type OfferComparisonResult = {
  label: string;
  offerPrice: number;
  matched: boolean;
  matchScore: number | null;
  productId: string | null;
  productName: string | null;
  chain: string;
  latestChainPrice: number | null;
  avg30: number | null;
  avg90: number | null;
  trendAction: "kjop-na" | "vent" | "ukjent";
  trendScore: number | null;
  deviationVs30Pct: number | null;
  verdict: "sterkt-tilbud" | "ok-tilbud" | "svakt-tilbud" | "ukjent";
  dataPoints: number;
};

function normalize(value: string) {
  return value
    .toLowerCase()
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/ae/g, "ae")
    .replace(/\u00e6/g, "ae")
    .replace(/\u00f8/g, "o")
    .replace(/\u00e5/g, "a")
    .replace(/[^a-z0-9 ]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function tokenize(value: string) {
  const stopWords = new Set(["og", "med", "uten", "for", "fra", "til", "stk", "pk", "pose", "poses", "x", "kampanje", "tilbud"]);
  return normalize(value)
    .split(" ")
    .filter((token) => token.length >= 2 && !stopWords.has(token));
}

function overlapScore(left: string, right: string) {
  const leftTokens = tokenize(left);
  const rightTokens = tokenize(right);
  if (leftTokens.length === 0 || rightTokens.length === 0) return 0;
  const rightSet = new Set(rightTokens);
  const overlap = leftTokens.filter((token) => rightSet.has(token)).length;
  return overlap / Math.max(leftTokens.length, rightTokens.length);
}

function extractOfferCandidatesFromText(text: string, maxItems: number) {
  const lines = text
    .split(/\r?\n/)
    .map((line) => line.replace(/\s+/g, " ").trim())
    .filter(Boolean)
    .slice(0, 3000);

  const candidates: OfferCandidate[] = [];

  for (const line of lines) {
    const priceMatch =
      line.match(/^(.{3,120}?)\s+(\d{1,4}[.,]\d{2})\s*(?:kr)?$/i) ||
      line.match(/^(.{3,120}?)\s+(\d{1,4})\s*,-$/i) ||
      line.match(/^(.{3,120}?)\s+(\d{1,4})\s*kr$/i);

    if (!priceMatch) continue;

    const label = priceMatch[1]?.trim() ?? "";
    const rawPrice = priceMatch[2]?.replace(",", ".") ?? "";
    const offerPrice = Number(rawPrice);

    if (!label || !Number.isFinite(offerPrice) || offerPrice <= 0) continue;
    if (/^\d{1,2}[./-]\d{1,2}/.test(label)) continue;
    if (/^(mandag|tirsdag|onsdag|torsdag|fredag|lordag|sondag)$/i.test(label)) continue;

    candidates.push({ label, offerPrice: Number(offerPrice.toFixed(2)) });
    if (candidates.length >= maxItems) break;
  }

  return candidates;
}

function stripHtmlToText(html: string) {
  return html
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<[^>]+>/g, "\n")
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&quot;/gi, '"')
    .replace(/&#39;/gi, "'")
    .replace(/\n{2,}/g, "\n")
    .trim();
}

async function findProductMatch(label: string): Promise<ProductMatch | null> {
  const tokens = tokenize(label).filter((token) => token.length >= 3).slice(0, 4);
  if (tokens.length === 0) return null;

  const candidates = await prisma.product.findMany({
    where: {
      NOT: [
        { name: { startsWith: "Vare " } },
        { name: { startsWith: "vare " } },
      ],
      OR: tokens.flatMap((token) => [
        { name: { contains: token, mode: "insensitive" } },
        { brand: { contains: token, mode: "insensitive" } },
      ]),
    },
    select: {
      id: true,
      name: true,
      brand: true,
      category: true,
    },
    take: 40,
  });

  if (candidates.length === 0) return null;

  let best: ProductMatch | null = null;
  for (const candidate of candidates) {
    const score = Math.max(
      overlapScore(label, `${candidate.name} ${candidate.brand}`),
      overlapScore(label, candidate.name),
    );

    if (!best || score > best.score) {
      best = {
        productId: candidate.id,
        productName: candidate.name,
        brand: candidate.brand,
        category: candidate.category,
        score: Number(score.toFixed(2)),
      };
    }
  }

  if (!best || best.score < 0.25) return null;
  return best;
}

async function loadChainTrend(input: { productId: string; chain: string }) {
  const since = new Date(Date.now() - 120 * 24 * 60 * 60 * 1000);
  const rows = await prisma.price.findMany({
    where: {
      productId: input.productId,
      isQuarantined: false,
      date: { gte: since },
      store: {
        chain: { equals: input.chain, mode: "insensitive" },
      },
    },
    orderBy: { date: "desc" },
    select: {
      price: true,
      date: true,
      storeId: true,
    },
    take: 700,
  });

  const latestByStore = new Map<string, { price: number; date: Date }>();
  for (const row of rows) {
    if (latestByStore.has(row.storeId)) continue;
    latestByStore.set(row.storeId, { price: Number(row.price), date: row.date });
  }

  const latestPrices = Array.from(latestByStore.values()).map((entry) => entry.price).filter((value) => value > 0);
  const latestChainPrice = latestPrices.length > 0
    ? Number((latestPrices.reduce((sum, value) => sum + value, 0) / latestPrices.length).toFixed(2))
    : null;

  const avgInDays = (days: number) => {
    const cutoff = Date.now() - days * 24 * 60 * 60 * 1000;
    const values = rows
      .filter((row) => row.date.getTime() >= cutoff)
      .map((row) => Number(row.price))
      .filter((value) => Number.isFinite(value) && value > 0);
    if (values.length === 0) return null;
    return Number((values.reduce((sum, value) => sum + value, 0) / values.length).toFixed(2));
  };

  const avg30 = avgInDays(30);
  const avg90 = avgInDays(90);
  const prediction = buildBuyWindowPrediction(rows.map((row) => ({ price: Number(row.price), date: row.date })));

  return {
    latestChainPrice,
    avg30,
    avg90,
    trendAction: prediction.action,
    trendScore: prediction.buyWindowScore,
    dataPoints: rows.length,
  };
}

function verdictFromDeviation(deviationVs30Pct: number | null) {
  if (deviationVs30Pct === null) return "ukjent" as const;
  if (deviationVs30Pct <= -12) return "sterkt-tilbud" as const;
  if (deviationVs30Pct <= -4) return "ok-tilbud" as const;
  return "svakt-tilbud" as const;
}

export async function scanOfferFlyer(input: {
  chain: string;
  flyerText?: string;
  flyerUrl?: string;
  maxItems?: number;
}) {
  const chain = input.chain.trim();
  if (!chain) {
    throw new Error("chain er obligatorisk");
  }

  const maxItems = Number.isFinite(input.maxItems) ? Math.max(5, Math.min(120, Number(input.maxItems))) : 40;

  let resolvedText = (input.flyerText ?? "").trim();
  if (!resolvedText && input.flyerUrl) {
    const response = await fetch(input.flyerUrl, {
      headers: {
        "user-agent": "BilligkurvenOfferScanner/1.0",
      },
    });
    if (!response.ok) {
      throw new Error(`Kunne ikke hente tilbudsavis URL (${response.status})`);
    }
    const html = await response.text();
    resolvedText = stripHtmlToText(html);
  }

  if (!resolvedText) {
    throw new Error("Send flyerText eller flyerUrl");
  }

  const candidates = extractOfferCandidatesFromText(resolvedText, maxItems);
  const comparisons: OfferComparisonResult[] = [];

  for (const candidate of candidates) {
    const matched = await findProductMatch(candidate.label);
    if (!matched) {
      comparisons.push({
        label: candidate.label,
        offerPrice: candidate.offerPrice,
        matched: false,
        matchScore: null,
        productId: null,
        productName: null,
        chain,
        latestChainPrice: null,
        avg30: null,
        avg90: null,
        trendAction: "ukjent",
        trendScore: null,
        deviationVs30Pct: null,
        verdict: "ukjent",
        dataPoints: 0,
      });
      continue;
    }

    const trend = await loadChainTrend({ productId: matched.productId, chain });
    const deviationVs30Pct = trend.avg30 && trend.avg30 > 0
      ? Number((((candidate.offerPrice - trend.avg30) / trend.avg30) * 100).toFixed(1))
      : null;

    comparisons.push({
      label: candidate.label,
      offerPrice: candidate.offerPrice,
      matched: true,
      matchScore: matched.score,
      productId: matched.productId,
      productName: matched.productName,
      chain,
      latestChainPrice: trend.latestChainPrice,
      avg30: trend.avg30,
      avg90: trend.avg90,
      trendAction: trend.trendAction,
      trendScore: trend.trendScore,
      deviationVs30Pct,
      verdict: verdictFromDeviation(deviationVs30Pct),
      dataPoints: trend.dataPoints,
    });
  }

  const matchedCount = comparisons.filter((item) => item.matched).length;
  const strongDeals = comparisons.filter((item) => item.verdict === "sterkt-tilbud").length;

  return {
    chain,
    scannedItems: candidates.length,
    matchedItems: matchedCount,
    strongDeals,
    comparisons,
  };
}
