import Link from "next/link";

import { DEFAULT_USER_EMAIL } from "@/lib/constants";
import { prisma } from "@/lib/prisma";
import { getWeeklySavingsReport } from "@/lib/savings-report";
import { formatNok } from "@/lib/utils";
import { WeeklyReportDispatch } from "@/components/weekly-report-dispatch";

export const dynamic = "force-dynamic";

export default async function WeeklySavingsReportPage({
  searchParams,
}: {
  searchParams: { chain?: string | string[] };
}) {
  const user = await prisma.user.findUnique({ where: { email: DEFAULT_USER_EMAIL }, select: { id: true } });

  if (!user) {
    return (
      <main className="mx-auto max-w-5xl px-4 py-10">
        <h1 className="text-3xl font-bold tracking-tight">Ukentlig sparerapport</h1>
        <p className="mt-3 text-slate-600 dark:text-slate-300">Ingen bruker funnet. Kjor onboarding for a aktivere rapporten.</p>
      </main>
    );
  }

  const chainParam = Array.isArray(searchParams.chain) ? searchParams.chain[0] : searchParams.chain;
  const report = await getWeeklySavingsReport(user.id, { chain: chainParam ?? null });

  return (
    <main className="mx-auto max-w-6xl px-4 py-10 pb-16">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Ukentlig sparerapport</h1>
          <p className="mt-2 max-w-3xl text-slate-600 dark:text-slate-300">Fast ukeoppsummering for sparing, treffsikkerhet og trend. Klar for push/epost senere.</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Link href="/savings" className="rounded-xl border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:text-slate-200 dark:hover:bg-slate-800">
            Til sparehistorikk
          </Link>
          <Link href="/receipts" className="rounded-xl bg-emerald-600 px-4 py-2 text-sm font-medium text-white hover:bg-emerald-500">
            Last opp kvittering
          </Link>
        </div>
      </div>

      <section className="mt-6 grid gap-4 md:grid-cols-4">
        <article className="rounded-2xl border border-emerald-200 bg-emerald-50/80 p-4 dark:border-emerald-900 dark:bg-emerald-950/25">
          <p className="text-xs uppercase tracking-wide text-emerald-700 dark:text-emerald-300">Denne uken</p>
          <p className="mt-1 text-3xl font-semibold text-emerald-900 dark:text-emerald-100">{formatNok(report.thisWeekSavings)}</p>
        </article>
        <article className="rounded-2xl border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900">
          <p className="text-xs uppercase tracking-wide text-slate-500">Forrige uke</p>
          <p className="mt-1 text-3xl font-semibold">{formatNok(report.previousWeekSavings)}</p>
        </article>
        <article className="rounded-2xl border border-cyan-200 bg-cyan-50/80 p-4 dark:border-cyan-900 dark:bg-cyan-950/25">
          <p className="text-xs uppercase tracking-wide text-cyan-700 dark:text-cyan-300">Uke over uke</p>
          <p className="mt-1 text-3xl font-semibold text-cyan-900 dark:text-cyan-100">
            {report.weekOverWeekDelta >= 0 ? `+${formatNok(report.weekOverWeekDelta)}` : `-${formatNok(Math.abs(report.weekOverWeekDelta))}`}
          </p>
          <p className="mt-1 text-xs text-cyan-800/80 dark:text-cyan-200/80">{report.weekOverWeekDeltaPct !== null ? `${report.weekOverWeekDeltaPct}%` : "-"}</p>
        </article>
        <article className="rounded-2xl border border-amber-200 bg-amber-50/80 p-4 dark:border-amber-900 dark:bg-amber-950/25">
          <p className="text-xs uppercase tracking-wide text-amber-700 dark:text-amber-300">Neste uke (proj.)</p>
          <p className="mt-1 text-3xl font-semibold text-amber-900 dark:text-amber-100">{formatNok(report.projectedNextWeekSavings)}</p>
        </article>
      </section>

      <section className="mt-6 rounded-2xl border border-cyan-200 bg-cyan-50/70 p-4 dark:border-cyan-900 dark:bg-cyan-950/20">
        <p className="text-sm font-medium text-cyan-900 dark:text-cyan-100">Filter pa butikkjede</p>
        <p className="mt-1 text-xs text-cyan-800/90 dark:text-cyan-200/90">Bruk filteret for a se projisert sparepotensial med fokus pa en valgt kjede.</p>
        <div className="mt-3 flex flex-wrap gap-2">
          <Link
            href="/savings/weekly-report"
            className={`rounded-full border px-3 py-1 text-xs font-semibold ${
              report.selectedChain === null
                ? "border-cyan-700 bg-cyan-700 text-white dark:border-cyan-300 dark:bg-cyan-300 dark:text-cyan-950"
                : "border-cyan-300 text-cyan-800 hover:bg-cyan-100 dark:border-cyan-800 dark:text-cyan-200 dark:hover:bg-cyan-900/40"
            }`}
          >
            Alle kjeder
          </Link>
          {report.availableChains.map((chain) => (
            <Link
              key={chain}
              href={`/savings/weekly-report?chain=${encodeURIComponent(chain)}`}
              className={`rounded-full border px-3 py-1 text-xs font-semibold ${
                report.selectedChain === chain
                  ? "border-cyan-700 bg-cyan-700 text-white dark:border-cyan-300 dark:bg-cyan-300 dark:text-cyan-950"
                  : "border-cyan-300 text-cyan-800 hover:bg-cyan-100 dark:border-cyan-800 dark:text-cyan-200 dark:hover:bg-cyan-900/40"
              }`}
            >
              {chain}
            </Link>
          ))}
        </div>
      </section>

      {report.chainProjections.length > 0 ? (
        <section className="mt-6 rounded-3xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900">
          <h2 className="text-xl font-semibold">Kjedevis projeksjon (best observerte butikk per kjede)</h2>
          <div className="mt-4 overflow-x-auto rounded-2xl border border-slate-200 dark:border-slate-800">
            <table className="min-w-[52rem] w-full text-left text-sm">
              <thead className="bg-slate-50 dark:bg-slate-950/50">
                <tr>
                  <th className="px-3 py-2 font-medium">Kjede</th>
                  <th className="px-3 py-2 font-medium">Kurvtotal</th>
                  <th className="px-3 py-2 font-medium">Dekning</th>
                  <th className="px-3 py-2 font-medium">Kampanje</th>
                  <th className="px-3 py-2 font-medium">Medlemspris</th>
                  <th className="px-3 py-2 font-medium">Medlemslast</th>
                </tr>
              </thead>
              <tbody>
                {report.chainProjections.map((row) => (
                  <tr key={row.chain} className={`border-t border-slate-200 dark:border-slate-800 ${row.isSelected ? "bg-cyan-50/80 dark:bg-cyan-950/30" : ""}`}>
                    <td className="px-3 py-2 font-medium">{row.chain}</td>
                    <td className="px-3 py-2">{formatNok(row.totalPrice)}</td>
                    <td className="px-3 py-2">{row.coveredItems}</td>
                    <td className="px-3 py-2">{row.promoAppliedItems}</td>
                    <td className="px-3 py-2">{row.loyaltyAppliedItems}</td>
                    <td className="px-3 py-2">{row.membershipLockedItems}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      ) : null}

      <section className="mt-8 rounded-3xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900">
        <h2 className="text-xl font-semibold">Siste ukers utvikling</h2>
        {report.buckets.length === 0 ? (
          <p className="mt-3 text-sm text-slate-500 dark:text-slate-400">Ingen ukedata ennå. Last opp og fa godkjent flere kvitteringer.</p>
        ) : (
          <div className="mt-4 overflow-x-auto rounded-2xl border border-slate-200 dark:border-slate-800">
            <table className="min-w-[52rem] w-full text-left text-sm">
              <thead className="bg-slate-50 dark:bg-slate-950/50">
                <tr>
                  <th className="px-3 py-2 font-medium">Uke</th>
                  <th className="px-3 py-2 font-medium">Verifisert spart</th>
                  <th className="px-3 py-2 font-medium">Kvitteringer</th>
                  <th className="px-3 py-2 font-medium">Matcher</th>
                  <th className="px-3 py-2 font-medium">Treffsikkerhet</th>
                </tr>
              </thead>
              <tbody>
                {report.buckets.map((bucket) => (
                  <tr key={bucket.weekStart} className="border-t border-slate-200 dark:border-slate-800">
                    <td className="px-3 py-2">{bucket.weekStart} - {bucket.weekEnd}</td>
                    <td className="px-3 py-2 font-medium text-emerald-700 dark:text-emerald-300">{formatNok(bucket.verifiedSavings)}</td>
                    <td className="px-3 py-2">{bucket.receipts}</td>
                    <td className="px-3 py-2">{bucket.matchedItems}/{bucket.totalItems}</td>
                    <td className="px-3 py-2">{bucket.accuracyPct !== null ? `${bucket.accuracyPct}%` : "-"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <WeeklyReportDispatch selectedChain={report.selectedChain} />
    </main>
  );
}