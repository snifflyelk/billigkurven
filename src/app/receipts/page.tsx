import { ReceiptUploader } from "@/components/receipt-uploader";
import { prisma } from "@/lib/prisma";
import Link from "next/link";
import { buildReceiptSavingsInsight } from "@/lib/verified-savings";
import { formatNok } from "@/lib/utils";
import { getOrCreateSessionUserId } from "@/lib/user-session";

export const dynamic = "force-dynamic";

export default async function ReceiptsPage() {
  const userId = await getOrCreateSessionUserId();
  const products = await prisma.product.findMany({
    include: {
      prices: {
        include: { store: true },
        where: { isQuarantined: false },
        orderBy: { date: "desc" },
      },
    },
    take: 300,
  }).catch(() => []);

  const receipts = await prisma.receiptSubmission.findMany({ where: { userId }, orderBy: { createdAt: "desc" } }).catch(() => []);

  const reviewed = receipts.filter((receipt) => receipt.status === "REVIEWED").length;
  const pending = receipts.filter((receipt) => receipt.status === "PENDING").length;
  const totalVerifiedSavings = receipts.reduce((sum, receipt) => sum + Number(receipt.verifiedSavings ?? 0), 0);

  const productCandidates = products.map((product) => {
    const latestByStore = new Map<string, { storeId: string; storeName: string; price: number }>();
    for (const price of product.prices) {
      if (latestByStore.has(price.storeId)) continue;
      latestByStore.set(price.storeId, {
        storeId: price.storeId,
        storeName: price.store.name,
        price: Number(price.price),
      });
    }

    return {
      id: product.id,
      name: product.name,
      brand: product.brand,
      prices: Array.from(latestByStore.values()),
    };
  });

  function getConfidenceTone(confidence: string) {
    if (confidence === "hoy") return "Høy";
    if (confidence === "medium") return "Medium";
    return "Lav";
  }

  return (
    <main className="mx-auto max-w-6xl px-4 py-10 pb-24 md:pb-10">
      <h1 className="text-3xl font-bold tracking-tight">Kvitteringer</h1>
      <p className="mt-2 text-slate-600 dark:text-slate-300">
        Frivillig innsendelse som forbedrer personalisering og prisgrunnlag uten å blokkere onboarding.
      </p>

      <section className="mt-5 grid gap-4 sm:grid-cols-2 lg:grid-cols-4 fade-rise">
        <article className="rounded-2xl border border-emerald-200 bg-emerald-50/80 p-4 dark:border-emerald-900 dark:bg-emerald-950/25">
          <p className="text-xs font-semibold uppercase tracking-wide text-emerald-700 dark:text-emerald-300">Totalt verifisert spart</p>
          <p className="mt-1 text-2xl font-semibold text-emerald-900 dark:text-emerald-100">{formatNok(totalVerifiedSavings)}</p>
        </article>
        <article className="rounded-2xl border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900">
          <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Innsendelser</p>
          <p className="mt-1 text-2xl font-semibold">{receipts.length}</p>
        </article>
        <article className="rounded-2xl border border-cyan-200 bg-cyan-50/70 p-4 dark:border-cyan-900 dark:bg-cyan-950/20">
          <p className="text-xs font-semibold uppercase tracking-wide text-cyan-700 dark:text-cyan-300">Godkjent</p>
          <p className="mt-1 text-2xl font-semibold text-cyan-900 dark:text-cyan-100">{reviewed}</p>
        </article>
        <article className="rounded-2xl border border-amber-200 bg-amber-50/70 p-4 dark:border-amber-900 dark:bg-amber-950/20">
          <p className="text-xs font-semibold uppercase tracking-wide text-amber-700 dark:text-amber-300">Venter behandling</p>
          <p className="mt-1 text-2xl font-semibold text-amber-900 dark:text-amber-100">{pending}</p>
        </article>
      </section>

      <div className="mt-8 grid gap-6 lg:grid-cols-[1fr_1.1fr] fade-rise-delayed">
        <ReceiptUploader />

        <section className="rounded-2xl border border-slate-200 bg-white p-5 dark:border-slate-800 dark:bg-slate-900">
          <h2 className="text-lg font-semibold">Mine innsendelser</h2>
          <div className="mt-4 space-y-3">
            {receipts.length === 0 ? (
              <div className="rounded-xl border border-dashed border-slate-300 p-4 text-sm text-slate-500 dark:border-slate-700 dark:text-slate-400">
                Ingen kvitteringer sendt ennå.
              </div>
            ) : (
              receipts.map((receipt) => (
                <div key={receipt.id} className="rounded-xl border border-slate-200 p-3 text-sm dark:border-slate-800">
                  {(() => {
                    const persistedInsight = receipt.savingsConfidence
                      ? {
                          actualTotal: receipt.detectedTotal ? Number(receipt.detectedTotal) : null,
                          estimatedCheapestTotal: receipt.estimatedCheapestTotal ? Number(receipt.estimatedCheapestTotal) : null,
                          estimatedDetectedStoreTotal: receipt.estimatedDetectedStoreTotal ? Number(receipt.estimatedDetectedStoreTotal) : null,
                          verifiedSavings: receipt.verifiedSavings ? Number(receipt.verifiedSavings) : null,
                          matchedItems: receipt.matchedItems ?? 0,
                          totalItems: receipt.totalItems ?? 0,
                          confidence: receipt.savingsConfidence as "lav" | "medium" | "hoy",
                          note: receipt.savingsNote ?? "",
                        }
                      : null;

                    const insight =
                      persistedInsight ??
                      buildReceiptSavingsInsight(
                        {
                          detectedStore: receipt.detectedStore,
                          detectedTotal: receipt.detectedTotal ? Number(receipt.detectedTotal) : null,
                          recognizedItems: receipt.recognizedItems,
                        },
                        productCandidates,
                      );

                    return (
                      <div className="mb-3 rounded-lg border border-emerald-200 bg-emerald-50/80 p-3 text-xs dark:border-emerald-900 dark:bg-emerald-950/30">
                        <p className="font-semibold text-emerald-800 dark:text-emerald-300">Verifisert spareinnsikt</p>
                        <p className="mt-1 text-emerald-900/90 dark:text-emerald-100/90">{insight.note}</p>
                        <p className="mt-1 text-emerald-800 dark:text-emerald-200">
                          Confidence: {getConfidenceTone(insight.confidence)} · Matcher: {insight.matchedItems}/{insight.totalItems}
                        </p>
                        <p className="mt-1 text-emerald-800 dark:text-emerald-200">
                          Faktisk sum: {insight.actualTotal !== null ? formatNok(insight.actualTotal) : "-"} ·
                          Billigste estimat: {insight.estimatedCheapestTotal !== null ? formatNok(insight.estimatedCheapestTotal) : "-"} ·
                          Verifisert spart: {insight.verifiedSavings !== null ? formatNok(insight.verifiedSavings) : "-"}
                        </p>
                      </div>
                    );
                  })()}
                  <div className="flex items-center justify-between gap-3">
                    <span className="font-medium">{receipt.fileName}</span>
                    <span className="rounded-full bg-slate-100 px-2 py-1 text-xs dark:bg-slate-800">{receipt.status}</span>
                  </div>
                  <p className="mt-1 text-slate-500">{receipt.detectedStore ?? "Ikke vurdert"}</p>
                </div>
              ))
            )}
          </div>
        </section>
      </div>

      <div className="mobile-bottom-bar fixed inset-x-0 bottom-0 z-40 border-t border-slate-200 bg-white/95 p-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] backdrop-blur md:hidden dark:border-slate-800 dark:bg-slate-950/90">
        <div className="mobile-bottom-actions mx-auto grid max-w-6xl grid-cols-2 gap-2">
          <Link href="/compare" className="mobile-bottom-action min-w-0 rounded-xl border border-slate-300 px-2.5 py-2 text-center text-[13px] font-medium leading-tight sm:px-3 sm:text-sm dark:border-slate-700">
            Se sammenligning
          </Link>
          <Link href="/alerts" className="mobile-bottom-action min-w-0 rounded-xl bg-emerald-600 px-2.5 py-2 text-center text-[13px] font-medium leading-tight text-white sm:px-3 sm:text-sm">
            Varsle meg
          </Link>
        </div>
      </div>
    </main>
  );
}
