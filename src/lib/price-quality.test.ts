import { describe, expect, it } from "vitest";

import { assessPriceRowQuality } from "@/lib/price-quality";

describe("assessPriceRowQuality", () => {
  it("accepts row with strong product/url alignment", () => {
    const result = assessPriceRowQuality({
      productName: "Lettmelk 1,0% 1,75 l",
      productBrand: "Tine",
      source: "meny",
      sourceUrl: "https://butikk.no/produkt/tine-lettmelk-1-0-175l",
      packageQuantity: 1750,
      packageUnit: "ML",
      price: 34.9,
      unitPrice: 19.94,
    });

    expect(result.accepted).toBe(true);
    expect(result.score).toBeGreaterThanOrEqual(60);
  });

  it("rejects row with poor name overlap and package mismatch", () => {
    const result = assessPriceRowQuality({
      productName: "Lettmelk 1,0% 1,75 l",
      productBrand: "Tine",
      source: "meny",
      sourceUrl: "https://butikk.no/produkt/toalettpapir-16pk",
      packageQuantity: 1750,
      packageUnit: "ML",
      price: 34.9,
      unitPrice: 19.94,
    });

    expect(result.accepted).toBe(false);
    expect(result.reasons.includes("low_name_overlap") || result.reasons.includes("package_mismatch")).toBe(true);
  });
});
