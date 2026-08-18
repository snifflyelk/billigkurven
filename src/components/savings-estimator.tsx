"use client";

import { trackEvent } from "@/lib/client-event";
import { useEffect, useMemo, useState } from "react";
import { TrackedLink } from "@/components/tracked-link";

type HouseholdType = "student" | "singel" | "par" | "familie";

const householdMultipliers: Record<HouseholdType, number> = {
  student: 0.75,
  singel: 0.9,
  par: 1,
  familie: 1.35,
};

const householdLabels: Record<HouseholdType, string> = {
  student: "Student",
  singel: "Singel",
  par: "Par",
  familie: "Småbarnsfamilie",
};

export function SavingsEstimator() {
  const [postalCode, setPostalCode] = useState("0580");
  const [household, setHousehold] = useState<HouseholdType>("familie");
  const [weeklyBudget, setWeeklyBudget] = useState(1800);
  const [loading, setLoading] = useState(false);
  const [estimate, setEstimate] = useState<{
    weeklySavings: number;
    monthlySavings: number;
    annualSavings: number;
    savingsRate: number;
    observedProducts: number;
    observedStores: number;
    freshnessHours: number | null;
    basis: "postal" | "national";
    lookbackDays: number;
    methodology: "median-vs-cheapest";
  } | null>(null);

  const fallbackEstimate = useMemo(() => {
    const multiplier = householdMultipliers[household];
    const baselineRate = 0.12;
    const postalPrefix = postalCode.slice(0, 1) || "0";
    const regionalBoost = postalPrefix === "0" || postalPrefix === "3" ? 1.08 : 1;
    const weeklySavings = Math.max(75, Math.round(weeklyBudget * baselineRate * multiplier * regionalBoost));
    const monthlySavings = weeklySavings * 4;
    const annualSavings = monthlySavings * 12;

    return { weeklySavings, monthlySavings, annualSavings };
  }, [household, postalCode, weeklyBudget]);

  const postalPrefix = postalCode.slice(0, 1) || "0";

  useEffect(() => {
    const controller = new AbortController();
    const query = new URLSearchParams({
      postalPrefix,
      postalCode,
      household,
      weeklyBudget: String(weeklyBudget),
    });

    setLoading(true);

    fetch(`/api/public/savings-estimate?${query.toString()}`, {
      method: "GET",
      signal: controller.signal,
      cache: "no-store",
    })
      .then(async (response) => {
        if (!response.ok) return null;
        const payload = await response.json();
        return payload as {
          weeklySavings: number;
          monthlySavings: number;
          annualSavings: number;
          savingsRate: number;
          observedProducts: number;
          observedStores: number;
          freshnessHours: number | null;
          basis: "postal" | "national";
          lookbackDays: number;
          methodology: "median-vs-cheapest";
        };
      })
      .then((payload) => {
        if (!payload) return;
        setEstimate(payload);
        trackEvent("savings_estimator_calculated", {
          postalCode,
          postalPrefix,
          household,
          weeklyBudget,
          basis: payload.basis,
          observedProducts: payload.observedProducts,
        });
      })
      .catch(() => {
        setEstimate(null);
      })
      .finally(() => {
        setLoading(false);
      });

    return () => controller.abort();
  }, [postalCode, postalPrefix, household, weeklyBudget]);

  const compareHref = `/compare?postalPrefix=${postalPrefix}`;
  const onboardingHref = `/login?next=/account`;
  const resolvedEstimate = estimate ?? fallbackEstimate;

  return (
    <section className="rounded-3xl border border-orange-200 bg-gradient-to-br from-orange-50 via-white to-emerald-50 p-5 shadow-sm dark:border-orange-900 dark:from-orange-950/20 dark:via-slate-950 dark:to-emerald-950/20 md:p-6">
      <div className="grid gap-5 lg:grid-cols-[1.1fr_0.9fr] lg:items-start">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.14em] text-orange-700 dark:text-orange-300">60-sekunders spareestimat</p>
          <h2 className="mt-2 text-3xl font-bold tracking-tight text-slate-900 dark:text-slate-100">Hvor mye kan du spare hver måned?</h2>
          <p className="mt-2 text-sm text-slate-600 dark:text-slate-300">
            Velg område, husholdning og cirka matbudsjett. Du får et konkret estimat og kan gå rett til anbefalt butikkvalg.
          </p>

          <div className="mt-4 grid gap-3 sm:grid-cols-2">
            <label className="text-sm font-medium text-slate-700 dark:text-slate-200">
              Postnummer (4 siffer)
              <input
                value={postalCode}
                onChange={(event) => {
                  const digits = event.target.value.replace(/\D/g, "").slice(0, 4);
                  setPostalCode(digits);
                }}
                inputMode="numeric"
                placeholder="f.eks. 0580"
                className="mt-1.5 w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-900"
              />
              <span className="mt-1 block text-xs text-slate-500 dark:text-slate-400">Vi bruker forste siffer automatisk for regionalt estimat (na: {postalPrefix}xxx).</span>
            </label>

            <label className="text-sm font-medium text-slate-700 dark:text-slate-200">
              Husholdning
              <select
                value={household}
                onChange={(event) => setHousehold(event.target.value as HouseholdType)}
                className="mt-1.5 w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-900"
              >
                {Object.entries(householdLabels).map(([value, label]) => (
                  <option key={value} value={value}>
                    {label}
                  </option>
                ))}
              </select>
            </label>
          </div>

          <label className="mt-3 block text-sm font-medium text-slate-700 dark:text-slate-200">
            Ukentlig matbudsjett: {weeklyBudget} kr
            <input
              type="range"
              min={700}
              max={4200}
              step={50}
              value={weeklyBudget}
              onChange={(event) => setWeeklyBudget(Number(event.target.value))}
              className="mt-2 w-full"
            />
          </label>

          <p className="mt-3 text-xs font-medium text-slate-500 dark:text-slate-400">Typisk bruker sparer 845 kr/mnd.</p>
        </div>

        <div className="rounded-2xl border border-emerald-200 bg-white/90 p-5 dark:border-emerald-900 dark:bg-slate-900/80">
          <p className="text-xs uppercase tracking-wide text-slate-500 dark:text-slate-400">Ditt estimat</p>
          <p className="mt-2 text-3xl font-bold text-emerald-700 dark:text-emerald-300">{resolvedEstimate.monthlySavings} kr/mnd</p>
          <p className="mt-1 text-sm text-slate-600 dark:text-slate-300">Ca {resolvedEstimate.weeklySavings} kr per uke · {resolvedEstimate.annualSavings.toLocaleString("nb-NO")} kr per år</p>

          <div className="mt-4 space-y-2 text-sm text-slate-600 dark:text-slate-300">
            {estimate ? (
              <p>
                Basert på siste {estimate.lookbackDays} dager: {estimate.observedProducts} varer i {estimate.observedStores} butikker ({estimate.basis === "postal" ? "lokalt" : "nasjonalt"} grunnlag), estimert rate {estimate.savingsRate}%.
              </p>
            ) : (
              <p>Basert på husholdningstype, budsjett og lokal prisvariasjon i valgt postområde.</p>
            )}
            <p className="text-xs text-slate-500 dark:text-slate-400">
              {loading ? "Oppdaterer estimat fra ferske prisdata..." : estimate?.freshnessHours !== null ? `Siste observasjon ca ${estimate?.freshnessHours} t siden.` : "Estimater blir mer presise når du legger til faste varer i onboarding."}
            </p>
          </div>

          <div className="mt-5 flex flex-wrap gap-2">
            <TrackedLink
              href={compareHref}
              eventName="savings_estimator_compare_clicked"
              eventProps={{ postalCode, postalPrefix, household, weeklyBudget }}
              className="rounded-xl bg-orange-500 px-4 py-2 text-sm font-semibold text-white hover:bg-orange-400"
            >
              Se anbefaling i mitt område
            </TrackedLink>
            <TrackedLink
              href={onboardingHref}
              eventName="savings_estimator_onboarding_clicked"
              eventProps={{ postalCode, postalPrefix, household, weeklyBudget }}
              className="rounded-xl border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:text-slate-200 dark:hover:bg-slate-800"
            >
              Gjør estimatet personlig
            </TrackedLink>
          </div>
        </div>
      </div>
    </section>
  );
}
