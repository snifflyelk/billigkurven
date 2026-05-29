import { describe, expect, it } from "vitest";

import { filterLogicalPriceEntries } from "@/lib/pricing-sanity";

type Entry = {
  storeId: string;
  price: number;
  unitPrice: number;
};

describe("filterLogicalPriceEntries", () => {
  it("filters clear outlier prices and reports store ids", () => {
    const entries: Entry[] = [
      { storeId: "a", price: 19.9, unitPrice: 19.9 },
      { storeId: "b", price: 21.5, unitPrice: 21.5 },
      { storeId: "c", price: 20.2, unitPrice: 20.2 },
      { storeId: "outlier", price: 149.0, unitPrice: 149.0 },
    ];

    const result = filterLogicalPriceEntries(entries, (entry) => entry.price, (entry) => entry.unitPrice);

    expect(result.validEntries).toHaveLength(3);
    expect(result.validEntries.map((entry) => entry.storeId)).toEqual(["a", "b", "c"]);
    expect(result.outlierStoreIds.has("outlier")).toBe(true);
    expect(result.medianPrice).toBeCloseTo(20.85, 2);
  });
});
