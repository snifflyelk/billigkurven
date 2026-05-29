import Link from "next/link";

import { PrintProofButton } from "@/components/print-proof-button";
import { DEFAULT_USER_EMAIL } from "@/lib/constants";
import { prisma } from "@/lib/prisma";
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

  const user = await prisma.user.findUnique({ where: { email: DEFAULT_USER_EMAIL }, select: { id: true, email: true } });

  if (!user) {
    return (
      <main className="mx-auto max-w-4xl px-4 py-10">
        <h1 className="text-3xl font-bold tracking-tight">Sparebevis</h1>
        <p className="mt-3 text-slate-600 dark:text-slate-300">Ingen aktiv bruker funnet. Kjor onboarding for a aktivere sparebevis.</p>
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
  const highConfidenceCount = receipts.filter((receipt) => String(receipt.savingsConfidence ?? "").toLowerCase().includes("hoy")).length;
  const highConfidenceRatio = receipts.length > 0 ? Math.round((highConfidenceCount / receipts.length) * 100) : null;

  return (
    <main className="mx-auto max-w-4xl px-4 py-10 print:px-0 print:py-4">
      <section className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm dark:border-slate-800 dark:bg-slate-900 print:rounded-none print:border-none print:shadow-none">
        <div className="no-print mb-6 flex flex-wrap items-center justify-between gap-3">
          <div>
            <h1 className="text-3xl font-bold tracking-tight">Sparebevis</h1>
            <p className="mt-1 text-sm text-slate-600 dark:text-slate-300">Maanedlig verifisert sparing dokumentert med godkjente kvitteringer.</p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Link href="/savings" className="rounded-xl border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:text-slate-200 dark:hover:bg-slate-800">
              Til sparehistorikk
            </Link>
            <PrintProofButton />
          </div>
        </div>

        <header>
          <p className="text-xs uppercase tracking-wide text-slate-500">Billigkurven sparebevis</p>
          <h2 className="mt-1 text-2xl font-bold">{from.toLocaleDateString("nb-NO", { month: "long", year: "numeric" })}</h2>
          <p className="mt-1 text-sm text-slate-600 dark:text-slate-300">Bruker: {user.email}</p>
          <p className="mt-1 text-sm text-slate-600 dark:text-slate-300">Generert: {new Date().toLocaleString("nb-NO")}</p>
        </header>

        <section className="mt-6 grid gap-3 sm:grid-cols-2">
          <article className="rounded-2xl border border-emerald-200 bg-emerald-50/80 p-4 dark:border-emerald-900 dark:bg-emerald-950/25">
            <p className="text-xs uppercase tracking-wide text-emerald-700 dark:text-emerald-300">Verifisert spart</p>
            <p className="mt-1 text-3xl font-semibold text-emerald-900 dark:text-emerald-100">{formatNok(verifiedSavings)}</p>
          </article>
          <article className="rounded-2xl border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900">
            <p className="text-xs uppercase tracking-wide text-slate-500">Godkjente kvitteringer</p>
            <p className="mt-1 text-3xl font-semibold">{receipts.length}</p>
          </article>
          <article className="rounded-2xl border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900">
            <p className="text-xs uppercase tracking-wide text-slate-500">Varetreffsikkerhet</p>
            <p className="mt-1 text-3xl font-semibold">{accuracy !== null ? `${accuracy}%` : "-"}</p>
            <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">{matchedItems}/{totalItems} linjer matchet</p>
          </article>
          <article className="rounded-2xl border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900">
            <p className="text-xs uppercase tracking-wide text-slate-500">Hoy confidence-andel</p>
            <p className="mt-1 text-3xl font-semibold">{highConfidenceRatio !== null ? `${highConfidenceRatio}%` : "-"}</p>
            <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">{highConfidenceCount}/{receipts.length} kvitteringer</p>
          </article>
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

        <footer className="mt-6 rounded-2xl border border-slate-200 bg-slate-50/80 p-3 text-xs text-slate-600 dark:border-slate-800 dark:bg-slate-950/40 dark:text-slate-300 print:bg-white">
          Dette sparebeviset er basert pa godkjente kvitteringer og verifisert mot observerte priser i prisdatabasen for tilsvarende varelinjer.
        </footer>
      </section>
    </main>
  );
}
