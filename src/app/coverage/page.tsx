import Link from "next/link";
import { getCoverageMetrics } from "@/lib/coverage";

export const revalidate = 300;

export default async function CoveragePage({
  searchParams,
}: {
  searchParams: { region?: string; postalPrefix?: string; postalCode?: string };
}) {
  const metrics = await getCoverageMetrics({
    region: searchParams.region,
    postalCode: searchParams.postalCode,
    postalPrefix: searchParams.postalPrefix,
  });

  return (
    <main className="mx-auto max-w-6xl px-4 py-10 pb-16">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Butikkdekning og aapenhet</h1>
          <p className="mt-2 max-w-3xl text-slate-600 dark:text-slate-300">
            Denne siden viser hvor god dekningen faktisk er per kjede og postnummer. Hvis dekningen er svak, skal det synes offentlig.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Link href="/confidence" className="rounded-xl border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:text-slate-200 dark:hover:bg-slate-800">
            Se metodikk
          </Link>
          <Link href="/compare" className="rounded-xl bg-emerald-600 px-4 py-2 text-sm font-medium text-white hover:bg-emerald-500">
            Gå til sammenligning
          </Link>
        </div>
      </div>

      <section className="mt-6 rounded-3xl border border-emerald-200 bg-gradient-to-br from-emerald-50 via-white to-cyan-50 p-6 dark:border-emerald-900 dark:from-emerald-950/20 dark:via-slate-950 dark:to-cyan-950/20">
        <div className="grid gap-4 md:grid-cols-4">
          <article className="rounded-2xl border border-white/80 bg-white/90 p-4 dark:border-slate-800 dark:bg-slate-900/80">
            <p className="text-xs uppercase tracking-wide text-slate-500">Total score</p>
            <p className="mt-1 text-3xl font-semibold text-emerald-700 dark:text-emerald-300">{metrics.score.overall}/100</p>
          </article>
          <article className="rounded-2xl border border-white/80 bg-white/90 p-4 dark:border-slate-800 dark:bg-slate-900/80">
            <p className="text-xs uppercase tracking-wide text-slate-500">Produkter med sammenlignbar dekning</p>
            <p className="mt-1 text-3xl font-semibold">{metrics.coveredProducts}</p>
            <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">Av {metrics.products} sporbare produkter.</p>
          </article>
          <article className="rounded-2xl border border-white/80 bg-white/90 p-4 dark:border-slate-800 dark:bg-slate-900/80">
            <p className="text-xs uppercase tracking-wide text-slate-500">Butikker med data</p>
            <p className="mt-1 text-3xl font-semibold">{metrics.stores}</p>
            <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">Kildediversitet: {metrics.sourceDiversity}</p>
          </article>
          <article className="rounded-2xl border border-white/80 bg-white/90 p-4 dark:border-slate-800 dark:bg-slate-900/80">
            <p className="text-xs uppercase tracking-wide text-slate-500">Snittalder priser</p>
            <p className="mt-1 text-3xl font-semibold">{metrics.averageAgeDays !== null ? `${metrics.averageAgeDays} d` : "-"}</p>
            <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">Lavere er bedre.</p>
          </article>
        </div>
      </section>

      <section className="mt-8 grid gap-6 lg:grid-cols-2">
        <article className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900">
          <div className="flex items-center justify-between gap-3">
            <h2 className="text-xl font-semibold">Dekning per kjede</h2>
            <span className="text-xs text-slate-500 dark:text-slate-400">Offentlig status</span>
          </div>
          <ul className="mt-4 space-y-3 text-sm">
            {metrics.chainMap.slice(0, 10).map((chain) => (
              <li key={chain.label} className="rounded-2xl border border-slate-200 px-4 py-3 dark:border-slate-800">
                <div className="flex items-center justify-between gap-3">
                  <span className="font-medium">{chain.label}</span>
                  <span>{Math.round(chain.coverageRatio * 100)}%</span>
                </div>
                <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                  {chain.stores} butikker · {chain.coveredProducts} produkter · {chain.averageAgeDays !== null ? `${chain.averageAgeDays} d snittalder` : "ingen ferskhetsdata"} · {chain.sourceDiversity} kilder
                </p>
              </li>
            ))}
          </ul>
        </article>

        <article className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900">
          <div className="flex items-center justify-between gap-3">
            <h2 className="text-xl font-semibold">Dekning per postnummer</h2>
            <span className="text-xs text-slate-500 dark:text-slate-400">Toppliste</span>
          </div>
          <ul className="mt-4 space-y-3 text-sm">
            {metrics.postalMap.slice(0, 10).map((postal) => (
              <li key={postal.label} className="rounded-2xl border border-slate-200 px-4 py-3 dark:border-slate-800">
                <div className="flex items-center justify-between gap-3">
                  <span className="font-medium">{postal.label}</span>
                  <span>{Math.round(postal.coverageRatio * 100)}%</span>
                </div>
                <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                  {postal.stores} butikker · {postal.coveredProducts} produkter · {postal.averageAgeDays !== null ? `${postal.averageAgeDays} d snittalder` : "ingen ferskhetsdata"} · {postal.sourceDiversity} kilder
                </p>
              </li>
            ))}
          </ul>
        </article>
      </section>

      <section className="mt-8 grid gap-6 lg:grid-cols-2">
        <article className="rounded-3xl border border-rose-200 bg-rose-50/80 p-5 shadow-sm dark:border-rose-900 dark:bg-rose-950/25">
          <div className="flex items-center justify-between gap-3">
            <h2 className="text-xl font-semibold text-rose-900 dark:text-rose-100">Kjeder vi bør prioritere nå</h2>
            <span className="text-xs text-rose-800/80 dark:text-rose-200/80">Operativ liste</span>
          </div>
          <ul className="mt-4 space-y-3 text-sm">
            {metrics.priorityChains.map((chain) => (
              <li key={chain.label} className="rounded-2xl border border-rose-200/70 bg-white/70 px-4 py-3 dark:border-rose-900/70 dark:bg-slate-900/50">
                <div className="flex items-center justify-between gap-3">
                  <span className="font-medium">{chain.label}</span>
                  <span>{Math.round(chain.coverageRatio * 100)}%</span>
                </div>
                <p className="mt-1 text-xs text-rose-900/80 dark:text-rose-100/80">
                  {chain.stores} butikker i datasettet · {chain.coveredProducts} produkter dekket · {chain.sourceDiversity} kilder.
                </p>
              </li>
            ))}
          </ul>
        </article>

        <article className="rounded-3xl border border-rose-200 bg-rose-50/80 p-5 shadow-sm dark:border-rose-900 dark:bg-rose-950/25">
          <div className="flex items-center justify-between gap-3">
            <h2 className="text-xl font-semibold text-rose-900 dark:text-rose-100">Postnummer som mangler mest</h2>
            <span className="text-xs text-rose-800/80 dark:text-rose-200/80">Operativ liste</span>
          </div>
          <ul className="mt-4 space-y-3 text-sm">
            {metrics.priorityPostals.map((postal) => (
              <li key={postal.label} className="rounded-2xl border border-rose-200/70 bg-white/70 px-4 py-3 dark:border-rose-900/70 dark:bg-slate-900/50">
                <div className="flex items-center justify-between gap-3">
                  <span className="font-medium">{postal.label}</span>
                  <span>{Math.round(postal.coverageRatio * 100)}%</span>
                </div>
                <p className="mt-1 text-xs text-rose-900/80 dark:text-rose-100/80">
                  {postal.stores} butikker i datasettet · {postal.coveredProducts} produkter dekket · {postal.sourceDiversity} kilder.
                </p>
              </li>
            ))}
          </ul>
        </article>
      </section>

      <section className="mt-8 rounded-3xl border border-amber-200 bg-amber-50/80 p-5 dark:border-amber-900 dark:bg-amber-950/25">
        <h2 className="text-xl font-semibold text-amber-900 dark:text-amber-100">Hva denne siden skal brukes til</h2>
        <ul className="mt-4 space-y-3 text-sm text-amber-900/90 dark:text-amber-100/90">
          <li>Brukeren skal kunne sjekke om kjeden eller omradet deres faktisk er godt nok dekket til at en anbefaling er verdt a stole på.</li>
          <li>Teamet skal bli tvunget til a vise hull i dekningen offentlig i stedet for a gjemme dem bak markedsforing.</li>
          <li>Denne siden gir et bedre grunnlag for a prioritere hvilke kjeder og postnummer som trenger mer datainnsamling.</li>
        </ul>
        <p className="mt-4 text-xs text-amber-900/80 dark:text-amber-100/80">{metrics.note}</p>
      </section>
    </main>
  );
}