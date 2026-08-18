import Link from "next/link";
import { getSectionAnalyticsReport } from "@/lib/analytics-report";

export const revalidate = 300;

export default async function DistributionAnalyticsPage() {
  const report = await getSectionAnalyticsReport();

  return (
    <main className="mx-auto max-w-6xl px-4 py-10 pb-16">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Produkt-analytics oversikt</h1>
          <p className="mt-2 text-slate-600 dark:text-slate-300">Impression til klikk-rate for nye kommersielle seksjoner.</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Link href="/distribution" className="rounded-xl border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:text-slate-200 dark:hover:bg-slate-800">
            Til distribusjon
          </Link>
          <Link href="/ops" className="rounded-xl bg-emerald-600 px-4 py-2 text-sm font-medium text-white hover:bg-emerald-500">
            Operativt dashboard
          </Link>
        </div>
      </div>

      <section className="mt-6 grid gap-4 md:grid-cols-3">
        <article className="rounded-2xl border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900">
          <p className="text-xs uppercase tracking-wide text-slate-500">Sporingshendelser</p>
          <p className="mt-1 text-3xl font-semibold">{report.trackedEvents}</p>
        </article>
        <article className="rounded-2xl border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900">
          <p className="text-xs uppercase tracking-wide text-slate-500">Første event</p>
          <p className="mt-1 text-sm font-medium">{report.firstSeen ? new Date(report.firstSeen).toLocaleString("nb-NO") : "-"}</p>
        </article>
        <article className="rounded-2xl border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900">
          <p className="text-xs uppercase tracking-wide text-slate-500">Siste event</p>
          <p className="mt-1 text-sm font-medium">{report.lastSeen ? new Date(report.lastSeen).toLocaleString("nb-NO") : "-"}</p>
        </article>
      </section>

      <section className="mt-6 rounded-3xl border border-slate-200 bg-white p-5 dark:border-slate-800 dark:bg-slate-900">
        <h2 className="text-xl font-semibold">Seksjonsytelse</h2>
        <p className="mt-1 text-sm text-slate-600 dark:text-slate-300">CTR er regnet som klikk/impressions per seksjon.</p>

        <div className="mt-4 overflow-x-auto rounded-2xl border border-slate-200 dark:border-slate-800">
          <table className="min-w-[44rem] w-full text-left text-sm">
            <thead className="bg-slate-50 dark:bg-slate-950/50">
              <tr>
                <th className="px-3 py-2 font-medium">Seksjon</th>
                <th className="px-3 py-2 font-medium">Impressions</th>
                <th className="px-3 py-2 font-medium">Klikk</th>
                <th className="px-3 py-2 font-medium">CTR</th>
              </tr>
            </thead>
            <tbody>
              {report.rows.map((row) => (
                <tr key={row.key} className="border-t border-slate-200 dark:border-slate-800">
                  <td className="px-3 py-2 font-medium">{row.label}</td>
                  <td className="px-3 py-2">{row.impressions}</td>
                  <td className="px-3 py-2">{row.clicks}</td>
                  <td className="px-3 py-2">
                    <span className={`rounded-full px-2 py-1 text-xs font-semibold ${row.clickRate >= 20 ? "bg-emerald-100 text-emerald-800 dark:bg-emerald-900/45 dark:text-emerald-200" : row.clickRate >= 8 ? "bg-amber-100 text-amber-800 dark:bg-amber-900/45 dark:text-amber-200" : "bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-200"}`}>
                      {row.clickRate}%
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </main>
  );
}
