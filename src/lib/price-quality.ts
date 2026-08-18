type PackageUnit = "G" | "ML" | "STK";

type PriceRowQualityInput = {
  productName: string;
  productBrand: string;
  source: string;
  sourceUrl: string | null;
  packageQuantity: number | null;
  packageUnit: PackageUnit | null;
  price: number;
  unitPrice: number;
};

export type PriceRowQualityAssessment = {
  accepted: boolean;
  score: number;
  reasons: string[];
  metrics: {
    nameOverlap: number;
    brandOverlap: number;
    packageMatch: "match" | "mismatch" | "unknown";
  };
};

type PackHint = {
  quantity: number;
  unit: "g" | "ml" | "stk";
};

const NOISE_TOKENS = new Set(["g", "kg", "ml", "l", "stk", "pk", "pakke", "pose", "ca"]);

function normalize(input: string) {
  return input
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/æ/g, "ae")
    .replace(/ø/g, "o")
    .replace(/å/g, "a")
    .replace(/[^a-z0-9]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function tokenSet(input: string) {
  return new Set(
    normalize(input)
      .split(" ")
      .filter(Boolean)
      .filter((token) => !NOISE_TOKENS.has(token))
      .filter((token) => !/^\d+(?:[.,]\d+)?$/.test(token)),
  );
}

function overlap(left: Set<string>, right: Set<string>) {
  if (left.size === 0 || right.size === 0) return 0;
  let shared = 0;
  for (const token of Array.from(left.values())) {
    if (right.has(token)) shared += 1;
  }
  return shared / left.size;
}

function parsePercent(text: string) {
  const match = normalize(text).replace(/\s+/g, "").match(/(\d+(?:[.,]\d+)?)%/);
  if (!match?.[1]) return null;
  const value = Number(match[1].replace(",", "."));
  return Number.isFinite(value) ? value : null;
}

function parsePackHint(text: string): PackHint | null {
  const cleaned = normalize(text);

  const kg = cleaned.match(/(\d+(?:[.,]\d+)?)\s*kg\b/);
  if (kg?.[1]) return { quantity: Number(kg[1].replace(",", ".")) * 1000, unit: "g" };

  const g = cleaned.match(/(\d+(?:[.,]\d+)?)\s*g\b/);
  if (g?.[1]) return { quantity: Number(g[1].replace(",", ".")), unit: "g" };

  const l = cleaned.match(/(\d+(?:[.,]\d+)?)\s*l\b/);
  if (l?.[1]) return { quantity: Number(l[1].replace(",", ".")) * 1000, unit: "ml" };

  const ml = cleaned.match(/(\d+(?:[.,]\d+)?)\s*ml\b/);
  if (ml?.[1]) return { quantity: Number(ml[1].replace(",", ".")), unit: "ml" };

  const stk = cleaned.match(/(\d+(?:[.,]\d+)?)\s*(?:stk|pk|pakke)\b/);
  if (stk?.[1]) return { quantity: Number(stk[1].replace(",", ".")), unit: "stk" };

  return null;
}

function packageMatch(
  productQuantity: number | null,
  productUnit: PackageUnit | null,
  sourceUrl: string | null,
): "match" | "mismatch" | "unknown" {
  if (!sourceUrl || !productQuantity || !productUnit) return "unknown";

  const sourceHint = parsePackHint(sourceUrl);
  if (!sourceHint) return "unknown";

  const productBaseUnit = productUnit === "G" ? "g" : productUnit === "ML" ? "ml" : "stk";
  if (sourceHint.unit !== productBaseUnit) return "mismatch";

  const maxValue = Math.max(productQuantity, sourceHint.quantity);
  const tolerance = sourceHint.unit === "stk" ? 0.2 : Math.max(40, maxValue * 0.1);
  return Math.abs(productQuantity - sourceHint.quantity) <= tolerance ? "match" : "mismatch";
}

export function assessPriceRowQuality(input: PriceRowQualityInput): PriceRowQualityAssessment {
  const reasons: string[] = [];

  if (!Number.isFinite(input.price) || input.price <= 0) {
    return {
      accepted: false,
      score: 0,
      reasons: ["non_positive_price"],
      metrics: {
        nameOverlap: 0,
        brandOverlap: 0,
        packageMatch: "unknown",
      },
    };
  }

  if (!Number.isFinite(input.unitPrice) || input.unitPrice <= 0) {
    return {
      accepted: false,
      score: 0,
      reasons: ["non_positive_unit_price"],
      metrics: {
        nameOverlap: 0,
        brandOverlap: 0,
        packageMatch: "unknown",
      },
    };
  }

  let score = 100;

  const sourceText = input.sourceUrl ?? "";
  const productNameTokens = tokenSet(input.productName);
  const productBrandTokens = tokenSet(input.productBrand);
  const sourceTokens = tokenSet(sourceText);

  const nameOverlap = overlap(productNameTokens, sourceTokens);
  const brandOverlap = overlap(productBrandTokens, sourceTokens);

  if (!input.sourceUrl) {
    score -= 15;
    reasons.push("missing_source_url");
  }

  if (nameOverlap < 0.18) {
    score -= 45;
    reasons.push("low_name_overlap");
  } else if (nameOverlap < 0.3) {
    score -= 20;
    reasons.push("weak_name_overlap");
  }

  if (brandOverlap === 0) {
    score -= 10;
    reasons.push("missing_brand_anchor");
  }

  const productPercent = parsePercent(input.productName);
  const sourcePercent = parsePercent(sourceText);
  if (productPercent !== null && sourcePercent !== null && Math.abs(productPercent - sourcePercent) > 0.2) {
    score -= 20;
    reasons.push("variant_percent_mismatch");
  }

  const pack = packageMatch(input.packageQuantity, input.packageUnit, input.sourceUrl);
  if (pack === "mismatch") {
    score -= 30;
    reasons.push("package_mismatch");
  }

  if (["meny", "spar", "joker"].includes(input.source.toLowerCase()) && nameOverlap < 0.22) {
    score -= 10;
    reasons.push("source_specific_low_anchor");
  }

  score = Math.max(0, Math.round(score));
  const accepted = score >= 60;

  return {
    accepted,
    score,
    reasons,
    metrics: {
      nameOverlap: Number(nameOverlap.toFixed(2)),
      brandOverlap: Number(brandOverlap.toFixed(2)),
      packageMatch: pack,
    },
  };
}
