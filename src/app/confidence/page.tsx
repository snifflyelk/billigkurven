import {
  CircleStackIcon,
  FunnelIcon,
  ArrowPathIcon,
  ShieldCheckIcon,
  ChartBarSquareIcon,
} from "@heroicons/react/24/outline";
import { getTransparencyMetrics } from "@/lib/transparency";

export const revalidate = 300;

export default async function ConfidencePage() {
  const metrics = await getTransparencyMetrics();

  return (
    <main className="mx-auto max-w-6xl px-4 py-10 pb-24 md:py-12 md:pb-12">
      <header className="max-w-4xl fade-rise">
        <h1 className="text-4xl font-bold tracking-tight">Prisgrunnlag og metodikk</h1>
        <p className="mt-3 text-slate-600 dark:text-slate-300">
          Slik jobber vi med datakvalitet, filtrering og oppdateringsfrekvens. Målet er at du alltid skal forstå hvor anbefalingen kommer fra.
        </p>
      </header>

      <section className="mt-8 grid gap-4 md:grid-cols-2 xl:grid-cols-5 fade-rise-delayed">
        <article className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900">
          <CircleStackIcon className="h-5 w-5 text-cyan-600 dark:text-cyan-400" aria-hidden />
          <h2 className="mt-3 text-lg font-semibold">1. Hva vi samler inn</h2>
          <p className="mt-2 text-sm text-slate-600 dark:text-slate-300">Produktpriser, butikkmetadata, prislinjer og verifiserte kvitteringer.</p>
        </article>

        <article className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900">
          <FunnelIcon className="h-5 w-5 text-amber-600 dark:text-amber-400" aria-hidden />
          <h2 className="mt-3 text-lg font-semibold">2. Hvordan vi filtrerer</h2>
          <p className="mt-2 text-sm text-slate-600 dark:text-slate-300">Uvanlige eller usikre rader settes i karantene før de brukes i anbefaling.</p>
        </article>

        <article className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900">
          <ArrowPathIcon className="h-5 w-5 text-emerald-600 dark:text-emerald-400" aria-hidden />
          <h2 className="mt-3 text-lg font-semibold">3. Hvor ofte vi oppdaterer</h2>
          <p className="mt-2 text-sm text-slate-600 dark:text-slate-300">Nye observasjoner strømmer inn løpende. Ferskhet vises eksplisitt i produktet.</p>
        </article>

        <article className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900">
          <ShieldCheckIcon className="h-5 w-5 text-emerald-600 dark:text-emerald-400" aria-hidden />
          <h2 className="mt-3 text-lg font-semibold">4. Hvorfor du kan stole på oss</h2>
          <p className="mt-2 text-sm text-slate-600 dark:text-slate-300">Vi viser metode, dekning, filtrering og begrensninger uten å skjule svakheter.</p>
        </article>

        <article className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900">
          <ChartBarSquareIcon className="h-5 w-5 text-indigo-600 dark:text-indigo-400" aria-hidden />
          <h2 className="mt-3 text-lg font-semibold">5. Tall siste 24 timer</h2>
          <p className="mt-2 text-sm text-slate-600 dark:text-slate-300">Nøkkeltall under viser status i dagens datagrunnlag.</p>
        </article>
      </section>

      <section className="mt-8 grid gap-4 sm:grid-cols-2 xl:grid-cols-4 fade-rise-delayed">
        <article className="rounded-2xl border border-emerald-200 bg-emerald-50/90 p-5 shadow-sm dark:border-emerald-900 dark:bg-emerald-950/30">
          <p className="text-xs font-semibold uppercase tracking-wide text-emerald-700 dark:text-emerald-300">Ferske priser siste 24t</p>
          <p className="mt-2 text-3xl font-bold text-emerald-900 dark:text-emerald-100">{metrics.freshPrices24h.toLocaleString("nb-NO")}</p>
          <p className="mt-1 text-xs text-emerald-800/80 dark:text-emerald-200/80">Ferskhetsgrad: {metrics.freshnessRatio}%</p>
        </article>

        <article className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900">
          <p className="text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">Kilder i bruk</p>
          <p className="mt-2 text-3xl font-bold text-slate-900 dark:text-slate-100">{metrics.sourceDiversity}</p>
          <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">{metrics.sourceNames.join(", ") || "Ingen registrert"}</p>
        </article>

        <article className="rounded-2xl border border-cyan-200 bg-cyan-50/90 p-5 shadow-sm dark:border-cyan-900 dark:bg-cyan-950/30">
          <p className="text-xs font-semibold uppercase tracking-wide text-cyan-700 dark:text-cyan-300">Verifiserte kvitteringer</p>
          <p className="mt-2 text-3xl font-bold text-cyan-900 dark:text-cyan-100">{metrics.verifiedReceipts.toLocaleString("nb-NO")}</p>
          <p className="mt-1 text-xs text-cyan-800/80 dark:text-cyan-200/80">Brukt i modellforbedring og kontroll.</p>
        </article>

        <article className="rounded-2xl border border-amber-200 bg-amber-50/90 p-5 shadow-sm dark:border-amber-900 dark:bg-amber-950/30">
          <p className="text-xs font-semibold uppercase tracking-wide text-amber-700 dark:text-amber-300">Filtrert bort</p>
          <p className="mt-2 text-3xl font-bold text-amber-900 dark:text-amber-100">{metrics.quarantinedRows.toLocaleString("nb-NO")}</p>
          <p className="mt-1 text-xs text-amber-800/80 dark:text-amber-200/80">Andel i karantene: {metrics.quarantineRatio}%</p>
        </article>
      </section>

      <section className="mt-8 rounded-3xl border border-slate-200 bg-white p-6 shadow-sm fade-rise-slow dark:border-slate-800 dark:bg-slate-900">
        <h2 className="text-2xl font-semibold">Kvalitetsscore og dekning</h2>
        <p className="mt-2 text-sm text-slate-600 dark:text-slate-300">En enkel operativ score basert på ferskhet og filtreringsgrad.</p>
        <div className="mt-4 grid gap-4 md:grid-cols-2">
          <article className="rounded-2xl border border-slate-200 bg-slate-50/80 p-4 dark:border-slate-800 dark:bg-slate-950/50">
            <p className="text-xs uppercase tracking-wide text-slate-500">Kvalitetsscore</p>
            <p className="mt-1 text-3xl font-bold">{Math.max(0, Math.min(100, metrics.freshnessRatio - Math.round(metrics.quarantineRatio / 2)))} / 100</p>
          </article>
          <article className="rounded-2xl border border-slate-200 bg-slate-50/80 p-4 dark:border-slate-800 dark:bg-slate-950/50">
            <p className="text-xs uppercase tracking-wide text-slate-500">Sporing akkurat nå</p>
            <p className="mt-1 text-3xl font-bold">{metrics.trackedProducts.toLocaleString("nb-NO")}</p>
            <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">produkter på tvers av {metrics.trackedStores.toLocaleString("nb-NO")} butikker</p>
          </article>
        </div>
      </section>
    </main>
  );
}
