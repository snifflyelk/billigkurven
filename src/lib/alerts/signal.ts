type PricePoint = {
  price: number;
  date: Date;
};

export type TimingRecommendation = "kjop-na" | "vent" | "noytral" | "ukjent";

function avg(values: number[]) {
  if (values.length === 0) return null;
  return values.reduce((sum, value) => sum + value, 0) / values.length;
}

export function buildTimingSignal(prices: PricePoint[]) {
  const nowMs = Date.now();
  const dayMs = 24 * 60 * 60 * 1000;
  const sorted = prices.slice().sort((left, right) => right.date.getTime() - left.date.getTime());

  const last7 = sorted.filter((row) => nowMs - row.date.getTime() <= 7 * dayMs).map((row) => row.price);
  const previous7 = sorted
    .filter((row) => {
      const ageMs = nowMs - row.date.getTime();
      return ageMs > 7 * dayMs && ageMs <= 14 * dayMs;
    })
    .map((row) => row.price);

  const last7Avg = avg(last7);
  const previous7Avg = avg(previous7);
  const changePct =
    last7Avg !== null && previous7Avg !== null && previous7Avg > 0
      ? Number((((last7Avg - previous7Avg) / previous7Avg) * 100).toFixed(1))
      : null;

  const recommendation: TimingRecommendation =
    changePct === null ? "ukjent" : changePct <= -3 ? "kjop-na" : changePct >= 3 ? "vent" : "noytral";

  return {
    recommendation,
    changePct,
    last7Avg: last7Avg !== null ? Number(last7Avg.toFixed(2)) : null,
    previous7Avg: previous7Avg !== null ? Number(previous7Avg.toFixed(2)) : null,
  };
}

export function buildAlertUrgency(args: {
  latestPrice: number | null;
  targetPrice: number | null;
  recommendation: TimingRecommendation;
}) {
  if (args.latestPrice !== null && args.targetPrice !== null) {
    const delta = Number((args.latestPrice - args.targetPrice).toFixed(2));
    if (delta <= 0) return { level: "hoy", label: "Maal oppnadd" } as const;
    if (delta <= 3) return { level: "medium", label: "Nesten der" } as const;
  }

  if (args.recommendation === "kjop-na") return { level: "medium", label: "Kjop-na signal" } as const;
  if (args.recommendation === "vent") return { level: "lav", label: "Vent signal" } as const;
  return { level: "lav", label: "Ingen sterk trigger" } as const;
}
