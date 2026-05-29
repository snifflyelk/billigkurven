type ParsedReceiptItem = {
  label?: unknown;
  amount?: unknown;
  quantity?: unknown;
  kind?: unknown;
};

type ProductPrice = {
  storeId: string;
  price: number;
  storeName: string;
};

type ProductCandidate = {
  id: string;
  name: string;
  brand: string;
  prices: ProductPrice[];
};

export type ReceiptSavingsInsight = {
  actualTotal: number | null;
  estimatedCheapestTotal: number | null;
  estimatedDetectedStoreTotal: number | null;
  verifiedSavings: number | null;
  matchedItems: number;
  totalItems: number;
  confidence: "lav" | "medium" | "hoy";
  note: string;
};

function normalize(input: string) {
  return input
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9æøå]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function tokenScore(source: string, target: string) {
  const sourceTokens = normalize(source).split(" ").filter(Boolean);
  const targetTokens = new Set(normalize(target).split(" ").filter(Boolean));

  let score = 0;
  for (const token of sourceTokens) {
    if (targetTokens.has(token)) score += 3;
    else if (Array.from(targetTokens).some((candidate) => candidate.includes(token) || token.includes(candidate))) score += 1;
  }

  return score;
}

function asNumber(value: unknown) {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string") {
    const parsed = Number(value.replace(",", "."));
    return Number.isFinite(parsed) ? parsed : null;
  }
  return null;
}

export function buildReceiptSavingsInsight(
  input: {
    detectedStore: string | null;
    detectedTotal: number | string | null;
    recognizedItems: unknown;
  },
  products: ProductCandidate[],
): ReceiptSavingsInsight {
  const parsedItems = Array.isArray(input.recognizedItems)
    ? (input.recognizedItems as ParsedReceiptItem[])
        .map((item) => ({
          label: typeof item.label === "string" ? item.label : "",
          amount: asNumber(item.amount),
          quantity: asNumber(item.quantity) ?? 1,
          kind: typeof item.kind === "string" ? item.kind : "item",
        }))
        .filter((item) => item.label && item.amount && item.amount > 0 && item.kind === "item")
    : [];

  const totalItems = parsedItems.length;
  const actualTotalFromDetected = asNumber(input.detectedTotal);
  const actualTotalFromLines = parsedItems.reduce((sum, item) => sum + Number(item.amount ?? 0), 0);
  const actualTotal = actualTotalFromDetected ?? (actualTotalFromLines > 0 ? Number(actualTotalFromLines.toFixed(2)) : null);

  if (parsedItems.length === 0) {
    return {
      actualTotal,
      estimatedCheapestTotal: null,
      estimatedDetectedStoreTotal: null,
      verifiedSavings: null,
      matchedItems: 0,
      totalItems: 0,
      confidence: "lav",
      note: "Ingen gjenkjente varelinjer i kvitteringen.",
    };
  }

  const totalsByStore = new Map<string, { storeName: string; total: number }>();
  let matchedItems = 0;

  for (const item of parsedItems) {
    let bestMatch: ProductCandidate | null = null;
    let bestScore = 0;

    for (const product of products) {
      const score = tokenScore(item.label, `${product.name} ${product.brand}`);
      if (score > bestScore) {
        bestScore = score;
        bestMatch = product;
      }
    }

    if (!bestMatch || bestScore < 3) continue;
    matchedItems += 1;

    for (const price of bestMatch.prices) {
      const quantity = item.quantity && item.quantity > 0 ? item.quantity : 1;
      const lineTotal = price.price * quantity;
      const existing = totalsByStore.get(price.storeId);
      if (existing) {
        existing.total += lineTotal;
      } else {
        totalsByStore.set(price.storeId, { storeName: price.storeName, total: lineTotal });
      }
    }
  }

  const totals = Array.from(totalsByStore.values()).map((entry) => ({
    storeName: entry.storeName,
    total: Number(entry.total.toFixed(2)),
  }));

  const cheapest = totals.length > 0
    ? totals.reduce((best, current) => (current.total < best.total ? current : best))
    : null;

  const detectedStoreName = input.detectedStore ? normalize(input.detectedStore) : "";
  const detectedStoreEstimate = detectedStoreName
    ? totals.find((entry) => normalize(entry.storeName).includes(detectedStoreName) || detectedStoreName.includes(normalize(entry.storeName)))
    : null;

  const verifiedSavings = actualTotal !== null && cheapest
    ? Number((actualTotal - cheapest.total).toFixed(2))
    : null;

  const matchRatio = totalItems > 0 ? matchedItems / totalItems : 0;
  const confidence: "lav" | "medium" | "hoy" =
    matchRatio >= 0.75 && matchedItems >= 4 ? "hoy" : matchRatio >= 0.45 && matchedItems >= 2 ? "medium" : "lav";

  const note =
    confidence === "hoy"
      ? "Verifisert spareestimat med god datadekning."
      : confidence === "medium"
      ? "Delvis verifisert spareestimat basert på matcher i kvitteringen."
      : "Lav verifikasjon: for få sikre varematcher mot prisdatabasen.";

  return {
    actualTotal,
    estimatedCheapestTotal: cheapest ? cheapest.total : null,
    estimatedDetectedStoreTotal: detectedStoreEstimate ? detectedStoreEstimate.total : null,
    verifiedSavings,
    matchedItems,
    totalItems,
    confidence,
    note,
  };
}
