import { AdminPanel } from "@/components/admin-panel";
import { prisma } from "@/lib/prisma";
import Link from "next/link";

export const dynamic = "force-dynamic";

export default async function AdminPage() {
  const [products, rawPrices, stores] = await Promise.all([
    prisma.product.findMany({ orderBy: { createdAt: "desc" } }),
    prisma.price.findMany({
      include: { product: true, store: true },
      orderBy: { date: "desc" },
    }),
    prisma.store.findMany({ orderBy: { name: "asc" } }),
  ]);

  const prices = rawPrices.map((price) => ({
    ...price,
    price: Number(price.price),
    unitPrice: Number(price.unitPrice),
  }));

  const latestPriceDate = prices[0]?.date
    ? new Date(prices[0].date).toLocaleDateString("no-NO")
    : null;

  const sourceMap = new Map<string, { rows24h: number; rows7d: number; latestAt: Date | null; totalRows: number }>();
  const now = Date.now();

  for (const price of rawPrices) {
    const source = price.source || "ukjent";
    const entry = sourceMap.get(source) ?? {
      rows24h: 0,
      rows7d: 0,
      latestAt: null,
      totalRows: 0,
    };

    const ageMs = now - price.date.getTime();
    if (ageMs <= 24 * 60 * 60 * 1000) entry.rows24h += 1;
    if (ageMs <= 7 * 24 * 60 * 60 * 1000) entry.rows7d += 1;
    entry.totalRows += 1;
    if (!entry.latestAt || price.date > entry.latestAt) {
      entry.latestAt = price.date;
    }

    sourceMap.set(source, entry);
  }

  const initialSourceStats = Array.from(sourceMap.entries())
    .map(([source, value]) => ({
      source,
      rows24h: value.rows24h,
      rows7d: value.rows7d,
      totalRows: value.totalRows,
      latestAt: value.latestAt ? value.latestAt.toISOString() : null,
    }))
    .sort((left, right) => right.rows7d - left.rows7d);

  return (
    <main className="mx-auto max-w-6xl px-4 py-10">
      <h1 className="text-3xl font-bold tracking-tight">Adminpanel</h1>
      <p className="mt-2 text-slate-600 dark:text-slate-300">Administrer produkter, prislinjer og kvitteringsvalidering med enkel CRUD.</p>
      <section className="mt-5 rounded-3xl border border-cyan-200 bg-gradient-to-br from-cyan-50 via-white to-emerald-50 p-5 fade-rise dark:border-cyan-900 dark:from-cyan-950/20 dark:via-slate-950 dark:to-emerald-950/20">
        <p className="text-xs font-semibold uppercase tracking-wide text-cyan-700 dark:text-cyan-300">Driftsoversikt</p>
        <h2 className="mt-1 text-3xl font-bold tracking-tight">Kontroller katalog, priser og kvalitet fra ett sted</h2>
        <p className="mt-2 text-sm text-slate-700 dark:text-slate-200">Admin skal gjøre det enkelt å holde systemet levende, ikke bare legge inn data manuelt.</p>
      </section>
      <div className="mt-4 rounded-2xl border border-slate-200 bg-white p-4 text-sm dark:border-slate-800 dark:bg-slate-900 fade-rise-delayed">
        <p className="font-medium">Kvitteringsflyt</p>
        <p className="mt-1 text-slate-500 dark:text-slate-400">Bruk <Link href="/admin/receipts" className="text-emerald-700 hover:underline dark:text-emerald-300">egen valideringsside</Link> for manuell kvalitetssikring av innsendelser.</p>
      </div>
      <div className="mt-4 rounded-2xl border border-slate-200 bg-white p-4 text-sm dark:border-slate-800 dark:bg-slate-900 fade-rise-delayed">
        <p className="font-medium">Live-kilder</p>
        <p className="mt-1 text-slate-500 dark:text-slate-400">Kjør live-synk for å hente data fra Oda, MENY, SPAR, Joker, Foodora Market og Wolt Market.</p>
      </div>
      <div className="mt-4 rounded-2xl border border-slate-200 bg-white p-4 text-sm dark:border-slate-800 dark:bg-slate-900 fade-rise-delayed">
        <p className="font-medium">Dekningsprioritering</p>
        <p className="mt-1 text-slate-500 dark:text-slate-400">Bruk <Link href="/admin/coverage" className="text-emerald-700 hover:underline dark:text-emerald-300">egen dekningsflate</Link> for å se hvilke kjeder og postnummer som bør prioriteres operativt.</p>
      </div>
      <section className="mt-4 grid gap-3 sm:grid-cols-3 fade-rise-slow">
        <article className="rounded-2xl border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900">
          <p className="text-sm text-slate-500 dark:text-slate-400">Produkter</p>
          <p className="mt-1 text-2xl font-semibold">{products.length}</p>
        </article>
        <article className="rounded-2xl border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900">
          <p className="text-sm text-slate-500 dark:text-slate-400">Butikker</p>
          <p className="mt-1 text-2xl font-semibold">{stores.length}</p>
        </article>
        <article className="rounded-2xl border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900">
          <p className="text-sm text-slate-500 dark:text-slate-400">Siste prisoppdatering</p>
          <p className="mt-1 text-lg font-semibold">{latestPriceDate ?? "Ingen prislinjer"}</p>
        </article>
      </section>
      <div className="mt-8">
        <AdminPanel products={products} prices={prices} stores={stores} initialSourceStats={initialSourceStats} />
      </div>
    </main>
  );
}
