import Link from "next/link";
import { notFound } from "next/navigation";
import { getCityInsights } from "@/lib/market-intelligence";
import { formatNok } from "@/lib/utils";

export const revalidate = 180;

export default async function CityInsightPage({ params }: { params: { city: string } }) {
  const citySlug = params.city.toLowerCase();
  const [insight] = await getCityInsights(citySlug);

  if (!insight) {
    notFound();
  }

  return (
    <main className="mx-auto max-w-4xl px-4 py-10 pb-16">
      <Link href="/insights" className="text-sm font-medium text-emerald-700 hover:underline dark:text-emerald-300">
        Tilbake til innsikt
      </Link>
      <h1 className="mt-3 text-3xl font-bold tracking-tight">Billigst i {insight.city} denne uken</h1>
      <p className="mt-2 text-slate-600 dark:text-slate-300">Automatisk generert innsikt for organisk synlighet og lokal relevans.</p>

      <section className="mt-6 rounded-3xl border border-slate-200 bg-white p-5 dark:border-slate-800 dark:bg-slate-900">
        <p className="text-sm text-slate-600 dark:text-slate-300">{insight.summary}</p>
        <div className="mt-4 grid gap-3 sm:grid-cols-2">
          <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-4 dark:border-emerald-900 dark:bg-emerald-950/30">
            <p className="text-xs uppercase tracking-wide text-emerald-700 dark:text-emerald-300">Leder</p>
            <p className="mt-1 text-xl font-semibold text-emerald-900 dark:text-emerald-100">{insight.winningStore}</p>
            <p className="mt-1 text-xs text-emerald-800/80 dark:text-emerald-200/80">{insight.winningChain}</p>
          </div>
          <div className="rounded-xl border border-cyan-200 bg-cyan-50 p-4 dark:border-cyan-900 dark:bg-cyan-950/30">
            <p className="text-xs uppercase tracking-wide text-cyan-700 dark:text-cyan-300">Estimert kurv</p>
            <p className="mt-1 text-xl font-semibold text-cyan-900 dark:text-cyan-100">{formatNok(insight.basketEstimate)}</p>
            <p className="mt-1 text-xs text-cyan-800/80 dark:text-cyan-200/80">Spread: {formatNok(insight.spread)}</p>
          </div>
        </div>
      </section>
    </main>
  );
}
