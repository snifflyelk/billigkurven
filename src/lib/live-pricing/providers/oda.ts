import { normalizeText, parseNorwegianAmount, stripTags } from "../helpers";
import { extractImageFromHtml, isLikelyProductImageUrl } from "./media";
import type { LivePriceCandidate, LivePriceProvider } from "./types";

const pricePattern = /(\d{1,3}(?:[.\s]\d{3})*,\d{2})(?:\s*kr)(?:\s*(?:\/|\u2009\/)?\s*([a-zæøå]+))?/gi;
const ODA_SEARCH_PAGES = Math.max(Number(process.env.LIVE_PRICING_ODA_SEARCH_PAGES ?? 80), 1);

function extractCards(html: string) {
  const matches: RegExpExecArray[] = [];
  const pattern = /<a[^>]+href="(\/no\/products\/[^"?#]+)\/"[^>]*>([\s\S]*?)<\/a>/gi;
  let match: RegExpExecArray | null;

  while ((match = pattern.exec(html)) !== null) {
    matches.push(match);
  }

  return matches.map((match, index) => {
    const start = match.index ?? 0;
    const next = matches[index + 1]?.index ?? Math.min(html.length, start + 2500);
    const snippet = html.slice(start, next);
    const anchor = stripTags(match[2] ?? "");
    const body = stripTags(snippet);
    const imageUrl = extractImageFromHtml(snippet, "https://oda.com");

    return {
      title: anchor,
      body,
      url: `https://oda.com${match[1] ?? ""}`,
      imageUrl: isLikelyProductImageUrl(imageUrl) ? imageUrl : null,
    };
  });
}

function parseCandidate(card: { title: string; body: string; url: string; imageUrl: string | null }): LivePriceCandidate | null {
  const priceMatches: RegExpExecArray[] = [];
  let priceMatch: RegExpExecArray | null;

  pricePattern.lastIndex = 0;

  while ((priceMatch = pricePattern.exec(card.body)) !== null) {
    priceMatches.push(priceMatch);
  }

  if (!priceMatches.length) return null;

  const currentPriceMatch = priceMatches.find((entry) => {
    const prefix = card.body.slice(Math.max(0, (entry.index ?? 0) - 8), entry.index ?? 0).toLowerCase();
    return !prefix.includes("før");
  }) ?? priceMatches[0];

  const price = parseNorwegianAmount(currentPriceMatch[1] ?? "");
  if (price === null) return null;

  const unitMatch = priceMatches.find((entry) => (entry.index ?? 0) > (currentPriceMatch.index ?? 0) && Boolean(entry[2]));
  const unitPrice = parseNorwegianAmount(unitMatch?.[1] ?? "") ?? price;

  return {
    title: normalizeText(card.title),
    details: normalizeText(card.body.replace(card.title, "")),
    price,
    unitPrice,
    url: card.url,
    imageUrl: card.imageUrl,
  };
}

export const odaProvider: LivePriceProvider = {
  provider: "oda",
  storeName: "Oda Nettbutikk",
  chain: "Oda",
  location: "Nettbutikk",
  async search(query: string) {
    const deduped = new Map<string, LivePriceCandidate>();
    let consecutivePagesWithoutGrowth = 0;

    for (let page = 1; page <= ODA_SEARCH_PAGES; page += 1) {
      const url = `https://oda.com/no/search/products/?q=${encodeURIComponent(query)}&site=no&page=${page}`;
      const response = await fetch(url, { headers: { "user-agent": "Mozilla/5.0" } });

      if (!response.ok) {
        continue;
      }

      const html = await response.text();
      const pageCandidates = extractCards(html)
        .map(parseCandidate)
        .filter((candidate): candidate is LivePriceCandidate => Boolean(candidate));

      if (pageCandidates.length === 0) {
        break;
      }

      const beforeCount = deduped.size;

      for (const candidate of pageCandidates) {
        const key = `${candidate.url}|${candidate.title.toLowerCase()}`;
        if (!deduped.has(key)) {
          deduped.set(key, candidate);
        }
      }

      if (deduped.size === beforeCount) {
        consecutivePagesWithoutGrowth += 1;
        if (consecutivePagesWithoutGrowth >= 2) {
          break;
        }
      } else {
        consecutivePagesWithoutGrowth = 0;
      }
    }

    return Array.from(deduped.values());
  },
};