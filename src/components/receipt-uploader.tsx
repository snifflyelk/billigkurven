"use client";

import { useState } from "react";
import type { FormEvent } from "react";
import { parseReceiptText } from "@/lib/receipt-parser";
import { useToast } from "@/components/providers/toast-provider";
import { apiRequest, toUserErrorMessage } from "@/lib/api-client";

type TesseractModule = typeof import("tesseract.js");
type ParsedReceiptLineItem = {
  label: string;
  amount: number;
  quantity?: number;
  unitPrice?: number;
  kind: "item" | "summary" | "tax" | "discount";
};

export function ReceiptUploader() {
  const { showToast } = useToast();
  const [fileName, setFileName] = useState("");
  const [imageDataUrl, setImageDataUrl] = useState("");
  const [detectedStore, setDetectedStore] = useState("");
  const [detectedTotal, setDetectedTotal] = useState("");
  const [recognizedText, setRecognizedText] = useState("");
  const [recognizedItems, setRecognizedItems] = useState<ParsedReceiptLineItem[]>([]);
  const [notes, setNotes] = useState("");
  const [isSaving, setIsSaving] = useState(false);
  const [isScanning, setIsScanning] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  async function submitReceipt() {
    await apiRequest<{ receipt: { id: string } }>("/api/receipts", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        fileName: fileName || "kvittering.png",
        imageDataUrl,
        recognizedText,
        recognizedItems,
        detectedStore,
        detectedTotal: detectedTotal ? Number(detectedTotal) : undefined,
        notes,
      }),
    });
  }

  async function scanReceipt(image: string) {
    setIsScanning(true);

    try {
      const tesseract = (await import("tesseract.js")) as TesseractModule;
      const result = await tesseract.recognize(image, "nor+eng", {
        logger: () => undefined,
      });

      const parsed = parseReceiptText(result.data.text);
      setRecognizedText(parsed.recognizedText);
      setRecognizedItems(parsed.recognizedItems);
      setDetectedStore(parsed.detectedStore ?? "");
      setDetectedTotal(parsed.detectedTotal !== null ? String(parsed.detectedTotal.toFixed(2)) : "");
      setNotes((current) => current || "OCR-parsing fullført. Kontroller forslagene før innsending.");
    } catch {
      setMessage("OCR kunne ikke lese kvitteringen automatisk, men du kan fylle inn feltene manuelt.");
      showToast({
        title: "OCR-feil",
        description: "OCR kunne ikke lese kvitteringen automatisk, men du kan fylle inn feltene manuelt.",
        type: "error",
      });
    } finally {
      setIsScanning(false);
    }
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setIsSaving(true);
    setMessage(null);

    try {
      await submitReceipt();

      setMessage("Kvittering sendt til manuell validering.");
      showToast({ title: "Kvittering sendt", type: "success" });
      setFileName("");
      setImageDataUrl("");
      setDetectedStore("");
      setDetectedTotal("");
      setRecognizedItems([]);
      setNotes("");
    } catch (error) {
      const text = toUserErrorMessage(error, "Kunne ikke lagre kvittering.");
      setMessage(text);
      showToast({
        title: "Lagring feilet",
        description: text,
        type: "error",
        actionLabel: "Prøv igjen",
        onAction: async () => {
          try {
            await submitReceipt();
            showToast({ title: "Kvittering sendt", type: "success" });
          } catch (retryError) {
            showToast({
              title: "Fortsatt feil",
              description: toUserErrorMessage(retryError),
              type: "error",
            });
          }
        },
      });
    } finally {
      setIsSaving(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4 rounded-3xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900">
      <div className="rounded-2xl border border-emerald-200 bg-emerald-50/70 p-4 text-sm text-emerald-900 dark:border-emerald-900 dark:bg-emerald-950/25 dark:text-emerald-100">
        <p className="font-semibold">Gi noe tilbake med en gang</p>
        <p className="mt-1 text-xs text-emerald-800/90 dark:text-emerald-200/90">
          Hver kvittering forbedrer matching, verifisert sparing og lokale anbefalinger for neste handlekurv.
        </p>
      </div>

      <div>
        <label className="block text-sm font-medium">Last opp kvittering</label>
        <input
          type="file"
          accept="image/*"
          className="mt-2 block w-full text-sm"
          onChange={async (event) => {
            const file = event.target.files?.[0];
            if (!file) return;
            setFileName(file.name);
            const reader = new FileReader();
            reader.onload = async () => {
              const image = String(reader.result ?? "");
              setImageDataUrl(image);
              await scanReceipt(image);
            };
            reader.readAsDataURL(file);
          }}
        />
        <p className="mt-1 text-xs text-slate-500">
          OCR leser kvitteringen automatisk og fyller inn butikk og totalsum hvis mulig.
        </p>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <label className="block text-sm font-medium">
          Butikkforslag
          <input value={detectedStore} onChange={(e) => setDetectedStore(e.target.value)} className="mt-2 w-full rounded-xl border border-slate-300 px-3 py-2 dark:border-slate-700 dark:bg-slate-950" placeholder="Kiwi, Rema 1000..." />
        </label>
        <label className="block text-sm font-medium">
          Totalsum
          <input value={detectedTotal} onChange={(e) => setDetectedTotal(e.target.value)} type="number" step="0.01" className="mt-2 w-full rounded-xl border border-slate-300 px-3 py-2 dark:border-slate-700 dark:bg-slate-950" placeholder="kr" />
        </label>
      </div>

      <div className="rounded-xl border border-slate-200 bg-slate-50 p-4 text-xs text-slate-600 dark:border-slate-800 dark:bg-slate-950 dark:text-slate-300">
        <div className="flex items-center justify-between gap-3">
          <p className="font-medium">OCR-status</p>
          <span className={`rounded-full px-2 py-1 text-[11px] ${isScanning ? "bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-200" : recognizedText ? "bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-200" : "bg-white text-slate-500 dark:bg-slate-900 dark:text-slate-400"}`}>
            {isScanning ? "Skanner..." : recognizedText ? "Ferdig" : "Venter"}
          </span>
        </div>
        <p className="mt-2 whitespace-pre-wrap leading-5">
          {recognizedText || "Last opp et bilde for automatisk lesing av butikk og sum."}
        </p>
        {recognizedItems.length > 0 ? (
          <div className="mt-3 rounded-xl border border-slate-200 bg-white p-3 dark:border-slate-800 dark:bg-slate-900">
            <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">Varelinjer funnet</p>
            <ul className="mt-2 space-y-1 text-[11px] text-slate-600 dark:text-slate-300">
              {recognizedItems.map((item) => (
                <li key={`${item.label}-${item.amount}-${item.kind}`} className="flex items-center justify-between gap-3">
                  <span>
                    {item.label}
                    <span className="ml-2 rounded-full bg-slate-100 px-2 py-0.5 text-[10px] uppercase tracking-wide text-slate-500 dark:bg-slate-800">
                      {item.kind}
                    </span>
                  </span>
                  <span className="font-medium">
                    {item.quantity && item.unitPrice ? `${item.quantity} x ${item.unitPrice.toFixed(2)} = ` : ""}
                    {item.amount.toFixed(2)}
                  </span>
                </li>
              ))}
            </ul>
          </div>
        ) : null}
      </div>

      <label className="block text-sm font-medium">
        Notater
        <textarea value={notes} onChange={(e) => setNotes(e.target.value)} className="mt-2 w-full rounded-xl border border-slate-300 px-3 py-2 dark:border-slate-700 dark:bg-slate-950" rows={4} placeholder="Valgfritt: usikker strekkode, manglende vare, osv." />
      </label>

      <div className="flex items-center gap-3">
        <button type="submit" disabled={isSaving || !imageDataUrl} className="rounded-xl bg-emerald-600 px-4 py-2 font-medium text-white disabled:opacity-50">
          {isSaving ? "Sender..." : "Send til validering"}
        </button>
        <p className="text-xs text-slate-500 dark:text-slate-400">
          OCR-forslag kan fortsatt overstyres manuelt før innsending.
        </p>
        {message ? <p className="text-sm text-slate-600 dark:text-slate-300">{message}</p> : null}
      </div>
    </form>
  );
}
