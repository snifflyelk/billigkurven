import Link from "next/link";
import {
  ChartBarSquareIcon,
  CircleStackIcon,
  ClipboardDocumentCheckIcon,
  EyeIcon,
  FunnelIcon,
} from "@heroicons/react/24/outline";
import type { TransparencyMetrics } from "@/lib/transparency";

export function TransparencySnapshot({
  metrics,
  title = "Prisgrunnlag og transparens",
  subtitle = "Vi viser hvor prisene kommer fra, hvor ferske de er, og hvor mye som er filtrert bort.",
}: {
  metrics: TransparencyMetrics;
  title?: string;
  subtitle?: string;
}) {
  return (
    <section className="rounded-3xl border border-slate-200 bg-white/95 p-5 shadow-xl shadow-slate-900/5 ring-1 ring-white/70 dark:border-slate-800 dark:bg-slate-900/90 dark:ring-slate-800 sm:p-6 md:p-7">
      <div className="flex flex-wrap items-start justify-between gap-5">
        <div className="max-w-3xl">
          <p className="text-xs font-semibold uppercase tracking-wide text-emerald-700 dark:text-emerald-300">Apenhet som standard</p>
          <h2 className="mt-2 text-2xl font-bold tracking-tight sm:text-3xl">{title}</h2>
          <p className="mt-3 text-sm leading-relaxed text-slate-600 dark:text-slate-300">{subtitle}</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Link href="/confidence" className="rounded-xl border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 shadow-sm transition duration-300 hover:-translate-y-0.5 hover:bg-slate-50 hover:shadow-md dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200 dark:hover:bg-slate-800">
            Se metodikk
          </Link>
          <Link href="/coverage" className="rounded-xl border border-emerald-300 bg-emerald-50 px-4 py-2 text-sm font-medium text-emerald-700 shadow-sm transition duration-300 hover:-translate-y-0.5 hover:bg-emerald-100 hover:shadow-md dark:border-emerald-800 dark:bg-emerald-950/30 dark:text-emerald-300 dark:hover:bg-emerald-950/40">
            Se dekning
          </Link>
        </div>
      </div>

      <div className="mt-6 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <article className="rounded-2xl border border-emerald-200 bg-emerald-50/85 p-4 shadow-sm transition duration-300 hover:-translate-y-0.5 hover:shadow-md dark:border-emerald-900 dark:bg-emerald-950/25">
          <div className="flex items-center gap-2 text-emerald-700 dark:text-emerald-300">
            <EyeIcon className="h-4 w-4" aria-hidden />
            <p className="text-xs uppercase tracking-wide">Ferske priser 24t</p>
          </div>
          <p className="mt-2 text-2xl font-semibold text-emerald-900 dark:text-emerald-100">{metrics.freshPrices24h}</p>
          <p className="mt-1 text-xs text-emerald-800/80 dark:text-emerald-200/80">{metrics.freshnessRatio}% av aktive prisrader.</p>
        </article>

        <article className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm transition duration-300 hover:-translate-y-0.5 hover:shadow-md dark:border-slate-800 dark:bg-slate-900">
          <div className="flex items-center gap-2 text-slate-500 dark:text-slate-400">
            <CircleStackIcon className="h-4 w-4" aria-hidden />
            <p className="text-xs uppercase tracking-wide">Kilder i bruk</p>
          </div>
          <p className="mt-2 text-2xl font-semibold">{metrics.sourceDiversity}</p>
          <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">{metrics.sourceNames.join(", ") || "Ingen kilder registrert"}</p>
        </article>

        <article className="rounded-2xl border border-cyan-200 bg-cyan-50/85 p-4 shadow-sm transition duration-300 hover:-translate-y-0.5 hover:shadow-md dark:border-cyan-900 dark:bg-cyan-950/25">
          <div className="flex items-center gap-2 text-cyan-700 dark:text-cyan-300">
            <ClipboardDocumentCheckIcon className="h-4 w-4" aria-hidden />
            <p className="text-xs uppercase tracking-wide">Verifiserte kvitteringer</p>
          </div>
          <p className="mt-2 text-2xl font-semibold text-cyan-900 dark:text-cyan-100">{metrics.verifiedReceipts}</p>
          <p className="mt-1 text-xs text-cyan-800/80 dark:text-cyan-200/80">Brukerbevis som styrker modell og matching.</p>
        </article>

        <article className="rounded-2xl border border-amber-200 bg-amber-50/85 p-4 shadow-sm transition duration-300 hover:-translate-y-0.5 hover:shadow-md dark:border-amber-900 dark:bg-amber-950/25">
          <div className="flex items-center gap-2 text-amber-700 dark:text-amber-300">
            <FunnelIcon className="h-4 w-4" aria-hidden />
            <p className="text-xs uppercase tracking-wide">Filtrert bort</p>
          </div>
          <p className="mt-2 text-2xl font-semibold text-amber-900 dark:text-amber-100">{metrics.quarantinedRows}</p>
          <p className="mt-1 text-xs text-amber-800/80 dark:text-amber-200/80">{metrics.quarantineRatio}% holdes ute fra anbefalinger.</p>
        </article>
      </div>

      <div className="mt-5 rounded-2xl border border-slate-200 bg-slate-50/90 p-4 text-sm text-slate-600 dark:border-slate-800 dark:bg-slate-950/50 dark:text-slate-300 sm:p-5">
        <div className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-white px-2.5 py-1 text-[11px] font-semibold uppercase tracking-wide text-slate-500 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300">
          <ChartBarSquareIcon className="h-3.5 w-3.5" aria-hidden />
          <span className="h-1.5 w-10 rounded-full bg-slate-200 dark:bg-slate-700" aria-hidden />
        </div>
        <p className="mt-3">
          Vi sporer na {metrics.trackedProducts} produkter pa tvers av {metrics.trackedStores} butikker. Nyeste brukbare observasjon er {metrics.freshestObservationHours !== null ? `${metrics.freshestObservationHours} timer gammel` : "ikke tilgjengelig"}.
        </p>
        <span className="mt-1 block">Prisrader eldre enn 72 timer: {metrics.stalePrices72h} ({metrics.staleRatio72h}%).</span>
      </div>
    </section>
  );
}