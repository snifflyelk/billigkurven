import { normalizeText, parseNorwegianAmount, stripTags } from "../helpers";
import { extractImageField, isLikelyProductImageUrl } from "./media";
import type { LivePriceCandidate, LivePriceProvider } from "./types";

type JsonObject = Record<string, unknown>;

function asObject(input: unknown): JsonObject | null {
  if (!input || typeof input !== "object" || Array.isArray(input)) return null;
  return input as JsonObject;
}

function parseJsonLdCandidates(html: string) {
  const scriptPattern = /<script[^>]+type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi;
  const candidates: LivePriceCandidate[] = [];
  let match: RegExpExecArray | null;

  while ((match = scriptPattern.exec(html)) !== null) {
    const payload = (match[1] ?? "").trim();
    if (!payload) continue;

    let parsed: unknown;
    try {
      parsed = JSON.parse(payload);
    } catch {
      continue;
    }

    const queue: unknown[] = [parsed];
    while (queue.length > 0) {
      const current = queue.shift();

      if (Array.isArray(current)) {
        queue.push(...current);
        continue;
      }

      const object = asObject(current);
      if (!object) continue;

      const name = typeof object.name === "string" ? normalizeText(object.name) : "";
      const offer = asObject(Array.isArray(object.offers) ? object.offers[0] : object.offers);
      const priceRaw = offer?.price;
      const price =
        typeof priceRaw === "number"
          ? Number(priceRaw.toFixed(2))
          : typeof priceRaw === "string"
            ? parseNorwegianAmount(priceRaw)
            : null;

      const url = typeof object.url === "string" ? object.url : "";
      const imageUrl = extractImageField(object, ["image"], "https://www.foodora.no");
      const details = typeof object.description === "string" ? normalizeText(object.description) : "";

      if (name && price !== null) {
        candidates.push({
          title: name,
          details,
          price,
          unitPrice: price,
          url: url.startsWith("http") ? url : `https://www.foodora.no${url.startsWith("/") ? url : `/${url}`}`,
          imageUrl: isLikelyProductImageUrl(imageUrl) ? imageUrl : null,
        });
      }

      for (const value of Object.values(object)) {
        if (value && typeof value === "object") {
          queue.push(value);
        }
      }
    }
  }

  return candidates;
}

function parseInlineCandidates(html: string) {
  const candidates: LivePriceCandidate[] = [];

  const itemPattern = /"name"\s*:\s*"([^"]{2,120})"[\s\S]{0,220}?"price"\s*:\s*(\d+(?:[.,]\d+)?)/gi;
  let match: RegExpExecArray | null;

  while ((match = itemPattern.exec(html)) !== null) {
    const name = normalizeText(match[1] ?? "");
    const rawPrice = match[2] ?? "";
    let price = parseNorwegianAmount(rawPrice);
    if (price === null) {
      const maybeInt = Number(rawPrice);
      if (Number.isFinite(maybeInt)) {
        price = maybeInt > 500 ? Number((maybeInt / 100).toFixed(2)) : Number(maybeInt.toFixed(2));
      }
    }

    if (!name || price === null) continue;
    candidates.push({
      title: name,
      details: "Foodora Market",
      price,
      unitPrice: price,
      url: "https://www.foodora.no/",
      imageUrl: null,
    });
  }

  const cardPattern = /<a[^>]+href="([^"]+)"[^>]*>([\s\S]{0,1200}?)<\/a>/gi;
  while ((match = cardPattern.exec(html)) !== null) {
    const href = match[1] ?? "";
    if (!/product|items?|butikk|store/i.test(href)) continue;
    const body = stripTags(match[2] ?? "");
    const priceMatch = body.match(/(\d{1,3}(?:[.\s]\d{3})*,\d{2})\s*kr/i);
    const price = priceMatch ? parseNorwegianAmount(priceMatch[1]) : null;
    if (price === null) continue;

    const title = normalizeText(body.replace(priceMatch?.[0] ?? "", "").slice(0, 120));
    if (!title) continue;

    candidates.push({
      title,
      details: "Foodora Market",
      price,
      unitPrice: price,
      url: href.startsWith("http") ? href : `https://www.foodora.no${href.startsWith("/") ? href : `/${href}`}`,
      imageUrl: null,
    });
  }

  return candidates;
}

function dedupe(candidates: LivePriceCandidate[]) {
  const seen = new Set<string>();
  const output: LivePriceCandidate[] = [];

  for (const candidate of candidates) {
    const key = `${candidate.title.toLowerCase()}|${candidate.price}`;
    if (seen.has(key)) continue;
    seen.add(key);
    output.push(candidate);
  }

  return output;
}

async function fetchPage(url: string) {
  const response = await fetch(url, {
    headers: {
      "user-agent": "Mozilla/5.0",
      "accept-language": "nb-NO,nb;q=0.9,en;q=0.8",
    },
  });

  if (!response.ok) return "";
  return response.text();
}

export const foodoraProvider: LivePriceProvider = {
  provider: "foodora-market",
  storeName: "Foodora Market",
  chain: "Foodora Market",
  location: "App/nett",
  minScore: 2.2,
  async search(query: string) {
    const urls = [
      `https://www.foodora.no/search?q=${encodeURIComponent(query)}`,
      `https://www.foodora.no/no/search?q=${encodeURIComponent(query)}`,
    ];

    for (const url of urls) {
      const html = await fetchPage(url).catch(() => "");
      if (!html) continue;

      const candidates = dedupe([...parseJsonLdCandidates(html), ...parseInlineCandidates(html)]);
      if (candidates.length > 0) {
        return candidates;
      }
    }

    return [];
  },
};