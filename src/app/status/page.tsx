import Link from "next/link";
import { getPlatformStatusMetrics } from "@/lib/market-intelligence";
import { prisma } from "@/lib/prisma";

export const revalidate = 180;

export default async function StatusPage() {
  const [status, totalUsers, usersWithVerifiedReceipt] = await Promise.all([
    getPlatformStatusMetrics(),
    prisma.user.count(),
    prisma.user.count({
      where: {
        receipts: {
          some: { status: "REVIEWED" },
        },
      },
    }),
  ]);
  const verifiedAdoption = totalUsers > 0 ? Math.round((usersWithVerifiedReceipt / totalUsers) * 100) : 0;

  return (
    <main className="mx-auto max-w-6xl px-4 py-10 pb-16">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Plattformstatus og tillit</h1>
          <p className="mt-2 max-w-3xl text-slate-600 dark:text-slate-300">
            Offentlig driftsside for datamoat: ferskhet, dekning, filtrering og verifikasjon.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Link href="/coverage" className="rounded-xl border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:text-slate-200 dark:hover:bg-slate-800">
            Dekning
          </Link>
          <Link href="/ops" className="rounded-xl bg-emerald-600 px-4 py-2 text-sm font-medium text-white hover:bg-emerald-500">
            Operativt dashboard
          </Link>
        </div>
      </div>

      <section className="mt-6 grid gap-4 md:grid-cols-4">
        <article className="rounded-2xl border border-emerald-200 bg-emerald-50/80 p-4 dark:border-emerald-900 dark:bg-emerald-950/25">
          <p className="text-xs uppercase tracking-wide text-emerald-700 dark:text-emerald-300">Ferskhet 24t</p>
          <p className="mt-1 text-3xl font-semibold text-emerald-900 dark:text-emerald-100">{status.freshnessRatio}%</p>
        </article>
        <article className="rounded-2xl border border-cyan-200 bg-cyan-50/80 p-4 dark:border-cyan-900 dark:bg-cyan-950/25">
          <p className="text-xs uppercase tracking-wide text-cyan-700 dark:text-cyan-300">Datainntak helse</p>
          <p className="mt-1 text-3xl font-semibold text-cyan-900 dark:text-cyan-100">{status.ingestionHealth}/100</p>
        </article>
        <article className="rounded-2xl border border-indigo-200 bg-indigo-50/80 p-4 dark:border-indigo-900 dark:bg-indigo-950/25">
          <p className="text-xs uppercase tracking-wide text-indigo-700 dark:text-indigo-300">Tillit helse</p>
          <p className="mt-1 text-3xl font-semibold text-indigo-900 dark:text-indigo-100">{status.trustHealth}/100</p>
        </article>
        <article className="rounded-2xl border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900">
          <p className="text-xs uppercase tracking-wide text-slate-500">Sist oppdatert</p>
          <p className="mt-1 text-base font-semibold">{new Date(status.updatedAt).toLocaleString("nb-NO")}</p>
        </article>
      </section>

      <section className="mt-6 grid gap-4 md:grid-cols-3">
        <article className="rounded-2xl border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900">
          <p className="text-sm text-slate-500">Sporbare produkter</p>
          <p className="mt-1 text-2xl font-semibold">{status.trackedProducts}</p>
        </article>
        <article className="rounded-2xl border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900">
          <p className="text-sm text-slate-500">Butikker</p>
          <p className="mt-1 text-2xl font-semibold">{status.stores}</p>
        </article>
        <article className="rounded-2xl border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900">
          <p className="text-sm text-slate-500">Aktive varsler</p>
          <p className="mt-1 text-2xl font-semibold">{status.activeAlerts}</p>
        </article>
      </section>

      <section className="mt-4 rounded-2xl border border-cyan-200 bg-cyan-50/80 p-4 dark:border-cyan-900 dark:bg-cyan-950/25">
        <p className="text-xs uppercase tracking-wide text-cyan-700 dark:text-cyan-300">Brukerbevis KPI</p>
        <p className="mt-1 text-2xl font-semibold text-cyan-900 dark:text-cyan-100">{verifiedAdoption}% brukere med verifisert sparing</p>
        <p className="mt-1 text-sm text-cyan-900/90 dark:text-cyan-100/90">
          {usersWithVerifiedReceipt}/{totalUsers} brukere har minst én godkjent kvittering. Dette er en nøkkelmåling for tillit og faktisk verdi.
        </p>
      </section>

      <section className="mt-6 rounded-3xl border border-amber-200 bg-amber-50/80 p-5 dark:border-amber-900 dark:bg-amber-950/25">
        <h2 className="text-xl font-semibold text-amber-900 dark:text-amber-100">Apen driftstilstand</h2>
        <ul className="mt-3 space-y-2 text-sm text-amber-900/90 dark:text-amber-100/90">
          <li>Prisrader siste 24 timer: {status.freshPrices24h.toLocaleString("nb-NO")}</li>
          <li>Eldre enn 72 timer: {status.stalePrices72h.toLocaleString("nb-NO")} ({status.staleRatio}%)</li>
          <li>Filtrerte avvik (quarantine): {status.quarantinedRows.toLocaleString("nb-NO")}</li>
          <li>Verifiserte kvitteringer: {status.reviewedReceipts.toLocaleString("nb-NO")}</li>
        </ul>
      </section>
    </main>
  );
}
