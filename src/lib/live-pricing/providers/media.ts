type JsonObject = Record<string, unknown>;

function asObject(value: unknown): JsonObject | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  return value as JsonObject;
}

export function normalizeMediaUrl(raw: string | null | undefined, baseUrl?: string) {
  if (!raw) return null;
  const value = raw
    .trim()
    .replace(/&amp;/gi, "&")
    .replace(/&#38;/gi, "&")
    .replace(/&quot;/gi, '"');
  if (!value) return null;

  if (value.startsWith("//")) {
    return `https:${value}`;
  }

  if (!baseUrl) {
    if (!/^https?:\/\//i.test(value)) return null;
    return value;
  }

  try {
    return new URL(value, baseUrl).toString();
  } catch {
    return null;
  }
}

export function isLikelyProductImageUrl(url: string | null | undefined) {
  if (!url) return false;

  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    return false;
  }

  const pathname = parsed.pathname.toLowerCase();
  const hostname = parsed.hostname.toLowerCase();
  const full = `${hostname}${pathname}${parsed.search}`.toLowerCase();

  const blockedHosts = [
    "picsum.photos",
    "unsplash.com",
    "images.unsplash.com",
    "pexels.com",
    "pixabay.com",
    "shutterstock.com",
  ];
  if (blockedHosts.some((host) => hostname.includes(host))) {
    return false;
  }

  const denyTokens = [
    "logo",
    "icon",
    "sprite",
    "banner",
    "hero",
    "background",
    "favicon",
    "placeholder",
    "avatar",
  ];
  if (denyTokens.some((token) => full.includes(token))) {
    return false;
  }

  const knownRetailHosts = [
    "oda.com",
    "ngdata.no",
    "meny.no",
    "spar.no",
    "joker.no",
    "foodora.no",
    "wolt.com",
  ];

  const knownRetailAssetHints = [
    "images.oda.com",
    "oda.com/local_products",
    "ngdata",
  ];

  const allowPathTokens = [
    "product",
    "products",
    "local_products",
    "item",
    "items",
    "image",
    "images",
    "vare",
    "varer",
    "catalog",
  ];

  const hasImageExtension = /\.(jpg|jpeg|png|webp|avif)(\?|$)/i.test(pathname);
  const hasLikelyPath = allowPathTokens.some((token) => pathname.includes(token));
  const isRetailHost = knownRetailHosts.some((host) => hostname.includes(host));
  const hasRetailAssetHint = knownRetailAssetHints.some((hint) => full.includes(hint));

  if (isRetailHost && (hasLikelyPath || hasImageExtension || hasRetailAssetHint)) {
    return true;
  }

  return hasLikelyPath;
}

function normalizeText(value: string) {
  return value
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

function getMeaningfulTokens(value: string) {
  const stopwords = new Set([
    "med",
    "uten",
    "stor",
    "liten",
    "mini",
    "fersk",
    "original",
    "ekstra",
    "norway",
    "norge",
  ]);

  return normalizeText(value)
    .split(/\s+/)
    .filter((token) => token.length >= 4 && !stopwords.has(token));
}

export function isLikelyImageForProduct(
  imageUrl: string | null | undefined,
  product: { name: string; brand?: string | null; ean?: string | null },
) {
  if (!isLikelyProductImageUrl(imageUrl)) return false;
  if (!imageUrl) return false;

  const normalizedUrl = normalizeText(decodeURIComponent(imageUrl));

  const ean = (product.ean ?? "").trim();
  if (ean.length >= 8 && normalizedUrl.includes(ean.toLowerCase())) {
    return true;
  }

  const tokens = [
    ...getMeaningfulTokens(product.name),
    ...getMeaningfulTokens(product.brand ?? ""),
  ];

  if (tokens.length === 0) return true;

  return tokens.some((token) => normalizedUrl.includes(token));
}

export function shouldReplaceExistingImage(existingUrl: string | null | undefined) {
  if (!existingUrl) return true;
  return !isLikelyProductImageUrl(existingUrl);
}

export function extractImageField(source: unknown, keys: string[], baseUrl?: string) {
  const object = asObject(source);
  if (!object) return null;

  for (const key of keys) {
    const value = object[key];

    if (typeof value === "string") {
      const normalized = normalizeMediaUrl(value, baseUrl);
      if (normalized) return normalized;
    }

    if (Array.isArray(value)) {
      for (const entry of value) {
        if (typeof entry === "string") {
          const normalized = normalizeMediaUrl(entry, baseUrl);
          if (normalized) return normalized;
        }

        const nested = asObject(entry);
        if (!nested) continue;

        const nestedCandidate =
          (typeof nested.url === "string" && normalizeMediaUrl(nested.url, baseUrl)) ||
          (typeof nested.src === "string" && normalizeMediaUrl(nested.src, baseUrl));

        if (nestedCandidate) return nestedCandidate;
      }
    }

    const nestedObject = asObject(value);
    if (nestedObject) {
      const nestedCandidate =
        (typeof nestedObject.url === "string" && normalizeMediaUrl(nestedObject.url, baseUrl)) ||
        (typeof nestedObject.src === "string" && normalizeMediaUrl(nestedObject.src, baseUrl));
      if (nestedCandidate) return nestedCandidate;
    }
  }

  return null;
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

export function extractProductImageFromJsonLdHtml(html: string, baseUrl?: string) {
  const scriptPattern = /<script[^>]+type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi;
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

    const products: JsonObject[] = [];
    collectProductLikeNodes(parsed, products);

    for (const product of products) {
      const imageUrl = extractImageField(
        product,
        ["image", "imageUrl", "images", "primaryImage", "thumbnail", "thumbnailUrl"],
        baseUrl,
      );

      if (isLikelyProductImageUrl(imageUrl)) {
        return imageUrl;
      }
    }
  }

  return null;
}

function extractFirstFromSrcSet(value: string) {
  const first = value.split(",")[0]?.trim() ?? "";
  const [url] = first.split(/\s+/);
  return url ?? null;
}

export function extractImageFromHtml(html: string, baseUrl?: string) {
  const metaPatterns = [
    /<meta[^>]+property=["']og:image["'][^>]+content=["']([^"']+)["'][^>]*>/i,
    /<meta[^>]+name=["']twitter:image["'][^>]+content=["']([^"']+)["'][^>]*>/i,
    /<meta[^>]+itemprop=["']image["'][^>]+content=["']([^"']+)["'][^>]*>/i,
  ];

  for (const pattern of metaPatterns) {
    const match = html.match(pattern);
    if (!match?.[1]) continue;
    const normalized = normalizeMediaUrl(match[1], baseUrl);
    if (normalized && isLikelyProductImageUrl(normalized)) return normalized;
  }

  const srcSetMatch = html.match(/<img[^>]+srcset=["']([^"']+)["'][^>]*>/i);
  if (srcSetMatch?.[1]) {
    const first = extractFirstFromSrcSet(srcSetMatch[1]);
    const normalized = normalizeMediaUrl(first, baseUrl);
    if (normalized && isLikelyProductImageUrl(normalized)) return normalized;
  }

  const imgAttrPatterns = [
    /<img[^>]+data-src=["']([^"']+)["'][^>]*>/i,
    /<img[^>]+src=["']([^"']+)["'][^>]*>/i,
  ];

  for (const pattern of imgAttrPatterns) {
    const match = html.match(pattern);
    if (!match?.[1]) continue;
    const normalized = normalizeMediaUrl(match[1], baseUrl);
    if (normalized && isLikelyProductImageUrl(normalized)) return normalized;
  }

  return null;
}
