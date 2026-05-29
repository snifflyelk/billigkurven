import { prisma } from "@/lib/prisma";
import { buildSearchQuery, normalizeSearchTerm, scoreTextMatch } from "@/lib/live-pricing/helpers";
import { odaProvider } from "@/lib/live-pricing/providers/oda";
import { menyProvider } from "@/lib/live-pricing/providers/meny";
import { sparProvider } from "@/lib/live-pricing/providers/spar";
import { jokerProvider } from "@/lib/live-pricing/providers/joker";
import { foodoraProvider } from "@/lib/live-pricing/providers/foodora";
import { woltProvider } from "@/lib/live-pricing/providers/wolt";
import { extractProductImageFromJsonLdHtml, isLikelyProductImageUrl, shouldReplaceExistingImage } from "@/lib/live-pricing/providers/media";
import type { LivePriceCandidate } from "@/lib/live-pricing/providers/types";

const LIMIT = Number(process.env.IMAGE_BACKFILL_LIMIT ?? "150");
const DRY_RUN = process.argv.includes("--dry-run");

const providers = [odaProvider, menyProvider, sparProvider, jokerProvider, foodoraProvider, woltProvider];

function needsBackfill(imageUrl: string | null) {
  return shouldReplaceExistingImage(imageUrl);
}

function isValidImageUrl(url: string | null | undefined) {
  if (!url) return false;
  return isLikelyProductImageUrl(url);
}

function tokenOverlapRatio(left: string, right: string) {
  const leftTokens = new Set(normalizeSearchTerm(left).split(" ").filter((token) => token.length > 2));
  const rightTokens = new Set(normalizeSearchTerm(right).split(" ").filter((token) => token.length > 2));
  if (leftTokens.size === 0 || rightTokens.size === 0) return 0;

  let overlap = 0;
  for (const token of Array.from(leftTokens)) {
    if (rightTokens.has(token)) overlap += 1;
  }

  return overlap / leftTokens.size;
}

async function fetchImageFromSourceUrl(url: string) {
  try {
    const response = await fetch(url, {
      headers: {
        "user-agent": "Mozilla/5.0",
        "accept-language": "nb-NO,nb;q=0.9,en;q=0.8",
      },
    });

    if (!response.ok) return null;
    const html = await response.text();
    return extractProductImageFromJsonLdHtml(html, url);
  } catch {
    return null;
  }
}

function pickBestCandidateWithImage(query: string, productName: string, candidates: LivePriceCandidate[]) {
  let best: { candidate: LivePriceCandidate; score: number } | null = null;

  for (const candidate of candidates) {
    if (!isValidImageUrl(candidate.imageUrl)) continue;

    const score = scoreTextMatch(query, buildSearchQuery([candidate.title, candidate.details]));
    const overlap = tokenOverlapRatio(productName, candidate.title);
    const confidenceOk = score >= 5 || overlap >= 0.5 || (score >= 4 && overlap >= 0.35);
    if (!confidenceOk) continue;

    if (!best || score > best.score) {
      best = { candidate, score };
    }
  }

  return best?.candidate ?? null;
}

async function main() {
  const products = await prisma.product.findMany({
    orderBy: { updatedAt: "desc" },
    take: Math.max(1, LIMIT),
    select: {
      id: true,
      name: true,
      brand: true,
      imageUrl: true,
      prices: {
        where: { sourceUrl: { not: null } },
        orderBy: { date: "desc" },
        take: 3,
        select: {
          sourceUrl: true,
        },
      },
    },
  });

  let updated = 0;
  let fromSourceUrl = 0;
  let fromProvider = 0;

  for (const product of products) {
    if (!needsBackfill(product.imageUrl)) continue;

    let resolvedImage: string | null = null;

    for (const row of product.prices) {
      const sourceUrl = row.sourceUrl;
      if (!sourceUrl) continue;

      const extracted = await fetchImageFromSourceUrl(sourceUrl);
      if (!isValidImageUrl(extracted)) continue;

      resolvedImage = extracted;
      fromSourceUrl += 1;
      break;
    }

    if (!resolvedImage) {
      const query = buildSearchQuery([product.brand, product.name]);

      for (const provider of providers) {
        const candidates = await provider.search(query).catch(() => []);
        const best = pickBestCandidateWithImage(query, product.name, candidates);
        if (!best?.imageUrl) continue;

        resolvedImage = best.imageUrl;
        fromProvider += 1;
        break;
      }
    }

    if (!isValidImageUrl(resolvedImage)) {
      continue;
    }

    if (!DRY_RUN) {
      await prisma.product.update({
        where: { id: product.id },
        data: { imageUrl: resolvedImage },
      });
    }

    updated += 1;
    console.log(`[image-backfill] ${product.name} -> ${resolvedImage}`);
  }

  console.log(`\n[image-backfill] Kandidater: ${products.length}`);
  console.log(`[image-backfill] Oppdatert: ${updated}${DRY_RUN ? " (dry-run)" : ""}`);
  console.log(`[image-backfill] Fra sourceUrl: ${fromSourceUrl}`);
  console.log(`[image-backfill] Fra providersok: ${fromProvider}`);
}

main()
  .catch((error) => {
    console.error("[image-backfill] Feil:", error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
