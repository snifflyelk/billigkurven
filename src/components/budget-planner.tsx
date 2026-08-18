"use client";

import { useMemo, useState } from "react";
import { useToast } from "@/components/providers/toast-provider";
import { apiRequest, toUserErrorMessage } from "@/lib/api-client";
import { formatNok } from "@/lib/utils";

type SubstitutionSuggestion = {
  currentProductName: string;
  suggestedProductName: string;
  category: string;
  estimatedSavings: number;
  confidence: "hoy" | "medium";
  reason: string;
};

export function BudgetPlanner({
  userId,
  primaryStore,
  priceSensitivity,
  initialTripBudget,
  initialWeeklyBudget,
  initialUseMembershipPricing,
  recommendedSpend,
  expensiveSpend,
  estimatedSavings,
  verifiedHistoricalSavings,
  reviewedReceipts,
  substitutionSuggestions,
}: {
  userId: string;
  primaryStore: string;
  priceSensitivity: number;
  initialTripBudget: number | null;
  initialWeeklyBudget: number | null;
  initialUseMembershipPricing: boolean;
  recommendedSpend: number;
  expensiveSpend: number;
  estimatedSavings: number;
  verifiedHistoricalSavings: number;
  reviewedReceipts: number;
  substitutionSuggestions: SubstitutionSuggestion[];
}) {
  const { showToast } = useToast();
  const [budget, setBudget] = useState<number>(initialTripBudget ?? Math.max(250, Math.round(recommendedSpend + 75)));
  const [weeklyBudget, setWeeklyBudget] = useState<number>(initialWeeklyBudget ?? Math.max(500, Math.round(recommendedSpend * 1.5 + 120)));
  const [useMembershipPricing, setUseMembershipPricing] = useState(initialUseMembershipPricing);
  const [saving, setSaving] = useState(false);
  const substitutionPotential = useMemo(
    () => substitutionSuggestions.reduce((sum, suggestion) => sum + suggestion.estimatedSavings, 0),
    [substitutionSuggestions],
  );

  const gapToBudget = Number((budget - recommendedSpend).toFixed(2));
  const gapWithSubstitutions = Number((budget - Math.max(0, recommendedSpend - substitutionPotential)).toFixed(2));
  const weeklyProjectedSpend = Number((recommendedSpend * 1.5).toFixed(2));
  const weeklyProjectedSavings = Number(((estimatedSavings + substitutionPotential) * 1.4).toFixed(2));
  const weeklyGap = Number((weeklyBudget - weeklyProjectedSpend).toFixed(2));

  async function saveBudgetPreferences() {
    setSaving(true);
    try {
      await apiRequest<{ preferences: unknown }>("/api/user/preferences", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          userId,
          primaryStore,
          priceSensitivity,
          useMembershipPricing,
          shoppingTripBudget: budget,
          weeklyGroceryBudget: weeklyBudget,
        }),
      });
      showToast({
        title: "Budsjett lagret",
        description: "Billigkurven husker nå budsjettet ditt for senere handlelister.",
        type: "success",
      });
    } catch (error) {
      showToast({
        title: "Kunne ikke lagre budsjett",
        description: toUserErrorMessage(error),
        type: "error",
      });
    } finally {
      setSaving(false);
    }
  }

  return (
    <section className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wide text-cyan-700 dark:text-cyan-300">Budsjettmodus og ukesrapport</p>
          <h2 className="mt-1 text-2xl font-bold tracking-tight">Hold handlelisten innenfor en ramme</h2>
          <p className="mt-2 max-w-2xl text-sm text-slate-600 dark:text-slate-300">
            Velg et budsjett for denne turen. Vi viser om anbefalt plan holder seg innenfor rammen og hvor mye substitusjoner kan hjelpe.
          </p>
        </div>
        <div className="rounded-2xl border border-emerald-200 bg-emerald-50/80 p-4 dark:border-emerald-900 dark:bg-emerald-950/25">
          <p className="text-xs uppercase tracking-wide text-emerald-700 dark:text-emerald-300">Verifisert historisk sparing</p>
          <p className="mt-1 text-2xl font-semibold text-emerald-900 dark:text-emerald-100">{formatNok(verifiedHistoricalSavings)}</p>
          <p className="mt-1 text-xs text-emerald-800/80 dark:text-emerald-200/80">Basert på {reviewedReceipts} godkjente kvitteringer.</p>
        </div>
      </div>

      <div className="mt-5 grid gap-4 lg:grid-cols-[1.15fr_0.85fr]">
        <div className="rounded-2xl border border-slate-200 bg-slate-50/80 p-4 dark:border-slate-800 dark:bg-slate-950/50">
          <label className="text-sm font-medium text-slate-700 dark:text-slate-200">Budsjett for denne handlelisten</label>
          <input
            type="number"
            min={0}
            step={10}
            value={budget}
            onChange={(event) => setBudget(Number(event.target.value) || 0)}
            className="mt-2 w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-900"
          />
          <label className="mt-4 block text-sm font-medium text-slate-700 dark:text-slate-200">Ukentlig matbudsjett</label>
          <input
            type="number"
            min={0}
            step={10}
            value={weeklyBudget}
            onChange={(event) => setWeeklyBudget(Number(event.target.value) || 0)}
            className="mt-2 w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-900"
          />

          <div className="mt-4 grid gap-3 sm:grid-cols-3">
            <article className="rounded-2xl border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900">
              <p className="text-xs uppercase tracking-wide text-slate-500">Anbefalt plan</p>
              <p className="mt-1 text-xl font-semibold">{formatNok(recommendedSpend)}</p>
            </article>
            <article className="rounded-2xl border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900">
              <p className="text-xs uppercase tracking-wide text-slate-500">Dyreste plan</p>
              <p className="mt-1 text-xl font-semibold">{formatNok(expensiveSpend)}</p>
            </article>
            <article className="rounded-2xl border border-cyan-200 bg-cyan-50/80 p-4 dark:border-cyan-900 dark:bg-cyan-950/25">
              <p className="text-xs uppercase tracking-wide text-cyan-700 dark:text-cyan-300">Substitusjonspotensial</p>
              <p className="mt-1 text-xl font-semibold text-cyan-900 dark:text-cyan-100">{formatNok(substitutionPotential)}</p>
            </article>
          </div>

          <label className="mt-4 flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm dark:border-slate-800 dark:bg-slate-900">
            <input type="checkbox" checked={useMembershipPricing} onChange={(event) => setUseMembershipPricing(event.target.checked)} />
            Bruk medlemspriser i sammenligningen (når tilgjengelig)
          </label>

          <div className={`mt-4 rounded-2xl border p-4 text-sm ${gapToBudget >= 0 ? "border-emerald-200 bg-emerald-50/80 text-emerald-900 dark:border-emerald-900 dark:bg-emerald-950/25 dark:text-emerald-100" : "border-rose-200 bg-rose-50/80 text-rose-900 dark:border-rose-900 dark:bg-rose-950/25 dark:text-rose-100"}`}>
            {gapToBudget >= 0
              ? `Anbefalt plan ligger ${formatNok(gapToBudget)} under budsjettet ditt.`
              : `Anbefalt plan ligger ${formatNok(Math.abs(gapToBudget))} over budsjettet ditt.`}
            <p className="mt-1 text-xs opacity-80">
              {gapWithSubstitutions >= 0
                ? `Med foreslåtte bytter kan du ligge omtrent ${formatNok(gapWithSubstitutions)} under budsjettet.`
                : `Selv med foreslåtte bytter mangler du omtrent ${formatNok(Math.abs(gapWithSubstitutions))}.`}
            </p>
          </div>

          <button
            type="button"
            onClick={saveBudgetPreferences}
            disabled={saving}
            className="mt-4 rounded-xl bg-cyan-600 px-4 py-2 text-sm font-medium text-white hover:bg-cyan-500 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {saving ? "Lagrer…" : "Lagre budsjett som preferanse"}
          </button>
        </div>

        <div className="space-y-4">
          <div className="rounded-2xl border border-amber-200 bg-amber-50/80 p-4 dark:border-amber-900 dark:bg-amber-950/25">
            <p className="text-xs uppercase tracking-wide text-amber-700 dark:text-amber-300">Ukesrapport</p>
            <p className="mt-1 text-2xl font-semibold text-amber-900 dark:text-amber-100">{formatNok(weeklyProjectedSavings)}</p>
            <p className="mt-1 text-sm text-amber-900/90 dark:text-amber-100/90">Potensiell ukesparing hvis denne typen handleliste gjentas omtrent 1,5 ganger per uke.</p>
          </div>
          <div className="rounded-2xl border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900">
            <p className="text-xs uppercase tracking-wide text-slate-500">Estimert ukesforbruk</p>
            <p className="mt-1 text-2xl font-semibold">{formatNok(weeklyProjectedSpend)}</p>
            <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">Basert på billigste observerte handleplan akkurat nå.</p>
          </div>
          <div className="rounded-2xl border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900">
            <p className="text-xs uppercase tracking-wide text-slate-500">Ukentlig budsjettstatus</p>
            <p className="mt-1 text-2xl font-semibold">{weeklyGap >= 0 ? formatNok(weeklyGap) : `-${formatNok(Math.abs(weeklyGap))}`}</p>
            <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">{weeklyGap >= 0 ? "Du ligger under ukesbudsjettet." : "Du ligger over ukesbudsjettet."}</p>
          </div>
        </div>
      </div>
    </section>
  );
}