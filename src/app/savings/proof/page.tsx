import Link from "next/link";

import { PrintProofButton } from "@/components/print-proof-button";
import { ShareSavingsCard } from "@/components/share-savings-card";
import { prisma } from "@/lib/prisma";
import { requireAuthenticatedSessionUserId } from "@/lib/user-session";
import { formatNok } from "@/lib/utils";

export const dynamic = "force-dynamic";

function parseMonth(queryMonth: string | undefined) {
  if (!queryMonth) return null;
  const match = queryMonth.match(/^(\d{4})-(\d{2})$/);
  if (!match) return null;
  const year = Number(match[1]);
  const month = Number(match[2]);
  if (!Number.isFinite(year) || !Number.isFinite(month) || month < 1 || month > 12) return null;
  return { year, month };
}

export default async function SavingsProofPage({
  searchParams,
}: {
  searchParams: { month?: string };
}) {
  const parsed = parseMonth(searchParams.month);
  const now = new Date();
  const month = parsed?.month ?? now.getMonth() + 1;
  const year = parsed?.year ?? now.getFullYear();

  const from = new Date(year, month - 1, 1, 0, 0, 0, 0);
  const to = new Date(year, month, 1, 0, 0, 0, 0);
  const currentUserId = await requireAuthenticatedSessionUserId(`/savings/proof?month=${year}-${String(month).padStart(2, "0")}`);

  const user = await prisma.user.findUnique({ where: { id: currentUserId }, select: { id: true, email: true } });

  if (!user) {
    return (
      <main className="mx-auto max-w-4xl px-4 py-10">
        <h1 className="text-3xl font-bold tracking-tight">Sparebevis</h1>
        <p className="mt-3 text-slate-600 dark:text-slate-300">Ingen aktiv bruker funnet. Kjør onboarding for å aktivere sparebevis.</p>
      </main>
    );
  }

  const receipts = await prisma.receiptSubmission.findMany({
    where: {
      userId: user.id,
      status: "REVIEWED",
      createdAt: { gte: from, lt: to },
    },
    orderBy: { createdAt: "asc" },
  });

  const verifiedSavings = Number(receipts.reduce((sum, receipt) => sum + Number(receipt.verifiedSavings ?? 0), 0).toFixed(2));
  const matchedItems = receipts.reduce((sum, receipt) => sum + Number(receipt.matchedItems ?? 0), 0);
  const totalItems = receipts.reduce((sum, receipt) => sum + Number(receipt.totalItems ?? 0), 0);
  const accuracy = totalItems > 0 ? Number(((matchedItems / totalItems) * 100).toFixed(1)) : null;
  const highConfidenceCount = receipts.filter((receipt) => String(receipt.savingsConfidence ?? "").toLowerCase().includes("høy")).length;
  const highConfidenceRatio = receipts.length > 0 ? Math.round((highConfidenceCount / receipts.length) * 100) : null;
  const monthLabel = from.toLocaleDateString("nb-NO", { month: "long", year: "numeric" });

  const trendRows = receipts.map((receipt) => ({
    id: receipt.id,
    date: new Date(receipt.createdAt).toLocaleDateString("nb-NO"),
    savings: Number(receipt.verifiedSavings ?? 0),
  }));
  const maxTrendValue = Math.max(1, ...trendRows.map((row) => row.savings));

  const bestChoices = receipts
    .filter((receipt) => Number(receipt.verifiedSavings ?? 0) > 0)
    .sort((a, b) => Number(b.verifiedSavings ?? 0) - Number(a.verifiedSavings ?? 0))
    .slice(0, 3)
    .map((receipt) => ({
      id: receipt.id,
      store: receipt.detectedStore ?? "Ukjent butikk",
      saved: Number(receipt.verifiedSavings ?? 0),
      confidence: receipt.savingsConfidence ?? "ikke gradert",
    }));

  return (
    <main className="mx-auto max-w-6xl px-4 py-10 md:py-12 print:px-0 print:py-4">
      <section className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm fade-rise dark:border-slate-800 dark:bg-slate-900 print:rounded-none print:border-none print:shadow-none">
        <div className="no-print mb-6 flex flex-wrap items-center justify-between gap-3">
          <div>
            <h1 className="text-4xl font-bold tracking-tight">Sparebevis</h1>
            <p className="mt-1 text-sm text-slate-600 dark:text-slate-300">Månedlig verifisert sparing dokumentert med godkjente kvitteringer.</p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Link href="/savings" className="rounded-xl border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:text-slate-200 dark:hover:bg-slate-800">
              Til sparehistorikk
            </Link>
            <PrintProofButton />
          </div>
        </div>

        <header className="rounded-2xl border border-emerald-200 bg-emerald-50/80 p-5 dark:border-emerald-900 dark:bg-emerald-950/30">
          <p className="text-xs uppercase tracking-wide text-emerald-700 dark:text-emerald-300">Sparebevis for {monthLabel}</p>
          <h2 className="mt-2 text-3xl font-bold text-emerald-900 dark:text-emerald-100">Denne måneden har du spart {formatNok(verifiedSavings)}</h2>
          <p className="mt-1 text-sm text-emerald-900/90 dark:text-emerald-100/90">Bruker: {user.email}</p>
        </header>

        <section className="mt-6 grid gap-3 sm:grid-cols-2 xl:grid-cols-4 fade-rise-delayed">
          <article className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-800 dark:bg-slate-900">
            <p className="text-xs uppercase tracking-wide text-slate-500">Godkjente kvitteringer</p>
            <p className="mt-1 text-3xl font-semibold">{receipts.length}</p>
          </article>
          <article className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-800 dark:bg-slate-900">
            <p className="text-xs uppercase tracking-wide text-slate-500">Varetreffsikkerhet</p>
            <p className="mt-1 text-3xl font-semibold">{accuracy !== null ? `${accuracy}%` : "-"}</p>
          </article>
          <article className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-800 dark:bg-slate-900">
            <p className="text-xs uppercase tracking-wide text-slate-500">Høy confidence-andel</p>
            <p className="mt-1 text-3xl font-semibold">{highConfidenceRatio !== null ? `${highConfidenceRatio}%` : "-"}</p>
          </article>
          <article className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-800 dark:bg-slate-900">
            <p className="text-xs uppercase tracking-wide text-slate-500">Verifiserte linjer</p>
            <p className="mt-1 text-3xl font-semibold">{matchedItems}/{totalItems}</p>
          </article>
        </section>

        <section className="mt-6 rounded-3xl border border-slate-200 bg-white p-5 shadow-sm fade-rise-delayed dark:border-slate-800 dark:bg-slate-900">
          <h3 className="text-xl font-semibold">Utvikling i måneden</h3>
          {trendRows.length === 0 ? (
            <p className="mt-3 text-sm text-slate-500 dark:text-slate-400">Ingen godkjente kvitteringer i valgt periode.</p>
          ) : (
            <ul className="mt-4 space-y-2">
              {trendRows.map((row) => (
                <li key={row.id} className="rounded-xl border border-slate-200 p-3 dark:border-slate-800">
                  <div className="mb-2 flex items-center justify-between text-xs text-slate-500 dark:text-slate-400">
                    <span>{row.date}</span>
                    <span>{formatNok(row.savings)}</span>
                  </div>
                  <div className="h-2 rounded-full bg-slate-100 dark:bg-slate-800">
                    <div className="h-2 rounded-full bg-emerald-500" style={{ width: `${Math.max(4, Math.round((row.savings / maxTrendValue) * 100))}%` }} />
                  </div>
                </li>
              ))}
            </ul>
          )}
        </section>

        <section className="mt-6 rounded-3xl border border-slate-200 bg-white p-5 shadow-sm fade-rise-slow dark:border-slate-800 dark:bg-slate-900">
          <h3 className="text-xl font-semibold">Dine beste valg denne uken</h3>
          {bestChoices.length === 0 ? (
            <p className="mt-3 text-sm text-slate-500 dark:text-slate-400">Vi trenger flere godkjente kvitteringer for å rangere beste valg.</p>
          ) : (
            <div className="mt-4 grid gap-3 md:grid-cols-3">
              {bestChoices.map((choice) => (
                <article key={choice.id} className="rounded-2xl border border-emerald-200 bg-emerald-50/80 p-4 dark:border-emerald-900 dark:bg-emerald-950/30">
                  <p className="text-xs uppercase tracking-wide text-emerald-700 dark:text-emerald-300">{choice.store}</p>
                  <p className="mt-1 text-2xl font-semibold text-emerald-900 dark:text-emerald-100">{formatNok(choice.saved)}</p>
                  <p className="mt-1 text-xs text-emerald-800/80 dark:text-emerald-200/80">Confidence: {choice.confidence}</p>
                </article>
              ))}
            </div>
          )}
        </section>

        <section className="mt-6">
          <h3 className="text-lg font-semibold">Dokumenterte kvitteringer</h3>
          {receipts.length === 0 ? (
            <p className="mt-2 text-sm text-slate-500 dark:text-slate-400">Ingen godkjente kvitteringer i valgt periode.</p>
          ) : (
            <div className="mt-3 overflow-x-auto rounded-2xl border border-slate-200 dark:border-slate-800">
              <table className="min-w-[42rem] w-full text-left text-sm">
                <thead className="bg-slate-50 dark:bg-slate-950/50">
                  <tr>
                    <th className="px-3 py-2 font-medium">Dato</th>
                    <th className="px-3 py-2 font-medium">Butikk</th>
                    <th className="px-3 py-2 font-medium">Faktisk sum</th>
                    <th className="px-3 py-2 font-medium">Billigste estimat</th>
                    <th className="px-3 py-2 font-medium">Spart</th>
                    <th className="px-3 py-2 font-medium">Confidence</th>
                  </tr>
                </thead>
                <tbody>
                  {receipts.map((receipt) => (
                    <tr key={receipt.id} className="border-t border-slate-200 dark:border-slate-800">
                      <td className="px-3 py-2">{new Date(receipt.createdAt).toLocaleDateString("nb-NO")}</td>
                      <td className="px-3 py-2">{receipt.detectedStore ?? "-"}</td>
                      <td className="px-3 py-2">{receipt.detectedTotal !== null ? formatNok(Number(receipt.detectedTotal)) : "-"}</td>
                      <td className="px-3 py-2">{receipt.estimatedCheapestTotal !== null ? formatNok(Number(receipt.estimatedCheapestTotal)) : "-"}</td>
                      <td className="px-3 py-2 font-medium text-emerald-700 dark:text-emerald-300">{receipt.verifiedSavings !== null ? formatNok(Number(receipt.verifiedSavings)) : "-"}</td>
                      <td className="px-3 py-2">{receipt.savingsConfidence ?? "-"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>

        <div className="mt-6 print:hidden">
          <ShareSavingsCard
            monthLabel={monthLabel}
            verifiedSavingsLabel={formatNok(verifiedSavings)}
            confidenceRatioLabel={highConfidenceRatio !== null ? `${highConfidenceRatio}%` : "ikke nok data"}
          />
        </div>
      </section>
    </main>
  );
}
