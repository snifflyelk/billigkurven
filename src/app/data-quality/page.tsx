import Link from "next/link";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

function daysSince(date: Date) {
  const diffMs = Date.now() - date.getTime();
  return diffMs / (1000 * 60 * 60 * 24);
}

function pct(value: number) {
  return `${Math.round(value * 100)}%`;
}

function diffBadge(current: number | null, previous: number | null, inverseGood = false) {
  if (current === null || previous === null) return "n/a";
  const diff = current - previous;
  const improved = inverseGood ? diff < 0 : diff > 0;
  const sign = diff > 0 ? "+" : "";
  return `${improved ? "forbedret" : "endret"} ${sign}${diff.toFixed(1)}`;
}

function computeCoverageFromPrices(
  products: { id: string }[],
  prices: { productId: string; storeId: string }[],
) {
  if (products.length === 0) return 0;

  const storesByProduct = new Map<string, Set<string>>();
  for (const price of prices) {
    const current = storesByProduct.get(price.productId) ?? new Set<string>();
    current.add(price.storeId);
    storesByProduct.set(price.productId, current);
  }

  const covered = products.filter((product) => (storesByProduct.get(product.id)?.size ?? 0) >= 2).length;
  return covered / products.length;
}

export default async function DataQualityPage() {
  const now = new Date();
  const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
  const fourteenDaysAgo = new Date(now.getTime() - 14 * 24 * 60 * 60 * 1000);
  const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
  const sixtyDaysAgo = new Date(now.getTime() - 60 * 24 * 60 * 60 * 1000);

  const [products, stores, prices, receipts] = await Promise.all([
    prisma.product.findMany({
      include: {
        prices: {
          include: { store: true },
          orderBy: { date: "desc" },
        },
      },
    }),
    prisma.store.count(),
    prisma.price.findMany({ orderBy: { date: "desc" }, take: 2000 }),
    prisma.receiptSubmission.findMany({ orderBy: { createdAt: "desc" }, take: 500 }),
  ]);

  const latestByProductStore = new Map<string, Date>();
  for (const price of prices) {
    const key = `${price.productId}:${price.storeId}`;
    if (!latestByProductStore.has(key)) {
      latestByProductStore.set(key, price.date);
    }
  }

  const freshnessDays = Array.from(latestByProductStore.values()).map(daysSince);
  const avgFreshnessDays = freshnessDays.length > 0
    ? Number((freshnessDays.reduce((sum, value) => sum + value, 0) / freshnessDays.length).toFixed(2))
    : null;

  const productsWithTwoStores = products.filter((product) => {
    const uniqueStores = new Set(product.prices.map((price) => price.storeId));
    return uniqueStores.size >= 2;
  }).length;

  const coverageRatio = products.length > 0 ? productsWithTwoStores / products.length : 0;
  const reviewedReceipts = receipts.filter((receipt) => receipt.status === "REVIEWED").length;
  const rejectedReceipts = receipts.filter((receipt) => receipt.status === "REJECTED").length;
  const reviewRate = receipts.length > 0 ? (reviewedReceipts + rejectedReceipts) / receipts.length : 0;

  const sourceCounts = prices.reduce<Record<string, number>>((acc, price) => {
    const key = price.source || "unknown";
    acc[key] = (acc[key] ?? 0) + 1;
    return acc;
  }, {});

  const latestSources = Object.entries(sourceCounts).sort((a, b) => b[1] - a[1]);

  const [pricesLast7, pricesPrev7, pricesLast30, pricesPrev30] = await Promise.all([
    prisma.price.findMany({ where: { date: { gte: sevenDaysAgo, lte: now } }, select: { productId: true, storeId: true, date: true } }),
    prisma.price.findMany({ where: { date: { gte: fourteenDaysAgo, lt: sevenDaysAgo } }, select: { productId: true, storeId: true, date: true } }),
    prisma.price.findMany({ where: { date: { gte: thirtyDaysAgo, lte: now } }, select: { productId: true, storeId: true, date: true } }),
    prisma.price.findMany({ where: { date: { gte: sixtyDaysAgo, lt: thirtyDaysAgo } }, select: { productId: true, storeId: true, date: true } }),
  ]);

  const coverage7 = computeCoverageFromPrices(products.map((p) => ({ id: p.id })), pricesLast7);
  const coveragePrev7 = computeCoverageFromPrices(products.map((p) => ({ id: p.id })), pricesPrev7);
  const coverage30 = computeCoverageFromPrices(products.map((p) => ({ id: p.id })), pricesLast30);
  const coveragePrev30 = computeCoverageFromPrices(products.map((p) => ({ id: p.id })), pricesPrev30);

  const freshness7 = pricesLast7.length > 0
    ? Number((pricesLast7.reduce((sum, p) => sum + daysSince(p.date), 0) / pricesLast7.length).toFixed(2))
    : null;
  const freshnessPrev7 = pricesPrev7.length > 0
    ? Number((pricesPrev7.reduce((sum, p) => sum + daysSince(p.date), 0) / pricesPrev7.length).toFixed(2))
    : null;
  const freshness30 = pricesLast30.length > 0
    ? Number((pricesLast30.reduce((sum, p) => sum + daysSince(p.date), 0) / pricesLast30.length).toFixed(2))
    : null;
  const freshnessPrev30 = pricesPrev30.length > 0
    ? Number((pricesPrev30.reduce((sum, p) => sum + daysSince(p.date), 0) / pricesPrev30.length).toFixed(2))
    : null;

  const coverageScore = Math.round(coverageRatio * 100);
  const freshnessScore = avgFreshnessDays !== null ? Math.max(0, Math.min(100, Math.round((1 - avgFreshnessDays / 14) * 100))) : 0;
  const sourceScore = Math.max(0, Math.min(100, latestSources.length * 25));
  const trustScore = Math.round(coverageScore * 0.5 + freshnessScore * 0.3 + sourceScore * 0.2);
  const trustBand = trustScore >= 75 ? "Sterk" : trustScore >= 45 ? "Moderat" : "Svak";

  return (
    <main className="mx-auto max-w-6xl px-4 py-10">
      <h1 className="text-3xl font-bold tracking-tight">Data quality dashboard</h1>
      <p className="mt-2 text-slate-600 dark:text-slate-300">
        Oversikt over datadekning, friskhet og verifisering for beslutningsmotoren i Billigkurven.
      </p>

      <section className="mt-5 rounded-3xl border border-cyan-200 bg-gradient-to-br from-cyan-50 via-white to-emerald-50 p-5 fade-rise dark:border-cyan-900 dark:from-cyan-950/20 dark:via-slate-950 dark:to-emerald-950/20">
        <p className="text-xs font-semibold uppercase tracking-wide text-cyan-700 dark:text-cyan-300">Tillitsstatus</p>
        <div className="mt-1 flex flex-wrap items-end gap-3">
          <h2 className="text-3xl font-bold">{trustScore}/100</h2>
          <span className="rounded-full border border-slate-300 bg-white px-2.5 py-1 text-xs font-semibold dark:border-slate-700 dark:bg-slate-900">{trustBand}</span>
        </div>
        <p className="mt-2 text-sm text-slate-700 dark:text-slate-200">Bruk denne scoren for a avgjore hvor aggressiv anbefalingsmotoren skal være.</p>
      </section>

      <section className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4 fade-rise-delayed">
        <article className="rounded-2xl border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900">
          <p className="text-sm text-slate-500">Produkter</p>
          <p className="mt-1 text-2xl font-semibold">{products.length}</p>
        </article>
        <article className="rounded-2xl border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900">
          <p className="text-sm text-slate-500">Butikker</p>
          <p className="mt-1 text-2xl font-semibold">{stores}</p>
        </article>
        <article className="rounded-2xl border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900">
          <p className="text-sm text-slate-500">Kurvdekning (&gt;=2 butikker)</p>
          <p className="mt-1 text-2xl font-semibold">{Math.round(coverageRatio * 100)}%</p>
        </article>
        <article className="rounded-2xl border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900">
          <p className="text-sm text-slate-500">Gj.sn. prisalder</p>
          <p className="mt-1 text-2xl font-semibold">{avgFreshnessDays !== null ? `${avgFreshnessDays} d` : "-"}</p>
        </article>
      </section>

      <section className="mt-8 grid gap-6 lg:grid-cols-[1.1fr_0.9fr] fade-rise-slow">
        <article className="rounded-2xl border border-slate-200 bg-white p-5 dark:border-slate-800 dark:bg-slate-900">
          <h2 className="text-lg font-semibold">Kvalitetssignaler</h2>
          <ul className="mt-3 space-y-2 text-sm text-slate-600 dark:text-slate-300">
            <li>Prislinjer totalt: {prices.length}</li>
            <li>Produkter med bred dekning: {productsWithTwoStores}/{products.length}</li>
            <li>Kvitteringer behandlet: {Math.round(reviewRate * 100)}%</li>
            <li>Godkjent: {reviewedReceipts} · Avvist: {rejectedReceipts} · Totalt: {receipts.length}</li>
          </ul>
          <p className="mt-4 text-xs text-slate-500 dark:text-slate-400">
            Dette dashboardet brukes til å styre forbedring av dekning, friskhet og confidence-gating i sammenligningen.
          </p>
        </article>

        <article className="rounded-2xl border border-slate-200 bg-white p-5 dark:border-slate-800 dark:bg-slate-900">
          <h2 className="text-lg font-semibold">Kildemiks</h2>
          <ul className="mt-3 space-y-2 text-sm">
            {latestSources.length === 0 ? (
              <li className="text-slate-500 dark:text-slate-400">Ingen kildeinformasjon ennå.</li>
            ) : (
              latestSources.map(([source, count]) => (
                <li key={source} className="flex items-center justify-between rounded-lg border border-slate-200 px-3 py-2 dark:border-slate-800">
                  <span className="font-medium">{source}</span>
                  <span className="text-slate-600 dark:text-slate-300">{count}</span>
                </li>
              ))
            )}
          </ul>
        </article>
      </section>

      <section className="mt-8 grid gap-4 md:grid-cols-2">
        <article className="rounded-2xl border border-slate-200 bg-white p-5 dark:border-slate-800 dark:bg-slate-900">
          <h2 className="text-lg font-semibold">Trend 7 dager</h2>
          <p className="mt-2 text-sm text-slate-600 dark:text-slate-300">Dekning: {pct(coverage7)} (forrige: {pct(coveragePrev7)})</p>
          <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">{diffBadge(coverage7 * 100, coveragePrev7 * 100)}</p>
          <p className="mt-3 text-sm text-slate-600 dark:text-slate-300">
            Friskhet: {freshness7 !== null ? `${freshness7} d` : "-"} (forrige: {freshnessPrev7 !== null ? `${freshnessPrev7} d` : "-"})
          </p>
          <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">{diffBadge(freshness7, freshnessPrev7, true)}</p>
        </article>

        <article className="rounded-2xl border border-slate-200 bg-white p-5 dark:border-slate-800 dark:bg-slate-900">
          <h2 className="text-lg font-semibold">Trend 30 dager</h2>
          <p className="mt-2 text-sm text-slate-600 dark:text-slate-300">Dekning: {pct(coverage30)} (forrige: {pct(coveragePrev30)})</p>
          <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">{diffBadge(coverage30 * 100, coveragePrev30 * 100)}</p>
          <p className="mt-3 text-sm text-slate-600 dark:text-slate-300">
            Friskhet: {freshness30 !== null ? `${freshness30} d` : "-"} (forrige: {freshnessPrev30 !== null ? `${freshnessPrev30} d` : "-"})
          </p>
          <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">{diffBadge(freshness30, freshnessPrev30, true)}</p>
        </article>
      </section>

      <section className="mt-8 rounded-2xl border border-emerald-200 bg-emerald-50/80 p-5 text-sm dark:border-emerald-900 dark:bg-emerald-950/30">
        <p className="font-semibold text-emerald-800 dark:text-emerald-300">Neste forbedringssløyfe</p>
        <p className="mt-1 text-emerald-900/90 dark:text-emerald-100/90">
          Bruk tallene over til å prioritere: 1) flere butikker per vare, 2) ferskere priser, 3) høyere andel verifiserte kvitteringer.
        </p>
        <ul className="mt-3 space-y-1 text-xs text-emerald-900/90 dark:text-emerald-100/90">
          <li>Hvis dekning er under 60%: prioriter flere butikker per topp 50 produkter.</li>
          <li>Hvis friskhet er over 5 dager: øk sync-frekvens eller flere kilder.</li>
          <li>Hvis review-rate er lav: styrk kvitteringsflyt med tydelig brukerverdi.</li>
        </ul>
        <div className="mt-3 flex flex-wrap gap-3">
          <Link href="/compare" className="rounded-lg bg-emerald-600 px-3 py-2 font-medium text-white hover:bg-emerald-500">
            Se sammenligning
          </Link>
          <Link href="/confidence" className="rounded-lg border border-emerald-300 px-3 py-2 font-medium text-emerald-800 hover:bg-emerald-100 dark:border-emerald-800 dark:text-emerald-200 dark:hover:bg-emerald-900/40">
            Les confidence-metoden
          </Link>
        </div>
      </section>
    </main>
  );
}
