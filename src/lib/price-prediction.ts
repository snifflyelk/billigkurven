type PricePoint = {
  price: number;
  date: Date;
};

type TimingAction = "kjop-na" | "vent" | "ukjent";

function avg(values: number[]) {
  if (values.length === 0) return null;
  return values.reduce((sum, value) => sum + value, 0) / values.length;
}

function stddev(values: number[]) {
  if (values.length < 2) return null;
  const mean = avg(values);
  if (mean === null) return null;
  const variance = values.reduce((sum, value) => sum + (value - mean) ** 2, 0) / values.length;
  return Math.sqrt(variance);
}

function inLastDays(points: PricePoint[], days: number, nowMs: number) {
  const dayMs = 24 * 60 * 60 * 1000;
  return points.filter((point) => nowMs - point.date.getTime() <= days * dayMs).map((point) => point.price);
}

export function buildBuyWindowPrediction(points: PricePoint[]) {
  const nowMs = Date.now();
  const sorted = points
    .filter((point) => Number.isFinite(point.price) && point.price > 0)
    .sort((left, right) => right.date.getTime() - left.date.getTime());

  if (sorted.length === 0) {
    return {
      buyWindowScore: null,
      confidencePct: null,
      action: "ukjent" as TimingAction,
      windowHint: "Ikke nok data",
      changePct7v30: null,
      dropFrom30Pct: null,
      dropFrom60Pct: null,
      dropFrom90Pct: null,
    };
  }

  const latestPrice = sorted[0].price;
  const last7 = inLastDays(sorted, 7, nowMs);
  const last30 = inLastDays(sorted, 30, nowMs);
  const last60 = inLastDays(sorted, 60, nowMs);
  const last90 = inLastDays(sorted, 90, nowMs);

  const avg7 = avg(last7);
  const avg30 = avg(last30);
  const avg60 = avg(last60);
  const avg90 = avg(last90);

  const changePct7v30 =
    avg7 !== null && avg30 !== null && avg30 > 0
      ? Number((((avg7 - avg30) / avg30) * 100).toFixed(1))
      : null;

  const dropFrom30Pct =
    avg30 !== null && avg30 > 0
      ? Number((((avg30 - latestPrice) / avg30) * 100).toFixed(1))
      : null;
  const dropFrom60Pct =
    avg60 !== null && avg60 > 0
      ? Number((((avg60 - latestPrice) / avg60) * 100).toFixed(1))
      : null;
  const dropFrom90Pct =
    avg90 !== null && avg90 > 0
      ? Number((((avg90 - latestPrice) / avg90) * 100).toFixed(1))
      : null;

  const longTermDropCandidates = [dropFrom30Pct, dropFrom60Pct, dropFrom90Pct].filter(
    (value): value is number => value !== null,
  );
  const longTermDrop =
    longTermDropCandidates.length > 0
      ? Number((longTermDropCandidates.reduce((sum, value) => sum + value, 0) / longTermDropCandidates.length).toFixed(1))
      : null;

  const volatility = stddev(last30);
  const volatilityPenalty =
    volatility === null || avg30 === null || avg30 <= 0
      ? 0
      : Math.min(20, Math.round((volatility / avg30) * 100));

  const valueSignal = longTermDrop === null ? 0 : Math.max(-20, Math.min(25, longTermDrop * 2));
  const momentumSignal = changePct7v30 === null ? 0 : Math.max(-20, Math.min(20, -changePct7v30 * 2));
  const rawScore = 50 + valueSignal + momentumSignal - volatilityPenalty;
  const buyWindowScore = Math.max(0, Math.min(100, Math.round(rawScore)));

  const sampleSize = last30.length;
  const confidencePct = Math.max(30, Math.min(95, Math.round(sampleSize * 2.2) - volatilityPenalty));

  const action: TimingAction =
    buyWindowScore >= 62 ? "kjop-na" : buyWindowScore <= 38 ? "vent" : "ukjent";

  const windowHint =
    action === "kjop-na"
      ? "Best innen 48 timer"
      : action === "vent"
        ? "Vent 3-7 dager"
        : "Folg pris i 2-3 dager";

  return {
    buyWindowScore,
    confidencePct,
    action,
    windowHint,
    changePct7v30,
    dropFrom30Pct,
    dropFrom60Pct,
    dropFrom90Pct,
  };
}
