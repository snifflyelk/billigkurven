"use client";

import Image from "next/image";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { useToast } from "@/components/providers/toast-provider";
import { apiRequest, toUserErrorMessage } from "@/lib/api-client";

type Receipt = {
  id: string;
  fileName: string;
  status: string;
  detectedStore: string | null;
  detectedTotal: string | number | null;
  recognizedText: string | null;
  recognizedItems: Array<{
    label?: string;
    amount?: number;
    quantity?: number;
    unitPrice?: number;
    kind?: string;
  }> | null;
  notes: string | null;
  imageDataUrl: string | null;
  user: { email: string };
};

export function ReceiptReviewPanel({ receipts }: { receipts: Receipt[] }) {
  const router = useRouter();
  const { showToast } = useToast();
  const [reviewNotes, setReviewNotes] = useState<Record<string, string>>({});

  async function sendReview(id: string, status: "REVIEWED" | "REJECTED") {
    await apiRequest<{ receipt: { id: string } }>(`/api/admin/receipts?id=${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        status,
        notes: reviewNotes[id] ?? "",
      }),
    });
  }

  async function reviewReceipt(id: string, status: "REVIEWED" | "REJECTED") {
    try {
      await sendReview(id, status);

      showToast({
        title: status === "REVIEWED" ? "Kvittering godkjent" : "Kvittering avvist",
        type: "success",
      });
      router.refresh();
    } catch (error) {
      showToast({
        title: "Kunne ikke oppdatere kvittering",
        description: toUserErrorMessage(error),
        type: "error",
        actionLabel: "Prøv igjen",
        onAction: () => reviewReceipt(id, status),
      });
    }
  }

  return (
    <section className="space-y-4">
      {receipts.map((receipt) => (
        <article key={receipt.id} className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900">
          {(() => {
            const expectedTotal = typeof receipt.detectedTotal === "number" ? receipt.detectedTotal : Number(receipt.detectedTotal ?? 0);
            const recognizedTotal = Array.isArray(receipt.recognizedItems)
              ? receipt.recognizedItems.reduce((sum, item) => {
                  const entry = item as { amount?: number };
                  return sum + Number(entry.amount ?? 0);
                }, 0)
              : 0;
            const hasDiscrepancy = expectedTotal > 0 && recognizedTotal > 0 && Math.abs(expectedTotal - recognizedTotal) > 1.5;
            const hasVatLine = Array.isArray(receipt.recognizedItems)
              ? receipt.recognizedItems.some((item) => (item.kind ?? "").toLowerCase() === "tax")
              : false;

            return (
              <div className="mb-4 rounded-2xl border border-amber-200 bg-amber-50 p-3 text-xs text-amber-900 dark:border-amber-900 dark:bg-amber-950/30 dark:text-amber-200">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <p className="font-medium">Automatisk avvikskontroll</p>
                  <span className={`rounded-full px-2.5 py-1 font-semibold ${hasDiscrepancy ? "bg-amber-200 text-amber-950 dark:bg-amber-900/80 dark:text-amber-100" : "bg-emerald-200 text-emerald-950 dark:bg-emerald-900/80 dark:text-emerald-100"}`}>
                    {hasDiscrepancy ? "Krever manuell sjekk" : "Ser konsistent ut"}
                  </span>
                </div>
                <p className="mt-2">
                  OCR-sum: {recognizedTotal > 0 ? recognizedTotal.toFixed(2) : "-"} · Detekt sum: {expectedTotal > 0 ? expectedTotal.toFixed(2) : "-"} · MVA-linje: {hasVatLine ? "ja" : "nei"} · Status: {hasDiscrepancy ? "sjekk manuelt" : "ser konsistent ut"}
                </p>
              </div>
            );
          })()}
          <div className="grid gap-4 lg:grid-cols-[1.2fr_0.8fr]">
            <div>
              <div className="flex flex-wrap items-start justify-between gap-4">
                <div>
                  <p className="text-sm text-slate-500">{receipt.user.email}</p>
                  <h3 className="text-lg font-semibold">{receipt.fileName}</h3>
                  <p className="mt-1 text-sm text-slate-600 dark:text-slate-300">
                    Forslag: {receipt.detectedStore ?? "-"} · {receipt.detectedTotal ? `kr ${receipt.detectedTotal}` : "ingen total"}
                  </p>
                </div>
                <span className="rounded-full border border-slate-200 bg-slate-50 px-3 py-1 text-xs font-semibold uppercase tracking-wide text-slate-600 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-300">
                  {receipt.status}
                </span>
              </div>

              {receipt.recognizedText ? (
                <details className="mt-3 rounded-xl border border-slate-200 bg-slate-50 p-3 text-xs dark:border-slate-800 dark:bg-slate-950">
                  <summary className="cursor-pointer font-medium text-slate-600 dark:text-slate-300">Vis OCR-tekst</summary>
                  <pre className="mt-2 whitespace-pre-wrap break-words font-sans text-[11px] leading-5 text-slate-500 dark:text-slate-400">
                    {receipt.recognizedText}
                  </pre>
                </details>
              ) : null}
              {Array.isArray(receipt.recognizedItems) && receipt.recognizedItems.length > 0 ? (
                <details className="mt-3 rounded-xl border border-slate-200 bg-slate-50 p-3 text-xs dark:border-slate-800 dark:bg-slate-950">
                  <summary className="cursor-pointer font-medium text-slate-600 dark:text-slate-300">Vis varelinjer</summary>
                  <ul className="mt-2 space-y-1">
                    {receipt.recognizedItems.map((item, index) => {
                      const entry = item as { label?: string; amount?: number; quantity?: number; unitPrice?: number; kind?: string };
                      return (
                        <li key={`${receipt.id}-${index}`} className="flex items-center justify-between gap-3 text-slate-500 dark:text-slate-400">
                          <span>
                            {entry.label ?? "Ukjent vare"}
                            {entry.kind ? <span className="ml-2 rounded-full bg-slate-100 px-2 py-0.5 text-[10px] uppercase tracking-wide text-slate-500 dark:bg-slate-800">{entry.kind}</span> : null}
                          </span>
                          <span className="font-medium">
                            {entry.quantity && entry.unitPrice ? `${entry.quantity} x ${Number(entry.unitPrice).toFixed(2)} = ` : ""}
                            {Number(entry.amount ?? 0).toFixed(2)}
                          </span>
                        </li>
                      );
                    })}
                  </ul>
                </details>
              ) : null}
            </div>
            <div className="space-y-4 rounded-2xl border border-slate-200 bg-slate-50/80 p-4 dark:border-slate-800 dark:bg-slate-950/50">
              <div>
                <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Review handling</p>
                <p className="mt-1 text-sm text-slate-600 dark:text-slate-300">Ta en rask beslutning og legg ved notat dersom kvitteringen bør brukes som treningssignal.</p>
              </div>
              <div className="flex gap-2">
                <button onClick={() => reviewReceipt(receipt.id, "REVIEWED")} className="flex-1 rounded-xl bg-emerald-600 px-3 py-2 text-sm font-medium text-white">
                  Godkjenn
                </button>
                <button onClick={() => reviewReceipt(receipt.id, "REJECTED")} className="flex-1 rounded-xl border border-rose-300 px-3 py-2 text-sm font-medium text-rose-700 dark:border-rose-800 dark:text-rose-300">
                  Avvis
                </button>
              </div>
              <textarea
                value={reviewNotes[receipt.id] ?? receipt.notes ?? ""}
                onChange={(e) => setReviewNotes((current) => ({ ...current, [receipt.id]: e.target.value }))}
                className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-950"
                rows={4}
                placeholder="Notat til manuell vurdering, modellfeil eller oppfølging"
              />
              <p className="text-xs text-slate-500 dark:text-slate-400">Et kort notat her gjør senere revisjon og OCR-forbedring mye enklere.</p>
            </div>
          </div>

          {receipt.imageDataUrl ? (
            <Image
              src={receipt.imageDataUrl}
              alt={receipt.fileName}
              width={600}
              height={900}
              unoptimized
              className="mt-4 max-h-64 w-auto rounded-xl border border-slate-200 object-contain dark:border-slate-800"
            />
          ) : null}
        </article>
      ))}
    </section>
  );
}
