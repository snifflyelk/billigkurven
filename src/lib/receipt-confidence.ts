export type ReceiptConfidenceLevel = "lav" | "medium" | "hoy";

export function calculateReceiptConfidence({
  coverageRatio,
  dataPoints,
  userSignals,
}: {
  coverageRatio: number;
  dataPoints: number;
  userSignals: number;
}): ReceiptConfidenceLevel {
  const weightedScore = coverageRatio * 60 + Math.min(dataPoints, 12) * 2 + Math.min(userSignals, 5) * 4;

  if (weightedScore >= 70) return "hoy";
  if (weightedScore >= 40) return "medium";
  return "lav";
}
