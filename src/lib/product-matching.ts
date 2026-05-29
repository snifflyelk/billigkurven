type MatchInput = {
  name: string;
  brand: string;
  category: string;
  packageQuantity?: number | null;
  packageUnit?: "G" | "ML" | "STK" | null;
};

type PackInfo = {
  quantity: number;
  unit: "g" | "ml" | "stk";
};

const STOP_WORDS = new Set([
  "med",
  "uten",
  "og",
  "naturell",
  "original",
  "fersk",
  "store",
  "stor",
  "liten",
  "mini",
  "pk",
  "stk",
]);

function normalize(value: string) {
  return value
    .toLowerCase()
    .replace(/æ/g, "ae")
    .replace(/ø/g, "o")
    .replace(/å/g, "a")
    .replace(/[^a-z0-9 ]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function tokenise(value: string) {
  return normalize(value)
    .split(" ")
    .filter((token) => token.length > 1 && !STOP_WORDS.has(token));
}

function extractPackInfo(value: string): PackInfo | null {
  const normalized = normalize(value);
  const kgMatch = normalized.match(/(\d+(?:[.,]\d+)?)\s*kg\b/);
  if (kgMatch) {
    return { quantity: Number(kgMatch[1].replace(",", ".")) * 1000, unit: "g" };
  }

  const gramMatch = normalized.match(/(\d+(?:[.,]\d+)?)\s*g\b/);
  if (gramMatch) {
    return { quantity: Number(gramMatch[1].replace(",", ".")), unit: "g" };
  }

  const literMatch = normalized.match(/(\d+(?:[.,]\d+)?)\s*l\b/);
  if (literMatch) {
    return { quantity: Number(literMatch[1].replace(",", ".")) * 1000, unit: "ml" };
  }

  const mlMatch = normalized.match(/(\d+(?:[.,]\d+)?)\s*ml\b/);
  if (mlMatch) {
    return { quantity: Number(mlMatch[1].replace(",", ".")), unit: "ml" };
  }

  const piecesMatch = normalized.match(/(\d+(?:[.,]\d+)?)\s*(stk|pk|pose|poser)\b/);
  if (piecesMatch) {
    return { quantity: Number(piecesMatch[1].replace(",", ".")), unit: "stk" };
  }

  return null;
}

function overlapRatio(left: string[], right: string[]) {
  if (left.length === 0 || right.length === 0) return 0;
  const rightSet = new Set(right);
  const overlap = left.filter((token) => rightSet.has(token)).length;
  return overlap / Math.max(left.length, right.length);
}

export function scoreSubstitutionCandidate(current: MatchInput, candidate: MatchInput) {
  const currentNameTokens = tokenise(current.name);
  const candidateNameTokens = tokenise(candidate.name);
  const currentBrandTokens = tokenise(current.brand);
  const candidateBrandTokens = tokenise(candidate.brand);
  const categoryMatch = normalize(current.category) === normalize(candidate.category);
  const nameOverlap = overlapRatio(currentNameTokens, candidateNameTokens);
  const brandOverlap = overlapRatio(currentBrandTokens, candidateBrandTokens);
  const exactBrand = normalize(current.brand) === normalize(candidate.brand);
  const firstTokenMatch = currentNameTokens[0] && currentNameTokens[0] === candidateNameTokens[0];
  const currentPack = current.packageQuantity && current.packageUnit
    ? { quantity: current.packageQuantity, unit: current.packageUnit.toLowerCase() as PackInfo["unit"] }
    : extractPackInfo(current.name);
  const candidatePack = candidate.packageQuantity && candidate.packageUnit
    ? { quantity: candidate.packageQuantity, unit: candidate.packageUnit.toLowerCase() as PackInfo["unit"] }
    : extractPackInfo(candidate.name);
  const samePackUnit = currentPack && candidatePack ? currentPack.unit === candidatePack.unit : false;
  const packRatio = currentPack && candidatePack && samePackUnit
    ? Math.min(currentPack.quantity, candidatePack.quantity) / Math.max(currentPack.quantity, candidatePack.quantity)
    : null;
  const similarPackSize = packRatio !== null ? packRatio >= 0.65 : false;

  const score = Number(
    (
      (categoryMatch ? 0.2 : 0) +
      Math.min(0.45, nameOverlap * 0.75) +
      Math.min(0.2, brandOverlap * 0.35) +
      (exactBrand ? 0.1 : 0) +
      (firstTokenMatch ? 0.1 : 0) +
      (similarPackSize ? 0.15 : currentPack && candidatePack && samePackUnit ? 0.05 : 0)
    ).toFixed(2),
  );

  const reason = exactBrand
    ? similarPackSize
      ? "Samme merke, lignende vare og omtrent samme pakningsstorrelse"
      : "Samme merke og lignende vare"
    : similarPackSize
      ? "Sterk varematch med lignende pakningsstorrelse"
      : nameOverlap >= 0.5
        ? "Sterk navnelikhet i samme kategori"
        : firstTokenMatch
          ? "Lignende varetype i samme kategori"
          : "Kategori- og navnematch";

  return {
    score,
    reason,
    isStrongMatch:
      categoryMatch &&
      (nameOverlap >= 0.34 || exactBrand || firstTokenMatch) &&
      (!currentPack || !candidatePack || !samePackUnit || similarPackSize),
  };
}