import Link from "next/link";

import { prisma } from "@/lib/prisma";
import { getWeeklySavingsReport } from "@/lib/savings-report";
import { requireAuthenticatedSessionUserId } from "@/lib/user-session";
import { formatNok } from "@/lib/utils";
import { WeeklyReportDispatch } from "@/components/weekly-report-dispatch";

export const dynamic = "force-dynamic";

export default async function WeeklySavingsReportPage({
  searchParams,
}: {
  searchParams: { chain?: string | string[] };
}) {
  const userId = await requireAuthenticatedSessionUserId("/savings/weekly-report");
  const user = await prisma.user.findUnique({ where: { id: userId }, select: { id: true } });

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
  const shareText = encodeURIComponent(
    `Billigkurven ukesrapport: ${report.thisWeekSavings.toFixed(0)} kr spart denne uken. Projeksjon neste uke: ${report.projectedNextWeekSavings.toFixed(0)} kr.`,
  );
  const shareUrl = encodeURIComponent("https://billigkurven.vercel.app/savings/weekly-report");

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
        <p className="text-sm font-medium text-cyan-900 dark:text-cyan-100">Filter på butikkjede</p>
        <p className="mt-1 text-xs text-cyan-800/90 dark:text-cyan-200/90">Bruk filteret for a se projisert sparepotensial med fokus på en valgt kjede.</p>
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

      <section className="mt-6 rounded-2xl border border-emerald-200 bg-emerald-50/70 p-4 dark:border-emerald-900 dark:bg-emerald-950/20">
        <p className="text-sm font-medium text-emerald-900 dark:text-emerald-100">Retention-loop for neste uke</p>
        <p className="mt-1 text-xs text-emerald-800/90 dark:text-emerald-200/90">
          Planlegg fast utsendelse mandag morgen, aktiver push/epost og del rapporten med husstanden for bedre oppfolging.
        </p>
        <div className="mt-3 flex flex-wrap gap-2">
          <a
            href={`mailto:?subject=${encodeURIComponent("Billigkurven ukesrapport")}&body=${shareText}%0A%0A${shareUrl}`}
            className="rounded-xl border border-emerald-300 bg-white px-3 py-2 text-xs font-semibold text-emerald-800 hover:bg-emerald-100 dark:border-emerald-800 dark:bg-emerald-950/30 dark:text-emerald-200"
          >
            Del på epost
          </a>
          <a
            href={`https://wa.me/?text=${shareText}%20${shareUrl}`}
            target="_blank"
            rel="noreferrer"
            className="rounded-xl border border-emerald-300 bg-white px-3 py-2 text-xs font-semibold text-emerald-800 hover:bg-emerald-100 dark:border-emerald-800 dark:bg-emerald-950/30 dark:text-emerald-200"
          >
            Del på melding
          </a>
          <a
            href={`mailto:?subject=${encodeURIComponent("Invitasjon til delt spareplan")}&body=${encodeURIComponent("Bli med i Billigkurven og følg ukesplanen sammen: https://billigkurven.no/login?next=/account")}`}
            className="rounded-xl border border-cyan-300 bg-white px-3 py-2 text-xs font-semibold text-cyan-800 hover:bg-cyan-100 dark:border-cyan-800 dark:bg-cyan-950/30 dark:text-cyan-200"
          >
            Inviter partner
          </a>
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
          <p className="mt-3 text-sm text-slate-500 dark:text-slate-400">Ingen ukedata ennå. Last opp og få godkjent flere kvitteringer.</p>
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