import { describe, expect, it } from "vitest";

import { evaluateReceiptTruthSummary } from "@/lib/quality-monitor";

describe("evaluateReceiptTruthSummary", () => {
  it("returns pass when receipt truth metrics meet thresholds", () => {
    const samples = Array.from({ length: 22 }).map(() => ({
      detectedTotal: 100,
      estimatedDetectedStoreTotal: 97,
      matchedItems: 8,
      totalItems: 10,
      confidence: "hoy",
    }));

    const report = evaluateReceiptTruthSummary(samples);

    expect(report.checks.minimumSample).toBe(true);
    expect(report.checks.matchRate).toBe(true);
    expect(report.checks.highConfidence).toBe(true);
    expect(report.checks.priceError).toBe(true);
    expect(report.overallPass).toBe(true);
  });

  it("returns fail when data quality is weak", () => {
    const samples = Array.from({ length: 8 }).map(() => ({
      detectedTotal: 100,
      estimatedDetectedStoreTotal: 120,
      matchedItems: 2,
      totalItems: 10,
      confidence: "lav",
    }));

    const report = evaluateReceiptTruthSummary(samples);

    expect(report.checks.minimumSample).toBe(false);
    expect(report.overallPass).toBe(false);
  });
});
