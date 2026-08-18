import Link from "next/link";
import { PriceHistoryChart } from "@/components/price-history-chart";
import { prisma } from "@/lib/prisma";
import { filterLogicalPriceEntries, filterOutlierValues } from "@/lib/pricing-sanity";
import { confidenceLabel, formatNok } from "@/lib/utils";

export const revalidate = 300;

export default async function ProductPage({ params }: { params: { id: string } }) {
  const product = await prisma.product.findUnique({
    where: { id: params.id },
    include: {
      prices: {
        include: { store: true },
        where: { isQuarantined: false },
        orderBy: { date: "desc" },
      },
    },
  });

  if (!product) {
    return (
      <main className="mx-auto max-w-5xl px-4 py-10">
        <h1 className="text-2xl font-bold">Produkt ikke funnet</h1>
      </main>
    );
  }

  const latestByStore = new Map<string, (typeof product.prices)[number]>();
  for (const price of product.prices) {
    if (!latestByStore.has(price.storeId)) latestByStore.set(price.storeId, price);
  }

  const sanity = filterLogicalPriceEntries(
    Array.from(latestByStore.values()),
    (entry) => Number(entry.price),
    (entry) => Number(entry.unitPrice),
    {
      category: product.category,
      packageUnit: product.packageUnit,
      packageQuantity: product.packageQuantity,
    },
  );
  const logicalLatestByStore = new Map(sanity.validEntries.map((entry) => [entry.storeId, entry] as const));
  const filteredStoreOutliers = sanity.outlierStoreIds.size;
  const historicalSanity = filterLogicalPriceEntries(
    product.prices,
    (entry) => Number(entry.price),
    (entry) => Number(entry.unitPrice),
    {
      category: product.category,
      packageUnit: product.packageUnit,
      packageQuantity: product.packageQuantity,
    },
  );
  const validHistoricalPrices = historicalSanity.validEntries;

  const dayMs = 24 * 60 * 60 * 1000;
  const historyDays = 45;
  const now = Date.now();
  const historyBuckets = new Map<number, number[]>();
  const storeHistoryBuckets = new Map<string, Map<number, number[]>>();
  const storeLabels = new Map<string, string>();
  for (const price of validHistoricalPrices) {
    const ageDays = Math.floor((now - price.date.getTime()) / dayMs);
    if (ageDays < 0 || ageDays > historyDays - 1) continue;
    const bucketIndex = historyDays - 1 - ageDays;
    const values = historyBuckets.get(bucketIndex) ?? [];
    values.push(Number(price.price));
    historyBuckets.set(bucketIndex, values);

    const storeBuckets = storeHistoryBuckets.get(price.storeId) ?? new Map<number, number[]>();
    const storeValues = storeBuckets.get(bucketIndex) ?? [];
    storeValues.push(Number(price.price));
    storeBuckets.set(bucketIndex, storeValues);
    storeHistoryBuckets.set(price.storeId, storeBuckets);
    storeLabels.set(price.storeId, price.store.name);
  }

  const rawHistory = Array.from({ length: historyDays }).map((_, i) => {
    const bucketDate = new Date(now - (historyDays - 1 - i) * dayMs).toISOString();
    const values = historyBuckets.get(i) ?? [];
    const filteredValues = filterOutlierValues(values).values;
    const averagePrice =
      filteredValues.length > 0
        ? Number((filteredValues.reduce((sum, value) => sum + value, 0) / filteredValues.length).toFixed(2))
        : null;
    return {
      date: bucketDate,
      averagePrice,
    };
  });

  const latestKnownPrice = Number(logicalLatestByStore.values().next().value?.price ?? product.prices[0]?.price ?? 0);
  const history = rawHistory;

  const storeSeries = Array.from(storeHistoryBuckets.entries())
    .map(([storeId]) => ({
      key: storeId,
      label: storeLabels.get(storeId) ?? "Butikk",
    }))
    .sort((left, right) => left.label.localeCompare(right.label, "nb"));

  const storeHistory = Array.from({ length: historyDays }).map((_, i) => {
    const bucketDate = new Date(now - (historyDays - 1 - i) * dayMs).toISOString();
    const storeValues = Object.fromEntries(
      storeSeries.map((series) => {
        const values = storeHistoryBuckets.get(series.key)?.get(i) ?? [];
        const filteredValues = filterOutlierValues(values).values;
        const averagePrice =
          filteredValues.length > 0
            ? Number((filteredValues.reduce((sum, value) => sum + value, 0) / filteredValues.length).toFixed(2))
            : null;

        return [series.key, averagePrice];
      }),
    );

    return {
      date: bucketDate,
      averagePrice: history[i]?.averagePrice ?? null,
      ...storeValues,
    };
  });

  const dataPoints = validHistoricalPrices.length;
  const uniqueStores = logicalLatestByStore.size;
  const latestLogicalPrice = validHistoricalPrices[0] ?? null;
  const latestAgeHours = latestLogicalPrice ? Number(((Date.now() - latestLogicalPrice.date.getTime()) / (1000 * 60 * 60)).toFixed(1)) : null;
  const confidenceScore = Math.max(
    0,
    Math.min(
      100,
      Math.round(
        Math.min(50, dataPoints * 3) +
          Math.min(30, uniqueStores * 10) +
          (latestAgeHours === null ? 0 : Math.max(0, 20 - Math.floor(latestAgeHours / 12))),
      ),
    ),
  );

  const latestObservedPoints = history.filter((entry) => typeof entry.averagePrice === "number").slice(-2);
  const last = latestObservedPoints[latestObservedPoints.length - 1]?.averagePrice ?? latestKnownPrice;
  const prev = latestObservedPoints[latestObservedPoints.length - 2]?.averagePrice ?? last;
  const trendPct = prev > 0 ? Number((((last - prev) / prev) * 100).toFixed(1)) : 0;
  const timingSignal = trendPct <= -3 ? "Kjøp nå" : trendPct >= 3 ? "Vent" : "Nøytral";
  const timingTone = timingSignal === "Kjøp nå" ? "text-emerald-700 dark:text-emerald-300" : timingSignal === "Vent" ? "text-amber-700 dark:text-amber-300" : "text-slate-700 dark:text-slate-300";
  const sourceDiversity = new Set(validHistoricalPrices.map((price) => price.source || "unknown")).size;

  return (
    <main className="mx-auto max-w-6xl px-4 py-10 pb-24 md:pb-10">
      <Link href="/shopping-list" className="text-sm text-emerald-700 hover:underline dark:text-emerald-300">
        Tilbake til handleliste
      </Link>
      <div className="mt-4 rounded-3xl border border-slate-200 bg-white/95 p-6 dark:border-slate-800 dark:bg-slate-900/80 fade-rise">
        <h1 className="text-3xl font-bold tracking-tight">{product.name}</h1>
        <p className="mt-1 text-slate-500 dark:text-slate-400">
          {product.brand} - {product.category}
        </p>

        <section className="mt-5 grid gap-4 md:grid-cols-4 fade-rise-delayed">
          <article className="rounded-2xl border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900">
            <p className="text-xs uppercase tracking-wide text-slate-500">Siste observerte pris</p>
            <p className="mt-1 text-xl font-semibold">{formatNok(latestKnownPrice)}</p>
          </article>
          <article className="rounded-2xl border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900">
            <p className="text-xs uppercase tracking-wide text-slate-500">Timing-signal</p>
            <p className={`mt-1 text-xl font-semibold ${timingTone}`}>{timingSignal}</p>
          </article>
          <article className="rounded-2xl border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900">
            <p className="text-xs uppercase tracking-wide text-slate-500">Trend 1 uke</p>
            <p className={`mt-1 text-xl font-semibold ${trendPct < 0 ? "text-emerald-700 dark:text-emerald-300" : trendPct > 0 ? "text-amber-700 dark:text-amber-300" : ""}`}>
              {trendPct > 0 ? "+" : ""}{trendPct}%
            </p>
          </article>
          <article className="rounded-2xl border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900">
            <p className="text-xs uppercase tracking-wide text-slate-500">Confidence</p>
            <p className="mt-1 text-xl font-semibold">{confidenceLabel(confidenceScore)}</p>
          </article>
        </section>

        <section className="mt-5 grid gap-4 md:grid-cols-4 fade-rise-delayed">
          <article className="rounded-2xl border border-cyan-200 bg-cyan-50/80 p-4 dark:border-cyan-900 dark:bg-cyan-950/25">
            <p className="text-xs uppercase tracking-wide text-cyan-700 dark:text-cyan-300">Observerte butikker</p>
            <p className="mt-1 text-xl font-semibold text-cyan-900 dark:text-cyan-100">{uniqueStores}</p>
          </article>
          <article className="rounded-2xl border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900">
            <p className="text-xs uppercase tracking-wide text-slate-500">Datapunkter</p>
            <p className="mt-1 text-xl font-semibold">{dataPoints}</p>
          </article>
          <article className="rounded-2xl border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900">
            <p className="text-xs uppercase tracking-wide text-slate-500">Nyeste observasjon</p>
            <p className="mt-1 text-xl font-semibold">{latestAgeHours !== null ? `${latestAgeHours} t` : "-"}</p>
          </article>
          <article className="rounded-2xl border border-emerald-200 bg-emerald-50/80 p-4 dark:border-emerald-900 dark:bg-emerald-950/25">
            <p className="text-xs uppercase tracking-wide text-emerald-700 dark:text-emerald-300">Kilder brukt</p>
            <p className="mt-1 text-xl font-semibold text-emerald-900 dark:text-emerald-100">{sourceDiversity}</p>
          </article>
        </section>

        {product.prices.length === 0 ? (
          <section className="mt-6 rounded-2xl border border-amber-200 bg-amber-50/70 p-4 text-sm dark:border-amber-900 dark:bg-amber-950/30">
            <p className="font-medium text-amber-800 dark:text-amber-300">Ingen prislinjer for dette produktet ennå</p>
            <p className="mt-1 text-amber-700 dark:text-amber-200">Legg inn priser i adminpanelet eller kjør live-synk for å fylle historikk og sammenligning.</p>
          </section>
        ) : null}

        <section className="mt-8 grid gap-4 lg:grid-cols-2 fade-rise-slow">
          <div className="rounded-2xl border border-slate-200 p-4 dark:border-slate-800">
            <h2 className="mb-3 text-lg font-semibold">Pris i alle butikker</h2>
            {logicalLatestByStore.size === 0 ? (
              <p className="text-sm text-slate-500 dark:text-slate-400">Ingen butikker med tilgjengelig pris ennå.</p>
            ) : (
              <ul className="space-y-2 text-sm">
                {Array.from(logicalLatestByStore.values()).map((price) => (
                  <li key={price.id} className="rounded-lg border border-slate-200 px-3 py-3 dark:border-slate-800">
                    <div className="flex items-center justify-between gap-3">
                      <span>{price.store.name}</span>
                      <span className="font-medium">{formatNok(Number(price.price))}</span>
                    </div>
                    <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                      Kilde: {price.source || "ukjent"} · observert {Number(((Date.now() - price.date.getTime()) / (1000 * 60 * 60)).toFixed(1))} t siden
                      {price.sourceUrl ? (
                        <>
                          {" "}· <a href={price.sourceUrl} className="font-medium text-emerald-700 hover:underline dark:text-emerald-300">kildelenke</a>
                        </>
                      ) : null}
                    </p>
                  </li>
                ))}
              </ul>
            )}
            {filteredStoreOutliers > 0 ? (
              <p className="mt-3 rounded-lg border border-amber-200 bg-amber-50/70 px-3 py-2 text-xs text-amber-900 dark:border-amber-900 dark:bg-amber-950/30 dark:text-amber-200">
                {filteredStoreOutliers} butikkpris(er) er skjult fordi de avviker kraftig fra normalnivået for produktet.
              </p>
            ) : null}
            <p className="mt-3 text-xs text-slate-500">Pris per enhet: {formatNok(Number(product.prices[0]?.unitPrice ?? 0))}</p>
          </div>

          <div>
            <h2 className="mb-3 text-lg font-semibold">Prishistorikk</h2>
            <PriceHistoryChart data={storeHistory} series={storeSeries} />
            <p className="mt-3 text-sm text-slate-600 dark:text-slate-300">
              Confidence score: <span className="font-medium">{confidenceLabel(confidenceScore)}</span> ({dataPoints} datapunkter)
            </p>
            <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
              Butikker: {uniqueStores} · Nyeste observasjon: {latestAgeHours !== null ? `${latestAgeHours} timer siden` : "-"}
            </p>
            <p className={`mt-1 text-xs font-medium ${timingTone}`}>
              Best buy window: {timingSignal === "Kjøp nå" ? "Prisene peker ned. Vinduet er gunstig akkurat nå." : timingSignal === "Vent" ? "Prisene peker opp. Vent hvis du kan." : "Ingen tydelig signalretning nå."}
            </p>
            <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
              Vi viser confidence eksplisitt slik at du ser om datagrunnlaget er sterkt eller svakt.
            </p>
            <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
              Se full metodikk på <Link href="/confidence" className="font-medium text-emerald-700 hover:underline dark:text-emerald-300">prisgrunnlag og metodikk</Link>.
            </p>
          </div>
        </section>
      </div>

      <div className="mobile-bottom-bar fixed inset-x-0 bottom-0 z-40 border-t border-slate-200 bg-white/95 p-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] backdrop-blur md:hidden dark:border-slate-800 dark:bg-slate-950/90">
        <div className="mobile-bottom-actions mx-auto grid max-w-6xl grid-cols-2 gap-2">
          <Link href="/alerts" className="mobile-bottom-action min-w-0 rounded-xl border border-slate-300 px-2.5 py-2 text-center text-[13px] font-medium leading-tight sm:px-3 sm:text-sm dark:border-slate-700">
            Sett varsel
          </Link>
          <Link href="/compare" className="mobile-bottom-action min-w-0 rounded-xl bg-emerald-600 px-2.5 py-2 text-center text-[13px] font-medium leading-tight text-white sm:px-3 sm:text-sm">
            Sammenlign nå
          </Link>
        </div>
      </div>
    </main>
  );
}
