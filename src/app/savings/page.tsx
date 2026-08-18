import Link from "next/link";
import { SavingsHistoryChart } from "@/components/savings-history-chart";
import { ShareSavingsCard } from "@/components/share-savings-card";
import { compareShoppingList } from "@/lib/compare";
import { prisma } from "@/lib/prisma";
import { requireAuthenticatedSessionUserId } from "@/lib/user-session";
import { formatNok } from "@/lib/utils";

export const dynamic = "force-dynamic";

export default async function SavingsPage() {
  const currentUserId = await requireAuthenticatedSessionUserId("/savings");
  const user = await prisma.user.findUnique({
    where: { id: currentUserId },
    include: {
      preference: true,
      receipts: {
        where: { status: "REVIEWED" },
        orderBy: { createdAt: "desc" },
        take: 12,
      },
      shoppingLists: {
        orderBy: { createdAt: "desc" },
        take: 1,
      },
    },
  });

  if (!user) {
    return (
      <main className="mx-auto max-w-5xl px-4 py-10">
        <h1 className="text-3xl font-bold tracking-tight">Sparehistorikk</h1>
        <p className="mt-3 text-slate-600 dark:text-slate-300">Ingen bruker funnet ennå. Kjør onboarding først.</p>
      </main>
    );
  }

  const latestShoppingList = user.shoppingLists[0] ?? null;
  const latestPlan = latestShoppingList ? await compareShoppingList(latestShoppingList.id) : null;
  const verifiedSavingsTotal = Number(
    user.receipts.reduce((sum, receipt) => sum + Number(receipt.verifiedSavings ?? 0), 0).toFixed(2),
  );
  const monthlyProjection = Number((verifiedSavingsTotal + (latestPlan?.estimatedSavings ?? 0) * 3.2).toFixed(2));
  const averageReceiptSavings = user.receipts.length > 0 ? Number((verifiedSavingsTotal / user.receipts.length).toFixed(2)) : 0;
  const weeklyBudget = user.preference?.weeklyGroceryBudget ?? null;
  const weeklyProjectedSpend = latestPlan?.cheapestStore ? Number((latestPlan.cheapestStore.totalPrice * 1.5).toFixed(2)) : null;
  const matchedItemsTotal = user.receipts.reduce((sum, receipt) => sum + Number(receipt.matchedItems ?? 0), 0);
  const totalItemsObserved = user.receipts.reduce((sum, receipt) => sum + Number(receipt.totalItems ?? 0), 0);
  const verificationAccuracyPct = totalItemsObserved > 0 ? Number(((matchedItemsTotal / totalItemsObserved) * 100).toFixed(1)) : null;
  const confidenceBreakdown = user.receipts.reduce(
    (accumulator, receipt) => {
      const tone = String(receipt.savingsConfidence ?? "ukjent").toLowerCase();
      if (tone.includes("høy")) accumulator.high += 1;
      else if (tone.includes("medium")) accumulator.medium += 1;
      else accumulator.low += 1;
      return accumulator;
    },
    { high: 0, medium: 0, low: 0 },
  );

  const now = Date.now();
  const sevenDaysAgo = new Date(now - 7 * 24 * 60 * 60 * 1000);
  const fourteenDaysAgo = new Date(now - 14 * 24 * 60 * 60 * 1000);
  const last7Savings = user.receipts
    .filter((receipt) => receipt.createdAt >= sevenDaysAgo)
    .reduce((sum, receipt) => sum + Number(receipt.verifiedSavings ?? 0), 0);
  const previous7Savings = user.receipts
    .filter((receipt) => receipt.createdAt >= fourteenDaysAgo && receipt.createdAt < sevenDaysAgo)
    .reduce((sum, receipt) => sum + Number(receipt.verifiedSavings ?? 0), 0);
  const weeklyTrendDelta = Number((last7Savings - previous7Savings).toFixed(2));
  const monthStart = new Date();
  monthStart.setDate(1);
  monthStart.setHours(0, 0, 0, 0);
  const monthReceipts = user.receipts.filter((receipt) => receipt.createdAt >= monthStart);
  const monthVerifiedSavings = Number(
    monthReceipts.reduce((sum, receipt) => sum + Number(receipt.verifiedSavings ?? 0), 0).toFixed(2),
  );
  const monthHighConfidence = monthReceipts.filter((receipt) => String(receipt.savingsConfidence ?? "").toLowerCase().includes("høy")).length;
  const monthConfidenceRatio =
    monthReceipts.length > 0 ? Math.round((monthHighConfidence / monthReceipts.length) * 100) : null;
  const receiptSeries = user.receipts
    .slice()
    .reverse()
    .map((receipt) => ({
      date: receipt.createdAt,
      receiptSavings: Number(receipt.verifiedSavings ?? 0),
    }));

  const weeklyMap = new Map<string, number>();
  const monthlyMap = new Map<string, number>();
  for (const item of receiptSeries) {
    const date = item.date;
    const day = (date.getDay() + 6) % 7;
    const weekStart = new Date(date);
    weekStart.setDate(date.getDate() - day);
    weekStart.setHours(0, 0, 0, 0);
    const weekKey = weekStart.toISOString();
    weeklyMap.set(weekKey, Number(((weeklyMap.get(weekKey) ?? 0) + item.receiptSavings).toFixed(2)));

    const monthKey = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
    monthlyMap.set(monthKey, Number(((monthlyMap.get(monthKey) ?? 0) + item.receiptSavings).toFixed(2)));
  }

  const weeklyChartData = Array.from(weeklyMap.entries())
    .sort((left, right) => left[0].localeCompare(right[0]))
    .reduce<Array<{ date: string; receiptSavings: number; cumulativeSavings: number }>>((accumulator, [date, receiptSavings]) => {
      const previous = accumulator[accumulator.length - 1]?.cumulativeSavings ?? 0;
      accumulator.push({
        date,
        receiptSavings,
        cumulativeSavings: Number((previous + receiptSavings).toFixed(2)),
      });
      return accumulator;
    }, []);

  const monthlyChartData = Array.from(monthlyMap.entries())
    .sort((left, right) => left[0].localeCompare(right[0]))
    .reduce<Array<{ date: string; receiptSavings: number; cumulativeSavings: number }>>((accumulator, [date, receiptSavings]) => {
      const previous = accumulator[accumulator.length - 1]?.cumulativeSavings ?? 0;
      accumulator.push({
        date,
        receiptSavings,
        cumulativeSavings: Number((previous + receiptSavings).toFixed(2)),
      });
      return accumulator;
    }, []);

  const weeklyParticipation = Math.min(100, Math.round((weeklyChartData.length / 8) * 100));
  const weeklyHabitTone =
    weeklyParticipation >= 75
      ? "Sterk vane"
      : weeklyParticipation >= 45
        ? "Bygger vane"
        : "Ustabil vane";
  const monthLabel = monthStart.toLocaleDateString("nb-NO", { month: "long", year: "numeric" });
  const confidenceShareLabel = monthConfidenceRatio !== null ? `${monthConfidenceRatio}%` : "ikke nok data";

  return (
    <main className="mx-auto max-w-6xl px-4 py-10 pb-16">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Personlig sparehistorikk</h1>
          <p className="mt-2 max-w-3xl text-slate-600 dark:text-slate-300">
            Her ser du bekreftet sparing fra kvitteringer, dagens prosjektverdi og hvordan det matcher budsjettet ditt over tid.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Link href="/shopping-list" className="rounded-xl border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:text-slate-200 dark:hover:bg-slate-800">
            Til handleliste
          </Link>
          <Link href="/savings/proof" className="rounded-xl border border-emerald-300 px-4 py-2 text-sm font-medium text-emerald-800 hover:bg-emerald-50 dark:border-emerald-800 dark:text-emerald-200 dark:hover:bg-emerald-950/40">
            Sparebevis (PDF)
          </Link>
          <Link href="/savings/weekly-report" className="rounded-xl border border-cyan-300 px-4 py-2 text-sm font-medium text-cyan-800 hover:bg-cyan-50 dark:border-cyan-800 dark:text-cyan-200 dark:hover:bg-cyan-950/40">
            Ukentlig rapport
          </Link>
          <Link href="/receipts" className="rounded-xl bg-emerald-600 px-4 py-2 text-sm font-medium text-white hover:bg-emerald-500">
            Last opp kvittering
          </Link>
        </div>
      </div>

      <section className="mt-6 grid gap-4 md:grid-cols-4">
        <article className="rounded-2xl border border-emerald-200 bg-emerald-50/80 p-4 dark:border-emerald-900 dark:bg-emerald-950/25">
          <p className="text-xs uppercase tracking-wide text-emerald-700 dark:text-emerald-300">Verifisert spart</p>
          <p className="mt-1 text-3xl font-semibold text-emerald-900 dark:text-emerald-100">{formatNok(verifiedSavingsTotal)}</p>
        </article>
        <article className="rounded-2xl border border-cyan-200 bg-cyan-50/80 p-4 dark:border-cyan-900 dark:bg-cyan-950/25">
          <p className="text-xs uppercase tracking-wide text-cyan-700 dark:text-cyan-300">Månedsprojeksjon</p>
          <p className="mt-1 text-3xl font-semibold text-cyan-900 dark:text-cyan-100">{formatNok(monthlyProjection)}</p>
        </article>
        <article className="rounded-2xl border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900">
          <p className="text-xs uppercase tracking-wide text-slate-500">Snitt per kvittering</p>
          <p className="mt-1 text-3xl font-semibold">{formatNok(averageReceiptSavings)}</p>
        </article>
        <article className="rounded-2xl border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900">
          <p className="text-xs uppercase tracking-wide text-slate-500">Godkjente kvitteringer</p>
          <p className="mt-1 text-3xl font-semibold">{user.receipts.length}</p>
        </article>
      </section>

      <section className="mt-4 grid gap-4 md:grid-cols-3">
        <article className="rounded-2xl border border-indigo-200 bg-indigo-50/80 p-4 dark:border-indigo-900 dark:bg-indigo-950/25">
          <p className="text-xs uppercase tracking-wide text-indigo-700 dark:text-indigo-300">Verifisert treffsikkerhet</p>
          <p className="mt-1 text-2xl font-semibold text-indigo-900 dark:text-indigo-100">
            {verificationAccuracyPct !== null ? `${verificationAccuracyPct}%` : "Ikke klart"}
          </p>
          <p className="mt-1 text-xs text-indigo-800/80 dark:text-indigo-200/80">Matcher {matchedItemsTotal}/{totalItemsObserved} kvitteringslinjer.</p>
        </article>
        <article className="rounded-2xl border border-amber-200 bg-amber-50/80 p-4 dark:border-amber-900 dark:bg-amber-950/25">
          <p className="text-xs uppercase tracking-wide text-amber-700 dark:text-amber-300">Ukestrend verifisert sparing</p>
          <p className="mt-1 text-2xl font-semibold text-amber-900 dark:text-amber-100">{weeklyTrendDelta >= 0 ? `+${formatNok(weeklyTrendDelta)}` : `-${formatNok(Math.abs(weeklyTrendDelta))}`}</p>
          <p className="mt-1 text-xs text-amber-800/80 dark:text-amber-200/80">Siste 7 dager mot forrige 7 dager.</p>
        </article>
        <article className="rounded-2xl border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900">
          <p className="text-xs uppercase tracking-wide text-slate-500">Confidence-fordeling</p>
          <p className="mt-1 text-sm font-medium">Høy: {confidenceBreakdown.high} · Medium: {confidenceBreakdown.medium} · Lav/ukjent: {confidenceBreakdown.low}</p>
          <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">Brukes for a vise hvor robust verifikasjonen faktisk er.</p>
        </article>
      </section>

      <section className="mt-4 grid gap-4 md:grid-cols-2">
        <article className="rounded-2xl border border-orange-200 bg-orange-50/80 p-4 dark:border-orange-900 dark:bg-orange-950/25">
          <p className="text-xs uppercase tracking-wide text-orange-700 dark:text-orange-300">Ukentlig vane-loop</p>
          <p className="mt-1 text-2xl font-semibold text-orange-900 dark:text-orange-100">{weeklyParticipation}%</p>
          <p className="mt-1 text-sm text-orange-900/90 dark:text-orange-100/90">
            {weeklyHabitTone}. Målet er en fast rytme: varsel til handleplan til kvittering til dokumentert sparing.
          </p>
          <div className="mt-3 flex flex-wrap gap-2">
            <Link href="/alerts" className="rounded-lg bg-orange-500 px-3 py-2 text-xs font-semibold text-white hover:bg-orange-400">
              Se ukesignal
            </Link>
            <Link href="/compare" className="rounded-lg border border-orange-300 px-3 py-2 text-xs font-semibold text-orange-900 hover:bg-orange-100 dark:border-orange-800 dark:text-orange-200 dark:hover:bg-orange-900/40">
              Oppdater handleplan
            </Link>
          </div>
        </article>

        <ShareSavingsCard
          monthLabel={monthLabel}
          verifiedSavingsLabel={formatNok(monthVerifiedSavings)}
          confidenceRatioLabel={confidenceShareLabel}
        />
      </section>

      <section className="mt-8 grid gap-6 lg:grid-cols-[1.15fr_0.85fr]">
        <article className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900">
          <h2 className="text-xl font-semibold">Budsjett mot faktisk og estimert verdi</h2>
          <div className="mt-4 grid gap-4 sm:grid-cols-2">
            <div className="rounded-2xl border border-slate-200 bg-slate-50/80 p-4 dark:border-slate-800 dark:bg-slate-950/50">
              <p className="text-xs uppercase tracking-wide text-slate-500">Lagret ukesbudsjett</p>
              <p className="mt-1 text-2xl font-semibold">{weeklyBudget !== null ? formatNok(weeklyBudget) : "Ikke satt"}</p>
            </div>
            <div className="rounded-2xl border border-slate-200 bg-slate-50/80 p-4 dark:border-slate-800 dark:bg-slate-950/50">
              <p className="text-xs uppercase tracking-wide text-slate-500">Estimert ukesforbruk nå</p>
              <p className="mt-1 text-2xl font-semibold">{weeklyProjectedSpend !== null ? formatNok(weeklyProjectedSpend) : "Ikke klart"}</p>
            </div>
          </div>
          <div className={`mt-4 rounded-2xl border p-4 text-sm ${weeklyBudget !== null && weeklyProjectedSpend !== null && weeklyProjectedSpend <= weeklyBudget ? "border-emerald-200 bg-emerald-50/80 text-emerald-900 dark:border-emerald-900 dark:bg-emerald-950/25 dark:text-emerald-100" : "border-amber-200 bg-amber-50/80 text-amber-900 dark:border-amber-900 dark:bg-amber-950/25 dark:text-amber-100"}`}>
            {weeklyBudget !== null && weeklyProjectedSpend !== null
              ? weeklyProjectedSpend <= weeklyBudget
                ? `Dagens plan ligger omtrent ${formatNok(weeklyBudget - weeklyProjectedSpend)} under ukesbudsjettet ditt.`
                : `Dagens plan ligger omtrent ${formatNok(weeklyProjectedSpend - weeklyBudget)} over ukesbudsjettet ditt.`
              : "Sett budsjett i handlelisten for å få personlig budsjettsporing her."}
          </div>
          {latestPlan ? (
            <div className="mt-4 rounded-2xl border border-slate-200 bg-slate-50/80 p-4 dark:border-slate-800 dark:bg-slate-950/50">
              <p className="text-xs uppercase tracking-wide text-slate-500">Dagens motor</p>
              <p className="mt-1 text-lg font-semibold">{latestPlan.recommendation.shouldAutoRecommend ? `Anbefaler ${latestPlan.recommendation.recommendedStore?.storeName ?? "billigste butikk"}` : "Gir foreløpig veiledning"}</p>
              <p className="mt-1 text-sm text-slate-600 dark:text-slate-300">{latestPlan.recommendation.message}</p>
            </div>
          ) : null}
        </article>

        <article className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900">
          <h2 className="text-xl font-semibold">Hva styrker tallene her</h2>
          <ul className="mt-4 space-y-3 text-sm text-slate-600 dark:text-slate-300">
            <li>Godkjente kvitteringer gir faktisk verifisert spart beløp, ikke bare modellanslag.</li>
            <li>Handlelisten gir en nå-situasjon for hvor mye du kan spare i neste tur.</li>
            <li>Lagret budsjett knytter spareverdien til det som faktisk betyr noe for husholdningen din.</li>
          </ul>
        </article>
      </section>

      <section className="mt-8 rounded-3xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 className="text-xl font-semibold">Utvikling i spart beløp</h2>
          <span className="text-xs text-slate-500 dark:text-slate-400">Fra godkjente kvitteringer</span>
        </div>
        <div className="mt-4">
          <SavingsHistoryChart weeklyData={weeklyChartData} monthlyData={monthlyChartData} />
        </div>
      </section>

      <section className="mt-8 rounded-3xl border border-emerald-200 bg-emerald-50/70 p-5 shadow-sm dark:border-emerald-900 dark:bg-emerald-950/20">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-emerald-700 dark:text-emerald-300">Maanedens sparebevis</p>
            <h2 className="mt-1 text-2xl font-bold tracking-tight text-emerald-900 dark:text-emerald-100">Dokumentert sparing denne maaneden</h2>
          </div>
          <div className="rounded-2xl border border-emerald-300 bg-white/80 px-4 py-3 text-right dark:border-emerald-800 dark:bg-emerald-950/30">
            <p className="text-xs uppercase tracking-wide text-emerald-700 dark:text-emerald-300">Verifisert spart</p>
            <p className="mt-1 text-2xl font-semibold text-emerald-900 dark:text-emerald-100">{formatNok(monthVerifiedSavings)}</p>
          </div>
        </div>

        <div className="mt-4 grid gap-3 md:grid-cols-3">
          <div className="rounded-2xl border border-emerald-200 bg-white/80 p-3 text-sm dark:border-emerald-900 dark:bg-emerald-950/25">
            <p className="text-xs uppercase tracking-wide text-emerald-700 dark:text-emerald-300">Godkjente kvitteringer</p>
            <p className="mt-1 text-lg font-semibold text-emerald-900 dark:text-emerald-100">{monthReceipts.length}</p>
          </div>
          <div className="rounded-2xl border border-emerald-200 bg-white/80 p-3 text-sm dark:border-emerald-900 dark:bg-emerald-950/25">
            <p className="text-xs uppercase tracking-wide text-emerald-700 dark:text-emerald-300">Høy confidence-andel</p>
            <p className="mt-1 text-lg font-semibold text-emerald-900 dark:text-emerald-100">{monthConfidenceRatio !== null ? `${monthConfidenceRatio}%` : "Ikke nok data"}</p>
          </div>
          <div className="rounded-2xl border border-emerald-200 bg-white/80 p-3 text-sm dark:border-emerald-900 dark:bg-emerald-950/25">
            <p className="text-xs uppercase tracking-wide text-emerald-700 dark:text-emerald-300">Verifiserte varematcher</p>
            <p className="mt-1 text-lg font-semibold text-emerald-900 dark:text-emerald-100">{matchedItemsTotal}/{totalItemsObserved}</p>
          </div>
        </div>

        <p className="mt-4 rounded-2xl border border-emerald-200 bg-white/80 p-3 text-sm text-emerald-900 dark:border-emerald-900 dark:bg-emerald-950/25 dark:text-emerald-100">
          Sparebeviset bygger på faktisk handletotal mot billigste estimerte alternativ fra samme varekurv. Jo flere godkjente kvitteringer du laster opp, desto mer robust blir verifikasjonen.
        </p>
      </section>

      <section className="mt-8 rounded-3xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 className="text-xl font-semibold">Siste verifiserte kvitteringer</h2>
          <span className="text-xs text-slate-500 dark:text-slate-400">Bevis for spart beløp</span>
        </div>
        {user.receipts.length === 0 ? (
          <div className="mt-4 rounded-2xl border border-dashed border-slate-300 bg-slate-50/80 p-5 text-sm text-slate-500 dark:border-slate-700 dark:bg-slate-950/50 dark:text-slate-400">
            Ingen godkjente kvitteringer ennå. Last opp noen kvitteringer for å bygge en faktisk sparehistorikk.
          </div>
        ) : (
          <ul className="mt-4 space-y-3 text-sm">
            {user.receipts.map((receipt) => (
              <li key={receipt.id} className="rounded-2xl border border-slate-200 px-4 py-4 dark:border-slate-800">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <p className="font-medium">{receipt.fileName}</p>
                    <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                      {receipt.detectedStore ?? "Ukjent butikk"} · {new Date(receipt.createdAt).toLocaleDateString("no-NO")}
                    </p>
                    {receipt.savingsNote ? <p className="mt-2 text-sm text-slate-600 dark:text-slate-300">{receipt.savingsNote}</p> : null}
                  </div>
                  <div className="text-right">
                    <p className="font-semibold text-emerald-700 dark:text-emerald-300">{formatNok(Number(receipt.verifiedSavings ?? 0))}</p>
                    <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">{receipt.savingsConfidence ?? "ikke gradert"}</p>
                  </div>
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>
    </main>
  );
}