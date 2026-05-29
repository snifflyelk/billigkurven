import { normalizeText, parseNorwegianAmount, stripTags } from "../helpers";
import { extractImageField, extractImageFromHtml, extractProductImageFromJsonLdHtml, isLikelyProductImageUrl } from "./media";
import type { LivePriceCandidate, LivePriceProvider } from "./types";

const pricePattern = /(\d{1,3}(?:[.\s]\d{3})*,\d{2})(?:\s*kr)(?:\s*(?:\/|\u2009\/)?\s*([a-zæøå]+))?/gi;

type Card = {
  title: string;
  body: string;
  url: string;
  imageUrl: string | null;
};

type JsonObject = Record<string, unknown>;

type NgDataHit = Record<string, unknown>;

const resolvedGlnByProvider = new Map<string, string>();

function extractCards(html: string, baseUrl: string) {
  const matches: RegExpExecArray[] = [];
  const pattern = /<a[^>]+href="(\/varer\/[^"?#]+-\d{7,14}(?:\/)?)(?:\?[^\"]*)?"[^>]*>([\s\S]*?)<\/a>/gi;
  let match: RegExpExecArray | null;

  while ((match = pattern.exec(html)) !== null) {
    matches.push(match);
  }

  return matches.map((entry, index) => {
    const start = entry.index ?? 0;
    const next = matches[index + 1]?.index ?? Math.min(html.length, start + 2500);
    const snippet = html.slice(start, next);
    const anchor = stripTags(entry[2] ?? "");
    const body = stripTags(snippet);
    const imageUrl = extractProductImageFromJsonLdHtml(snippet, baseUrl) ?? extractImageFromHtml(snippet, baseUrl);

    return {
      title: anchor,
      body,
      url: `${baseUrl}${entry[1] ?? ""}`.replace(/\/$/, ""),
      imageUrl: isLikelyProductImageUrl(imageUrl) ? imageUrl : null,
    };
  });
}

function parseCandidate(card: Card): LivePriceCandidate | null {
  const priceMatches: RegExpExecArray[] = [];
  let match: RegExpExecArray | null;

  pricePattern.lastIndex = 0;

  while ((match = pricePattern.exec(card.body)) !== null) {
    priceMatches.push(match);
  }

  if (priceMatches.length === 0) return null;

  const currentPriceMatch =
    priceMatches.find((entry) => {
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

function asObject(input: unknown): JsonObject | null {
  if (!input || typeof input !== "object" || Array.isArray(input)) return null;
  return input as JsonObject;
}

function extractPriceFromOffer(offer: JsonObject | null) {
  if (!offer) return null;

  const direct =
    (typeof offer.price === "number" ? offer.price : null) ??
    (typeof offer.price === "string" ? parseNorwegianAmount(offer.price) : null) ??
    (typeof offer.lowPrice === "number" ? offer.lowPrice : null) ??
    (typeof offer.lowPrice === "string" ? parseNorwegianAmount(offer.lowPrice) : null);

  return direct !== null && Number.isFinite(direct) ? Number(direct.toFixed(2)) : null;
}

function collectProductLikeNodes(root: unknown, acc: JsonObject[]) {
  if (Array.isArray(root)) {
    for (const entry of root) collectProductLikeNodes(entry, acc);
    return;
  }

  const object = asObject(root);
  if (!object) return;

  const typeField = object["@type"];
  const types = Array.isArray(typeField)
    ? typeField.filter((v): v is string => typeof v === "string")
    : typeof typeField === "string"
    ? [typeField]
    : [];

  if (types.some((typeName) => typeName.toLowerCase() === "product")) {
    acc.push(object);
  }

  for (const value of Object.values(object)) {
    if (value && typeof value === "object") {
      collectProductLikeNodes(value, acc);
    }
  }
}

function extractJsonLdCandidates(html: string, baseUrl: string) {
  const scriptPattern = /<script[^>]+type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi;
  const candidates: LivePriceCandidate[] = [];
  let scriptMatch: RegExpExecArray | null;

  while ((scriptMatch = scriptPattern.exec(html)) !== null) {
    const payload = (scriptMatch[1] ?? "").trim();
    if (!payload) continue;

    let json: unknown;
    try {
      json = JSON.parse(payload);
    } catch {
      continue;
    }

    const products: JsonObject[] = [];
    collectProductLikeNodes(json, products);

    for (const product of products) {
      const name = typeof product.name === "string" ? normalizeText(product.name) : "";
      if (!name) continue;

      const offerValue = product.offers;
      const offer = asObject(Array.isArray(offerValue) ? offerValue[0] : offerValue);
      const price = extractPriceFromOffer(offer);
      if (price === null) continue;

      const brandObject = asObject(product.brand);
      const brand = typeof product.brand === "string" ? product.brand : typeof brandObject?.name === "string" ? brandObject.name : "";
      const category = typeof product.category === "string" ? product.category : "";
      const urlRaw = typeof product.url === "string" ? product.url : "";
      const imageUrl = extractImageField(product, ["image"], baseUrl);
      const details = normalizeText(`${brand} ${category}`.trim());

      candidates.push({
        title: name,
        details,
        price,
        unitPrice: price,
        url: urlRaw.startsWith("http") ? urlRaw : `${baseUrl}${urlRaw.startsWith("/") ? urlRaw : `/${urlRaw}`}`,
        imageUrl: isLikelyProductImageUrl(imageUrl) ? imageUrl : null,
      });
    }
  }

  return candidates;
}

function parseNumberLoose(value: unknown) {
  if (typeof value === "number" && Number.isFinite(value)) return Number(value.toFixed(2));
  if (typeof value === "string") {
    const trimmed = value.trim();
    if (!trimmed) return null;

    // Platform payloads may use dot decimals (e.g. "31.9").
    if (trimmed.includes(".") && !trimmed.includes(",")) {
      const parsed = Number.parseFloat(trimmed);
      if (Number.isFinite(parsed)) return Number(parsed.toFixed(2));
    }

    return parseNorwegianAmount(trimmed);
  }
  return null;
}

function getStringField(record: NgDataHit, keys: string[]) {
  for (const key of keys) {
    const value = record[key];
    if (typeof value === "string" && value.trim()) return normalizeText(value);
  }
  return "";
}

function extractNgDataCandidates(payload: unknown, baseUrl: string) {
  const root = asObject(payload);
  if (!root) return [];

  const hitsValue = root.hits;
  if (!Array.isArray(hitsValue)) return [];

  const candidates: LivePriceCandidate[] = [];

  for (const rawHit of hitsValue) {
    const hit = asObject(rawHit);
    if (!hit) continue;

    const title = getStringField(hit, ["title", "name", "productName", "displayName"]);
    if (!title) continue;

    const details = getStringField(hit, ["brand", "description", "subTitle", "categoryName"]);

    const price =
      parseNumberLoose(hit.price) ??
      parseNumberLoose(hit.salesPrice) ??
      parseNumberLoose(hit.currentPrice) ??
      parseNumberLoose(hit.offerPrice);

    if (price === null) continue;

    const unitPrice =
      parseNumberLoose(hit.pricePerUnit) ??
      parseNumberLoose(hit.unitPrice) ??
      parseNumberLoose(hit.pricePerKilo) ??
      price;

    const path =
      getStringField(hit, ["url", "productUrl", "relativeUrl", "slug"]).replace(baseUrl, "") ||
      getStringField(hit, ["id", "productId"]);

    const url = path.startsWith("http")
      ? path
      : path.startsWith("/")
      ? `${baseUrl}${path}`
      : `${baseUrl}/varer/${path}`;

    const imageUrl = extractImageField(
      hit,
      ["image", "imageUrl", "image_url", "thumbnail", "thumbnailUrl", "images", "mainImage"],
      baseUrl,
    );

    candidates.push({
      title,
      details,
      price,
      unitPrice,
      url,
      imageUrl: isLikelyProductImageUrl(imageUrl) ? imageUrl : null,
    });
  }

  return candidates;
}

function extractPlatformRestCandidates(payload: unknown, baseUrl: string) {
  const root = asObject(payload);
  if (!root) return [];

  const hitsWrapper = asObject(root.hits);
  const hitsArray = Array.isArray(hitsWrapper?.hits) ? hitsWrapper?.hits : [];
  const candidates: LivePriceCandidate[] = [];

  for (const rawEntry of hitsArray) {
    const entry = asObject(rawEntry);
    const source = asObject(entry?._source);
    if (!source) continue;

    const title =
      (typeof source.title === "string" && normalizeText(source.title)) ||
      (typeof source.name === "string" && normalizeText(source.name)) ||
      "";
    if (!title) continue;

    const details = normalizeText(
      [
        typeof source.brand === "string" ? source.brand : "",
        typeof source.categoryName === "string" ? source.categoryName : "",
        typeof source.subtitle === "string" ? source.subtitle : "",
      ]
        .filter(Boolean)
        .join(" "),
    );

    const price =
      parseNumberLoose(source.salesPrice) ??
      parseNumberLoose(source.pricePerUnit) ??
      parseNumberLoose(source.calcPricePerUnit) ??
      parseNumberLoose(source.comparePricePerUnit);

    if (price === null) continue;

    const unitPrice = parseNumberLoose(source.comparePricePerUnit) ?? parseNumberLoose(source.pricePerUnit) ?? price;
    const slug = typeof source.slugifiedUrl === "string" ? source.slugifiedUrl : "";
    const imageUrl = extractImageField(
      source,
      ["image", "imageUrl", "image_url", "thumbnail", "thumbnailUrl", "images", "mainImage", "primaryImage"],
      baseUrl,
    );
    const url = slug
      ? `${baseUrl}${slug.startsWith("/") ? slug : `/${slug}`}`
      : `${baseUrl}/sok?q=${encodeURIComponent(title)}`;

    candidates.push({
      title,
      details,
      price,
      unitPrice,
      url,
      imageUrl: isLikelyProductImageUrl(imageUrl) ? imageUrl : null,
    });
  }

  return candidates;
}

async function searchViaNgDataApi(input: {
  chainId: string;
  query: string;
  gln: string;
}) {
  const url = new URL(`https://api.ngdata.no/sylinder/search/productsearch/v1/search/${encodeURIComponent(input.gln)}/products`);
  url.searchParams.set("search", input.query);
  url.searchParams.set("chainId", input.chainId);
  url.searchParams.set("pageSize", "24");
  url.searchParams.set("page", "1");
  url.searchParams.set("showNotForSale", "true");
  url.searchParams.set("popularity", "true");

  const response = await fetch(url.toString(), {
    headers: {
      "user-agent": "Mozilla/5.0",
      accept: "application/json",
    },
  });

  if (!response.ok) {
    return [];
  }

  let payload: unknown;
  try {
    payload = await response.json();
  } catch {
    return [];
  }

  return payload;
}

async function searchViaPlatformRestApi(input: {
  chainId: string;
  query: string;
  gln: string;
}) {
  const url = new URL(`https://platform-rest-prod.ngdata.no/api/products/${encodeURIComponent(input.chainId)}/${encodeURIComponent(input.gln)}`);
  url.searchParams.set("search", input.query);
  url.searchParams.set("page", "1");
  url.searchParams.set("page_size", "24");
  url.searchParams.set("full_response", "true");
  url.searchParams.set("fieldset", "maximal");
  url.searchParams.set("showNotForSale", "true");

  const response = await fetch(url.toString(), {
    headers: {
      "user-agent": "Mozilla/5.0",
      accept: "application/json",
    },
  });

  if (!response.ok) {
    return null;
  }

  let payload: unknown;
  try {
    payload = await response.json();
  } catch {
    return null;
  }

  return payload;
}

function parseGlnCandidates(input: { primary?: string; candidates?: string; fallback: string }) {
  const list = [input.primary ?? "", input.candidates ?? "", input.fallback]
    .flatMap((value) => value.split(","))
    .map((value) => value.trim())
    .filter(Boolean);

  const merged = Array.from(new Set(list));
  if (!merged.includes("0")) {
    merged.push("0");
  }
  return merged;
}

async function resolveWorkingGln(input: {
  provider: string;
  chainId: string;
  primary?: string;
  candidates?: string;
  fallback: string;
}) {
  const cached = resolvedGlnByProvider.get(input.provider);
  if (cached) return cached;

  const candidateList = parseGlnCandidates({
    primary: input.primary,
    candidates: input.candidates,
    fallback: input.fallback,
  });

  for (const gln of candidateList) {
    const payload = await searchViaNgDataApi({
      chainId: input.chainId,
      query: "tine melk",
      gln,
    }).catch(() => null);

    if (!payload) continue;
    const hits = extractNgDataCandidates(payload, "");
    if (hits.length > 0) {
      resolvedGlnByProvider.set(input.provider, gln);
      return gln;
    }
  }

  const bestEffort = candidateList.find((value) => value === "0") ?? candidateList[0] ?? input.fallback;
  resolvedGlnByProvider.set(input.provider, bestEffort);
  return bestEffort;
}

export function createNorgesgruppenProvider(config: {
  provider: string;
  host: string;
  chainId: string;
  storeName: string;
  chain: string;
  location?: string;
  minScore?: number;
  glnEnvKey?: string;
}): LivePriceProvider {
  const baseUrl = `https://${config.host}`;
  const defaultGln = config.provider === "meny" ? "1300010110113" : config.provider === "spar" ? "1210010110111" : config.provider === "joker" ? "1220010110110" : "0";

  return {
    provider: config.provider,
    storeName: config.storeName,
    chain: config.chain,
    location: config.location ?? "Nettbutikk",
    minScore: config.minScore,
    async search(query: string) {
      const glnFromEnv = config.glnEnvKey ? process.env[config.glnEnvKey] : undefined;
      const glnCandidatesFromEnv = config.glnEnvKey ? process.env[`${config.glnEnvKey}_CANDIDATES`] : undefined;

      const gln = await resolveWorkingGln({
        provider: config.provider,
        chainId: config.chainId,
        primary: glnFromEnv,
        candidates: glnCandidatesFromEnv,
        fallback: defaultGln,
      });

      // Prefer backend JSON endpoint when available; fall back to HTML parsing.
      const apiPayload = await searchViaNgDataApi({
        chainId: config.chainId,
        query,
        gln,
      }).catch(() => null);

      if (apiPayload) {
        const apiCandidates = extractNgDataCandidates(apiPayload, baseUrl);
        if (apiCandidates.length > 0) {
          return apiCandidates;
        }
      }

      const platformPayload = await searchViaPlatformRestApi({
        chainId: config.chainId,
        query,
        gln,
      }).catch(() => null);

      if (platformPayload) {
        const platformCandidates = extractPlatformRestCandidates(platformPayload, baseUrl);
        if (platformCandidates.length > 0) {
          return platformCandidates;
        }
      }

      const url = `${baseUrl}/sok?q=${encodeURIComponent(query)}`;
      const response = await fetch(url, { headers: { "user-agent": "Mozilla/5.0" } });

      if (!response.ok) {
        return [];
      }

      const html = await response.text();
      const cardCandidates = extractCards(html, baseUrl)
        .map(parseCandidate)
        .filter((candidate): candidate is LivePriceCandidate => Boolean(candidate));

      const jsonLdCandidates = extractJsonLdCandidates(html, baseUrl);
      return [...cardCandidates, ...jsonLdCandidates];
    },
  };
}
