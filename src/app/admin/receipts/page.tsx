import { ReceiptReviewPanel } from "@/components/receipt-review-panel";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

export default async function AdminReceiptsPage() {
  const rawReceipts = await prisma.receiptSubmission.findMany({
    orderBy: { createdAt: "desc" },
    include: {
      user: true,
    },
  });

  const receipts = rawReceipts.map((receipt) => ({
    ...receipt,
    detectedTotal: receipt.detectedTotal ? Number(receipt.detectedTotal) : null,
    recognizedItems: Array.isArray(receipt.recognizedItems)
      ? receipt.recognizedItems
          .filter((item) => item && typeof item === "object")
          .map((item) => {
            const entry = item as Record<string, unknown>;
            return {
              label: typeof entry.label === "string" ? entry.label : undefined,
              amount: typeof entry.amount === "number" ? entry.amount : undefined,
              quantity: typeof entry.quantity === "number" ? entry.quantity : undefined,
              unitPrice: typeof entry.unitPrice === "number" ? entry.unitPrice : undefined,
              kind: typeof entry.kind === "string" ? entry.kind : undefined,
            };
          })
      : null,
  }));

  const pending = receipts.filter((receipt) => receipt.status === "PENDING").length;
  const reviewed = receipts.filter((receipt) => receipt.status === "REVIEWED").length;
  const rejected = receipts.filter((receipt) => receipt.status === "REJECTED").length;

  return (
    <main className="mx-auto max-w-6xl px-4 py-10">
      <h1 className="text-3xl font-bold tracking-tight">Kvitteringsvalidering</h1>
      <p className="mt-2 text-slate-600 dark:text-slate-300">
        Manuell kontroll av kvitteringer, status og annoteringer for å forbedre datagrunnlaget.
      </p>
      <section className="mt-5 grid gap-4 md:grid-cols-3 fade-rise">
        <article className="rounded-2xl border border-amber-200 bg-amber-50/80 p-4 dark:border-amber-900 dark:bg-amber-950/25">
          <p className="text-xs uppercase tracking-wide text-amber-700 dark:text-amber-300">Til gjennomgang</p>
          <p className="mt-1 text-2xl font-semibold text-amber-900 dark:text-amber-100">{pending}</p>
        </article>
        <article className="rounded-2xl border border-emerald-200 bg-emerald-50/80 p-4 dark:border-emerald-900 dark:bg-emerald-950/25">
          <p className="text-xs uppercase tracking-wide text-emerald-700 dark:text-emerald-300">Godkjent</p>
          <p className="mt-1 text-2xl font-semibold text-emerald-900 dark:text-emerald-100">{reviewed}</p>
        </article>
        <article className="rounded-2xl border border-rose-200 bg-rose-50/80 p-4 dark:border-rose-900 dark:bg-rose-950/25">
          <p className="text-xs uppercase tracking-wide text-rose-700 dark:text-rose-300">Avvist</p>
          <p className="mt-1 text-2xl font-semibold text-rose-900 dark:text-rose-100">{rejected}</p>
        </article>
      </section>
      {receipts.length === 0 ? (
        <section className="mt-6 rounded-2xl border border-slate-200 bg-white p-4 text-sm dark:border-slate-800 dark:bg-slate-900">
          <p className="font-medium">Ingen innsendelser å validere ennå</p>
          <p className="mt-1 text-slate-500 dark:text-slate-400">Be brukere laste opp kvitteringer fra kvitteringssiden for å starte kvalitetssikring.</p>
        </section>
      ) : null}
      <div className="mt-8">
        <ReceiptReviewPanel receipts={receipts} />
      </div>
    </main>
  );
}
