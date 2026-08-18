import Link from "next/link";
import { getPlatformStatusMetrics } from "@/lib/market-intelligence";

export const revalidate = 120;

export default async function OpsPage() {
  const status = await getPlatformStatusMetrics();

  const fallbackMode = status.freshnessRatio < 45 || status.staleRatio > 30;
  const queuePressure = status.totalPrices > 0 ? Math.min(100, Math.round((status.quarantinedRows / status.totalPrices) * 100 * 2.3)) : 0;

  return (
    <main className="mx-auto max-w-6xl px-4 py-10 pb-16">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Operativt dashboard</h1>
          <p className="mt-2 text-slate-600 dark:text-slate-300">Observability, fallback-regler og kapasitet for prisinnhenting.</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Link href="/status" className="rounded-xl border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:text-slate-200 dark:hover:bg-slate-800">
            Plattformstatus
          </Link>
          <Link href="/api/ops/health" className="rounded-xl bg-emerald-600 px-4 py-2 text-sm font-medium text-white hover:bg-emerald-500">
            Health endpoint
          </Link>
        </div>
      </div>

      <section className="mt-6 grid gap-4 md:grid-cols-3">
        <article className="rounded-2xl border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900">
          <p className="text-xs uppercase tracking-wide text-slate-500">Ingestion health</p>
          <p className="mt-1 text-3xl font-semibold">{status.ingestionHealth}/100</p>
        </article>
        <article className="rounded-2xl border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900">
          <p className="text-xs uppercase tracking-wide text-slate-500">Queue pressure</p>
          <p className="mt-1 text-3xl font-semibold">{queuePressure}%</p>
        </article>
        <article className={`rounded-2xl border p-4 ${fallbackMode ? "border-amber-300 bg-amber-50 dark:border-amber-900 dark:bg-amber-950/30" : "border-emerald-300 bg-emerald-50 dark:border-emerald-900 dark:bg-emerald-950/30"}`}>
          <p className="text-xs uppercase tracking-wide">Fallback mode</p>
          <p className="mt-1 text-3xl font-semibold">{fallbackMode ? "Aktiv" : "Av"}</p>
        </article>
      </section>

      <section className="mt-6 rounded-3xl border border-slate-200 bg-white p-5 dark:border-slate-800 dark:bg-slate-900">
        <h2 className="text-xl font-semibold">Fallback-strategi</h2>
        <ul className="mt-3 space-y-2 text-sm text-slate-600 dark:text-slate-300">
          <li>Nar ferskhet faller under 45%, vises konservative anbefalinger med tydelig varsel.</li>
          <li>Nar stale-andel overstiger 30%, brukes siste stabile snapshot i offentlige feeds.</li>
          <li>Nar queue pressure overstiger 70%, prioriteres toppkategorier og storby-postnummer.</li>
          <li>Alle avvik speiles i statusflaten for apen drift mot brukere og team.</li>
        </ul>
      </section>
    </main>
  );
}
