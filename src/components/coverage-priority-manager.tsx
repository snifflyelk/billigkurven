"use client";

import { useState } from "react";
import { useToast } from "@/components/providers/toast-provider";
import { apiRequest, toUserErrorMessage } from "@/lib/api-client";

type PriorityItem = {
  id?: string;
  scopeType: "CHAIN" | "POSTAL_CODE";
  scopeKey: string;
  title: string;
  status: "OPEN" | "IN_PROGRESS" | "BLOCKED" | "RESOLVED";
  owner: string;
  notes: string;
  coverageRatio: number;
  lastActionType?: string | null;
  lastActionAt?: string | null;
  lastActionSummary?: string | null;
};

export function CoveragePriorityManager({ initialItems }: { initialItems: PriorityItem[] }) {
  const { showToast } = useToast();
  const [items, setItems] = useState(initialItems);
  const [savingKey, setSavingKey] = useState<string | null>(null);

  async function saveItem(item: PriorityItem) {
    const key = `${item.scopeType}:${item.scopeKey}`;
    setSavingKey(key);
    try {
      if (item.id) {
        await apiRequest(`/api/admin/coverage-priorities?id=${item.id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ status: item.status, owner: item.owner, notes: item.notes }),
        });
      } else {
        const result = await apiRequest<{ priority: { id: string } }>("/api/admin/coverage-priorities", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            scopeType: item.scopeType,
            scopeKey: item.scopeKey,
            title: item.title,
            status: item.status,
            owner: item.owner,
            notes: item.notes,
          }),
        });

        setItems((current) => current.map((entry) => (entry.scopeType === item.scopeType && entry.scopeKey === item.scopeKey ? { ...entry, id: result.priority.id } : entry)));
      }

      showToast({ title: "Prioritet lagret", type: "success" });
    } catch (error) {
      showToast({ title: "Kunne ikke lagre prioritet", description: toUserErrorMessage(error), type: "error" });
    } finally {
      setSavingKey(null);
    }
  }

  async function runSyncForItem(item: PriorityItem) {
    if (!item.id) {
      showToast({ title: "Lagre prioriteten først", description: "Opprett prioriteten før du logger sync-kjoring.", type: "info" });
      return;
    }

    const key = `${item.scopeType}:${item.scopeKey}:sync`;
    setSavingKey(key);
    try {
      const result = await apiRequest<{ priority: { lastActionType: string | null; lastActionAt: string | null; lastActionSummary: string | null } }>(`/api/admin/coverage-priorities?id=${item.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "run-sync" }),
      });

      setItems((current) => current.map((entry) => (
        entry.id === item.id
          ? {
              ...entry,
              lastActionType: result.priority.lastActionType,
              lastActionAt: result.priority.lastActionAt,
              lastActionSummary: result.priority.lastActionSummary,
            }
          : entry
      )));
      showToast({ title: "Sync kjort", description: result.priority.lastActionSummary ?? "Prissynk ble logget.", type: "success" });
    } catch (error) {
      showToast({ title: "Sync feilet", description: toUserErrorMessage(error), type: "error" });
    } finally {
      setSavingKey(null);
    }
  }

  return (
    <section className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="text-xl font-semibold">Arbeidskø for dekning</h2>
        <span className="text-xs text-slate-500 dark:text-slate-400">Sett status, eier og notat per område</span>
      </div>
      <div className="mt-4 space-y-4">
        {items.map((item, index) => {
          const key = `${item.scopeType}:${item.scopeKey}`;
          const saving = savingKey === key || savingKey === `${key}:sync`;

          return (
            <article key={key} className="rounded-2xl border border-slate-200 p-4 dark:border-slate-800">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <p className="text-xs uppercase tracking-wide text-slate-500">{item.scopeType === "CHAIN" ? "Kjede" : "Postnummer"}</p>
                  <h3 className="mt-1 font-semibold">{item.title}</h3>
                  <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">Dekning: {Math.round(item.coverageRatio * 100)}%</p>
                </div>
                <select
                  value={item.status}
                  onChange={(event) => setItems((current) => current.map((entry, itemIndex) => (itemIndex === index ? { ...entry, status: event.target.value as PriorityItem["status"] } : entry)))}
                  className="rounded-xl border border-slate-300 px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-950"
                >
                  <option value="OPEN">Open</option>
                  <option value="IN_PROGRESS">In progress</option>
                  <option value="BLOCKED">Blocked</option>
                  <option value="RESOLVED">Resolved</option>
                </select>
              </div>
              <div className="mt-3 grid gap-3 md:grid-cols-[0.8fr_1.2fr]">
                <input
                  value={item.owner}
                  onChange={(event) => setItems((current) => current.map((entry, itemIndex) => (itemIndex === index ? { ...entry, owner: event.target.value } : entry)))}
                  placeholder="Eier eller ansvarlig"
                  className="rounded-xl border border-slate-300 px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-950"
                />
                <textarea
                  value={item.notes}
                  onChange={(event) => setItems((current) => current.map((entry, itemIndex) => (itemIndex === index ? { ...entry, notes: event.target.value } : entry)))}
                  placeholder="Neste steg, blokkere eller observasjoner"
                  rows={3}
                  className="rounded-xl border border-slate-300 px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-950"
                />
              </div>
              {item.lastActionAt || item.lastActionSummary ? (
                <div className="mt-3 rounded-xl border border-slate-200 bg-slate-50/80 p-3 text-xs text-slate-600 dark:border-slate-800 dark:bg-slate-950/50 dark:text-slate-300">
                  <p className="font-medium">Siste operative handling</p>
                  <p className="mt-1">{item.lastActionSummary ?? "Ingen oppsummering registrert."}</p>
                  <p className="mt-1 text-slate-500 dark:text-slate-400">{item.lastActionAt ? new Date(item.lastActionAt).toLocaleString("no-NO") : "Ingen tidspunkt registrert"}</p>
                </div>
              ) : null}
              <div className="mt-3 flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={() => saveItem(item)}
                  disabled={saving}
                  className="rounded-xl bg-emerald-600 px-4 py-2 text-sm font-medium text-white hover:bg-emerald-500 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {savingKey === key ? "Lagrer…" : "Lagre oppfølging"}
                </button>
                <button
                  type="button"
                  onClick={() => runSyncForItem(item)}
                  disabled={saving}
                  className="rounded-xl border border-cyan-300 px-4 py-2 text-sm font-medium text-cyan-800 hover:bg-cyan-50 disabled:cursor-not-allowed disabled:opacity-60 dark:border-cyan-800 dark:text-cyan-200 dark:hover:bg-cyan-950/40"
                >
                  {savingKey === `${key}:sync` ? "Kjorer sync…" : "Kjor prissync og logg"}
                </button>
              </div>
            </article>
          );
        })}
      </div>
    </section>
  );
}