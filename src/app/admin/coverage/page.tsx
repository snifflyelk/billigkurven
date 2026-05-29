import Link from "next/link";
import { CoveragePriorityManager } from "@/components/coverage-priority-manager";
import { getCoverageMetrics } from "@/lib/coverage";
import { prisma } from "@/lib/prisma";
import { getTransparencyMetrics } from "@/lib/transparency";

export const dynamic = "force-dynamic";

export default async function AdminCoveragePage() {
  const [coverageMetrics, transparencyMetrics, priorities, recentActions] = await Promise.all([
    getCoverageMetrics(),
    getTransparencyMetrics(),
    prisma.coveragePriority.findMany().catch(() => []),
    prisma.coveragePriority
      .findMany({
        where: { lastActionAt: { not: null } },
        orderBy: { lastActionAt: "desc" },
        take: 10,
      })
      .catch(() => []),
  ]);

  const priorityMap = new Map(priorities.map((priority) => [`${priority.scopeType}:${priority.scopeKey}`, priority]));
  const initialItems = [
    ...coverageMetrics.priorityChains.map((chain) => ({ scopeType: "CHAIN" as const, scopeKey: chain.label, title: chain.label, coverageRatio: chain.coverageRatio })),
    ...coverageMetrics.priorityPostals.map((postal) => ({ scopeType: "POSTAL_CODE" as const, scopeKey: postal.label, title: postal.label, coverageRatio: postal.coverageRatio })),
  ].map((item) => {
    const existing = priorityMap.get(`${item.scopeType}:${item.scopeKey}`);
    return {
      id: existing?.id,
      scopeType: item.scopeType,
      scopeKey: item.scopeKey,
      title: item.title,
      coverageRatio: item.coverageRatio,
      status: existing?.status ?? "OPEN",
      owner: existing?.owner ?? "",
      notes: existing?.notes ?? "",
      lastActionType: existing?.lastActionType ?? null,
      lastActionAt: existing?.lastActionAt?.toISOString() ?? null,
      lastActionSummary: existing?.lastActionSummary ?? null,
    };
  });

  return (
    <main className="mx-auto max-w-6xl px-4 py-10 pb-16">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Admin: Dekningsprioritering</h1>
          <p className="mt-2 max-w-3xl text-slate-600 dark:text-slate-300">
            Intern arbeidsflate for hvilke kjeder, postnumre og datakvalitetshull som bør prioriteres først for å styrke produktet raskest mulig.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Link href="/coverage" className="rounded-xl border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:text-slate-200 dark:hover:bg-slate-800">
            Offentlig dekning
          </Link>
          <Link href="/admin" className="rounded-xl bg-emerald-600 px-4 py-2 text-sm font-medium text-white hover:bg-emerald-500">
            Til admin
          </Link>
        </div>
      </div>

      <section className="mt-6 grid gap-4 md:grid-cols-4">
        <article className="rounded-2xl border border-emerald-200 bg-emerald-50/80 p-4 dark:border-emerald-900 dark:bg-emerald-950/25">
          <p className="text-xs uppercase tracking-wide text-emerald-700 dark:text-emerald-300">Total coverage score</p>
          <p className="mt-1 text-3xl font-semibold text-emerald-900 dark:text-emerald-100">{coverageMetrics.score.overall}/100</p>
        </article>
        <article className="rounded-2xl border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900">
          <p className="text-xs uppercase tracking-wide text-slate-500">Ferske priser siste 24t</p>
          <p className="mt-1 text-3xl font-semibold">{transparencyMetrics.freshPrices24h}</p>
        </article>
        <article className="rounded-2xl border border-amber-200 bg-amber-50/80 p-4 dark:border-amber-900 dark:bg-amber-950/25">
          <p className="text-xs uppercase tracking-wide text-amber-700 dark:text-amber-300">Prisrader i karantene</p>
          <p className="mt-1 text-3xl font-semibold text-amber-900 dark:text-amber-100">{transparencyMetrics.quarantinedRows}</p>
        </article>
        <article className="rounded-2xl border border-cyan-200 bg-cyan-50/80 p-4 dark:border-cyan-900 dark:bg-cyan-950/25">
          <p className="text-xs uppercase tracking-wide text-cyan-700 dark:text-cyan-300">Kilder i bruk</p>
          <p className="mt-1 text-3xl font-semibold text-cyan-900 dark:text-cyan-100">{transparencyMetrics.sourceDiversity}</p>
        </article>
      </section>

      <section className="mt-8 grid gap-6 lg:grid-cols-2">
        <article className="rounded-3xl border border-rose-200 bg-rose-50/80 p-5 shadow-sm dark:border-rose-900 dark:bg-rose-950/25">
          <h2 className="text-xl font-semibold text-rose-900 dark:text-rose-100">Kjeder med stor strategisk mangel</h2>
          <ul className="mt-4 space-y-3 text-sm">
            {coverageMetrics.priorityChains.map((chain) => (
              <li key={chain.label} className="rounded-2xl border border-rose-200/70 bg-white/70 px-4 py-3 dark:border-rose-900/70 dark:bg-slate-900/50">
                <div className="flex items-center justify-between gap-3">
                  <span className="font-medium">{chain.label}</span>
                  <span>{Math.round(chain.coverageRatio * 100)}%</span>
                </div>
                <p className="mt-1 text-xs text-rose-900/80 dark:text-rose-100/80">{chain.stores} butikker · {chain.coveredProducts} produkter · {chain.sourceDiversity} kilder.</p>
              </li>
            ))}
          </ul>
        </article>

        <article className="rounded-3xl border border-rose-200 bg-rose-50/80 p-5 shadow-sm dark:border-rose-900 dark:bg-rose-950/25">
          <h2 className="text-xl font-semibold text-rose-900 dark:text-rose-100">Postnummer med stor strategisk mangel</h2>
          <ul className="mt-4 space-y-3 text-sm">
            {coverageMetrics.priorityPostals.map((postal) => (
              <li key={postal.label} className="rounded-2xl border border-rose-200/70 bg-white/70 px-4 py-3 dark:border-rose-900/70 dark:bg-slate-900/50">
                <div className="flex items-center justify-between gap-3">
                  <span className="font-medium">{postal.label}</span>
                  <span>{Math.round(postal.coverageRatio * 100)}%</span>
                </div>
                <p className="mt-1 text-xs text-rose-900/80 dark:text-rose-100/80">{postal.stores} butikker · {postal.coveredProducts} produkter · {postal.sourceDiversity} kilder.</p>
              </li>
            ))}
          </ul>
        </article>
      </section>

      <section className="mt-8">
        <CoveragePriorityManager initialItems={initialItems} />
      </section>

      <section className="mt-8 rounded-3xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900">
        <div className="flex items-center justify-between gap-3">
          <h2 className="text-xl font-semibold">Siste 10 admin-handlinger</h2>
          <span className="text-xs text-slate-500 dark:text-slate-400">Automatisk logget fra arbeidskøen</span>
        </div>
        {recentActions.length === 0 ? (
          <p className="mt-3 text-sm text-slate-500 dark:text-slate-400">Ingen handlinger logget ennå.</p>
        ) : (
          <div className="mt-4 overflow-hidden rounded-2xl border border-slate-200 dark:border-slate-800">
            <div className="overflow-x-auto">
            <table className="min-w-[46rem] divide-y divide-slate-200 text-sm dark:divide-slate-800">
              <thead className="bg-slate-50 dark:bg-slate-950/50">
                <tr>
                  <th className="px-4 py-2 text-left font-medium text-slate-600 dark:text-slate-300">Tid</th>
                  <th className="px-4 py-2 text-left font-medium text-slate-600 dark:text-slate-300">Scope</th>
                  <th className="px-4 py-2 text-left font-medium text-slate-600 dark:text-slate-300">Handling</th>
                  <th className="px-4 py-2 text-left font-medium text-slate-600 dark:text-slate-300">Oppsummering</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200 dark:divide-slate-800">
                {recentActions.map((item) => (
                  <tr key={item.id}>
                    <td className="px-4 py-2 text-slate-700 dark:text-slate-200">{item.lastActionAt ? item.lastActionAt.toLocaleString("no-NO") : "-"}</td>
                    <td className="px-4 py-2 text-slate-700 dark:text-slate-200">{item.scopeType === "CHAIN" ? `Kjede: ${item.scopeKey}` : `Postnummer: ${item.scopeKey}`}</td>
                    <td className="px-4 py-2 text-slate-700 dark:text-slate-200">{item.lastActionType ?? "-"}</td>
                    <td className="px-4 py-2 text-slate-600 dark:text-slate-300">{item.lastActionSummary ?? "-"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            </div>
          </div>
        )}
      </section>

      <section className="mt-8 rounded-3xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900">
        <h2 className="text-xl font-semibold">Neste operative trekk</h2>
        <ul className="mt-4 space-y-3 text-sm text-slate-600 dark:text-slate-300">
          <li>Prioriter kjeder med mange butikker men svak produktdekning først, fordi de gir raskest synlig brukerforbedring.</li>
          <li>Prioriter postnummer med svak dekning og eksisterende butikker i datasettet før helt nye regioner.</li>
          <li>Når karantenenivået stiger, bør datakvalitetsjobber og matching gjennomgås før ny ekspansjon.</li>
        </ul>
      </section>
    </main>
  );
}