import Link from "next/link";
import { getCityInsights } from "@/lib/market-intelligence";
import { formatNok } from "@/lib/utils";

export const revalidate = 180;

export default async function InsightsPage() {
  const insights = await getCityInsights();

  return (
    <main className="mx-auto max-w-6xl px-4 py-10 pb-16">
      <h1 className="text-3xl font-bold tracking-tight">Ukeinnsikt for norske byer</h1>
      <p className="mt-2 max-w-3xl text-slate-600 dark:text-slate-300">SEO-klar innsiktsflate med lokal prisvinner og estimert spread.</p>

      <section className="mt-6 grid gap-4 md:grid-cols-2">
        {insights.map((insight) => (
          <article key={insight.city} className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900">
            <div className="flex items-center justify-between gap-2">
              <h2 className="text-xl font-semibold">{insight.city}</h2>
              <span className="rounded-full border border-cyan-300 bg-cyan-50 px-2.5 py-1 text-xs font-semibold text-cyan-800 dark:border-cyan-800 dark:bg-cyan-950/30 dark:text-cyan-200">Post {insight.postalPrefix}xxx</span>
            </div>
            <p className="mt-2 text-sm text-slate-600 dark:text-slate-300">{insight.summary}</p>
            <div className="mt-4 grid gap-2 sm:grid-cols-3 text-sm">
              <div className="rounded-xl border border-slate-200 bg-slate-50 p-3 dark:border-slate-800 dark:bg-slate-950/40">
                <p className="text-xs text-slate-500">Vinner</p>
                <p className="mt-1 font-semibold">{insight.winningChain}</p>
              </div>
              <div className="rounded-xl border border-slate-200 bg-slate-50 p-3 dark:border-slate-800 dark:bg-slate-950/40">
                <p className="text-xs text-slate-500">Kurv</p>
                <p className="mt-1 font-semibold">{formatNok(insight.basketEstimate)}</p>
              </div>
              <div className="rounded-xl border border-slate-200 bg-slate-50 p-3 dark:border-slate-800 dark:bg-slate-950/40">
                <p className="text-xs text-slate-500">Spread</p>
                <p className="mt-1 font-semibold">{formatNok(insight.spread)}</p>
              </div>
            </div>
            <Link href={`/insights/${insight.city.toLowerCase()}`} className="mt-4 inline-flex rounded-xl bg-emerald-600 px-3 py-2 text-xs font-semibold text-white hover:bg-emerald-500">
              Les byinnsikt
            </Link>
          </article>
        ))}
      </section>
    </main>
  );
}
