"use client";

import { useMemo, useState } from "react";
import { trackEvent } from "@/lib/client-event";

type ShareSavingsCardProps = {
  monthLabel: string;
  verifiedSavingsLabel: string;
  confidenceRatioLabel: string;
};

export function ShareSavingsCard({
  monthLabel,
  verifiedSavingsLabel,
  confidenceRatioLabel,
}: ShareSavingsCardProps) {
  const [copied, setCopied] = useState(false);

  const shareText = useMemo(
    () =>
      `Jeg har dokumentert ${verifiedSavingsLabel} spart i ${monthLabel} med Billigkurven. Høy confidence-andel: ${confidenceRatioLabel}.`,
    [confidenceRatioLabel, monthLabel, verifiedSavingsLabel],
  );

  async function handleShare() {
    trackEvent("savings_share_clicked", { channel: "native" });

    if (typeof navigator !== "undefined" && navigator.share) {
      try {
        await navigator.share({
          title: "Sparebevis fra Billigkurven",
          text: shareText,
          url: window.location.origin,
        });
        return;
      } catch {
      }
    }

    await handleCopy();
  }

  async function handleCopy() {
    try {
      await navigator.clipboard.writeText(shareText);
      setCopied(true);
      trackEvent("savings_share_clicked", { channel: "copy" });
      setTimeout(() => setCopied(false), 2000);
    } catch {
      setCopied(false);
    }
  }

  return (
    <section className="rounded-3xl border border-cyan-200 bg-cyan-50/80 p-4 dark:border-cyan-900 dark:bg-cyan-950/25">
      <p className="text-xs font-semibold uppercase tracking-wide text-cyan-700 dark:text-cyan-300">Delbar sparekvittering</p>
      <p className="mt-1 text-sm text-cyan-900 dark:text-cyan-100">
        Del dokumentert sparing med familie eller venner for sosial accountability.
      </p>
      <div className="mt-3 flex flex-wrap gap-2">
        <button
          type="button"
          onClick={handleShare}
          className="rounded-xl bg-cyan-700 px-3 py-2 text-sm font-semibold text-white hover:bg-cyan-600 dark:bg-cyan-400 dark:text-cyan-950 dark:hover:bg-cyan-300"
        >
          Del sparebevis
        </button>
        <button
          type="button"
          onClick={handleCopy}
          className="rounded-xl border border-cyan-300 px-3 py-2 text-sm font-semibold text-cyan-900 hover:bg-cyan-100 dark:border-cyan-800 dark:text-cyan-200 dark:hover:bg-cyan-900/40"
        >
          {copied ? "Kopiert" : "Kopier tekst"}
        </button>
      </div>
    </section>
  );
}
