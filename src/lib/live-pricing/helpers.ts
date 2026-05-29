export function normalizeText(input: string) {
  return input
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/\s+/g, " ")
    .trim();
}

export function stripTags(input: string) {
  return normalizeText(input.replace(/<script[\s\S]*?<\/script>/gi, " ").replace(/<style[\s\S]*?<\/style>/gi, " ").replace(/<[^>]+>/g, " "));
}

export function normalizeSearchTerm(input: string) {
  return stripTags(input)
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9æøå]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

export function parseNorwegianAmount(input: string) {
  const normalized = input.replace(/\s/g, "").replace(/\./g, "").replace(",", ".");
  const value = Number.parseFloat(normalized);
  return Number.isFinite(value) ? Number(value.toFixed(2)) : null;
}

export function scoreTextMatch(source: string, candidate: string) {
  const sourceTokens = new Set(normalizeSearchTerm(source).split(" ").filter(Boolean));
  const candidateTokens = new Set(normalizeSearchTerm(candidate).split(" ").filter(Boolean));

  let score = 0;
  for (const token of Array.from(sourceTokens)) {
    if (candidateTokens.has(token)) score += 3;
    else if (Array.from(candidateTokens).some((candidateToken) => candidateToken.includes(token) || token.includes(candidateToken))) score += 1;
  }

  return score;
}

export function buildSearchQuery(parts: Array<string | undefined | null>) {
  return parts.filter(Boolean).join(" ").trim();
}