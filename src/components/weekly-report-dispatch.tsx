"use client";

import { useState } from "react";

type Props = {
  selectedChain: string | null;
};

export function WeeklyReportDispatch({ selectedChain }: Props) {
  const [isSendingEmail, setIsSendingEmail] = useState(false);
  const [isSendingPush, setIsSendingPush] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  async function send(channel: "email" | "push") {
    const setter = channel === "email" ? setIsSendingEmail : setIsSendingPush;
    setter(true);
    setMessage(null);

    try {
      const response = await fetch("/api/savings/weekly-report/send", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ channel, chain: selectedChain }),
      });
      const payload = (await response.json().catch(() => ({}))) as { fallback?: boolean; error?: string; hint?: string };

      if (!response.ok) {
        setMessage(payload.error ?? payload.hint ?? "Kunne ikke sende rapport.");
        return;
      }

      setMessage(
        payload.fallback
          ? channel === "email"
            ? "Epost sendt til logg-fallback (SMTP ikke konfigurert)."
            : "Push sendt til logg-fallback."
          : channel === "email"
            ? "Ukentlig rapport sendt pa epost."
            : "Push-varsling sendt.",
      );
    } catch {
      setMessage("Nettverksfeil ved sending av rapport.");
    } finally {
      setter(false);
    }
  }

  return (
    <div className="mt-6 rounded-2xl border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900">
      <p className="text-sm font-medium">Utsendelse</p>
      <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
        Send denne rapporten na pa epost eller push. Kjede-filter brukes i utsendelsen.
      </p>
      <div className="mt-3 flex flex-wrap gap-2">
        <button
          type="button"
          onClick={() => void send("email")}
          disabled={isSendingEmail || isSendingPush}
          className="rounded-xl bg-emerald-600 px-3.5 py-2 text-sm font-medium text-white hover:bg-emerald-500 disabled:cursor-not-allowed disabled:opacity-60"
        >
          {isSendingEmail ? "Sender epost..." : "Send epost na"}
        </button>
        <button
          type="button"
          onClick={() => void send("push")}
          disabled={isSendingEmail || isSendingPush}
          className="rounded-xl border border-cyan-300 px-3.5 py-2 text-sm font-medium text-cyan-800 hover:bg-cyan-50 disabled:cursor-not-allowed disabled:opacity-60 dark:border-cyan-800 dark:text-cyan-200 dark:hover:bg-cyan-950/30"
        >
          {isSendingPush ? "Sender push..." : "Send push na"}
        </button>
      </div>
      {message ? <p className="mt-3 text-xs text-slate-600 dark:text-slate-300">{message}</p> : null}
    </div>
  );
}
