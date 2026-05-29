import { describe, expect, it } from "vitest";

import { buildReceiptSavingsInsight } from "@/lib/verified-savings";

describe("buildReceiptSavingsInsight", () => {
  it("computes savings insight from recognized receipt items", () => {
    const insight = buildReceiptSavingsInsight(
      {
        detectedStore: "Kiwi",
        detectedTotal: 45,
        recognizedItems: [
          { label: "Lettmelk", amount: 20, quantity: 1, kind: "item" },
          { label: "Havregryn", amount: 25, quantity: 1, kind: "item" },
        ],
      },
      [
        {
          id: "p1",
          name: "Lettmelk",
          brand: "Tine",
          prices: [
            { storeId: "kiwi", storeName: "Kiwi", price: 19 },
            { storeId: "rema", storeName: "Rema 1000", price: 17 },
          ],
        },
        {
          id: "p2",
          name: "Havregryn",
          brand: "Axa",
          prices: [
            { storeId: "kiwi", storeName: "Kiwi", price: 24 },
            { storeId: "rema", storeName: "Rema 1000", price: 20 },
          ],
        },
      ],
    );

    expect(insight.actualTotal).toBe(45);
    expect(insight.estimatedCheapestTotal).toBe(37);
    expect(insight.estimatedDetectedStoreTotal).toBe(43);
    expect(insight.verifiedSavings).toBe(8);
    expect(insight.matchedItems).toBe(2);
    expect(insight.totalItems).toBe(2);
    expect(insight.confidence).toBe("medium");
  });
});
