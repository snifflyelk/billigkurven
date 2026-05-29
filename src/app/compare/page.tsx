import { PriceComparisonTable } from "@/components/price-comparison-table";
import { StoreComparisonChart } from "@/components/store-comparison-chart";
import { TransparencySnapshot } from "@/components/transparency-snapshot";
import { compareShoppingList } from "@/lib/compare";
import { DEFAULT_USER_EMAIL } from "@/lib/constants";
import { prisma } from "@/lib/prisma";
import { getTransparencyMetrics } from "@/lib/transparency";
import { formatNok } from "@/lib/utils";
import Link from "next/link";

export const dynamic = "force-dynamic";

export default async function ComparePage({
  searchParams,
}: {
  searchParams: { shoppingListId?: string };
}) {
  let shoppingListId = searchParams.shoppingListId;

  if (!shoppingListId) {
    const user = await prisma.user.findUnique({ where: { email: DEFAULT_USER_EMAIL } });
    const list = user
      ? await prisma.shoppingList.findFirst({ where: { userId: user.id }, orderBy: { createdAt: "desc" } })
      : null;
    shoppingListId = list?.id;
  }

  if (!shoppingListId) {
    return (
      <main className="mx-auto max-w-5xl px-4 py-10">
        <h1 className="text-3xl font-bold">Sammenligning</h1>
        <p className="mt-4 text-slate-600 dark:text-slate-300">Ingen handleliste funnet for sammenligning.</p>
        <section className="mt-6 rounded-2xl border border-slate-200 bg-white p-5 dark:border-slate-800 dark:bg-slate-900">
          <p className="text-sm text-slate-600 dark:text-slate-300">
            Start med onboarding eller opprett en handleliste for å få anbefalt billigste butikk og estimert besparelse.
          </p>
          <div className="mt-4 flex flex-wrap gap-3">
            <Link href="/onboarding" className="rounded-xl bg-emerald-600 px-4 py-2 text-sm font-medium text-white hover:bg-emerald-500">
              Gå til onboarding
            </Link>
            <Link href="/shopping-list" className="rounded-xl border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:text-slate-200 dark:hover:bg-slate-800">
              Se handleliste
            </Link>
          </div>
        </section>
      </main>
    );
  }

  const [result, transparencyMetrics] = await Promise.all([compareShoppingList(shoppingListId), getTransparencyMetrics()]);
  const confidenceTone = result.confidence === "hoy" ? "Hoy" : result.confidence === "medium" ? "Medium" : "Lav";
  const trustBand = result.trustMetrics.trustScore >= 75 ? "Sterk" : result.trustMetrics.trustScore >= 45 ? "Moderat" : "Svak";

  const buyNowCount = result.recommendation.timingSummary.buyNow;
  const waitCount = result.recommendation.timingSummary.wait;
  const neutralCount = result.recommendation.timingSummary.neutral;

  return (
    <main className="mx-auto max-w-6xl px-4 py-10 pb-24 md:pb-10">
      <h1 className="text-3xl font-bold tracking-tight">Butikksammenligning</h1>
      <p className="mt-2 text-slate-600 dark:text-slate-300">Beslutningsmotor: ett tydelig svar pa hvor du bor handle i dag.</p>

      <section className="mt-6 rounded-3xl border border-emerald-200 bg-gradient-to-br from-emerald-50 via-white to-cyan-50 p-6 fade-rise dark:border-emerald-900 dark:from-emerald-950/20 dark:via-slate-950 dark:to-cyan-950/20">
        <div className="flex flex-wrap items-center gap-2 text-xs">
          <span className="rounded-full border border-emerald-300 bg-white px-2.5 py-1 font-semibold text-emerald-700 dark:border-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-300">
            Tillit: {result.trustMetrics.trustScore}/100 ({trustBand})
          </span>
          <span className="rounded-full border border-slate-300 bg-white px-2.5 py-1 font-semibold text-slate-700 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200">
            Confidence: {confidenceTone}
          </span>
          <span className="rounded-full border border-slate-300 bg-white px-2.5 py-1 font-semibold text-slate-700 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200">
            Datapunkter: {result.dataPoints}
          </span>
          <span className="rounded-full border border-cyan-300 bg-white px-2.5 py-1 font-semibold text-cyan-700 dark:border-cyan-800 dark:bg-cyan-950/30 dark:text-cyan-200">
            Handleliste-dekning: {result.coverageScore}/100
          </span>
        </div>

        <p className="mt-4 text-sm font-medium text-emerald-700 dark:text-emerald-300">
          {result.recommendation.shouldAutoRecommend ? "Anbefaling i dag" : "Forelopig vurdering"}
        </p>
        <h2 className="mt-1 text-3xl font-bold tracking-tight">
          {result.recommendation.shouldAutoRecommend
            ? `Handle hos ${result.recommendation.recommendedStore?.storeName ?? "-"}`
            : `Billigste observerte alternativ: ${result.cheapestStore?.storeName ?? "-"}`}
        </h2>
        <p className="mt-2 text-sm text-emerald-800 dark:text-emerald-200">
          Estimert gevinst: {formatNok(result.estimatedSavings)} sammenlignet med dyreste alternativ.
        </p>
        <p className="mt-2 text-sm text-emerald-900/90 dark:text-emerald-100/90">{result.recommendation.message}</p>
        <p className="mt-1 text-xs text-emerald-700/90 dark:text-emerald-300/90">
          Datadekning: {result.coveredItems}/{result.analyzedItems} varer · Nyeste observasjon: {result.trustMetrics.newestObservationHours !== null ? `${result.trustMetrics.newestObservationHours} t` : "-"}
        </p>
        <div className="mt-4 flex flex-wrap gap-3">
          {result.recommendation.shouldAutoRecommend ? (
            <>
              <Link href="/shopping-list" className="rounded-xl bg-emerald-600 px-4 py-2 text-sm font-medium text-white hover:bg-emerald-500">
                Bruk anbefalingen na
              </Link>
              <Link href="/receipts" className="rounded-xl border border-emerald-300 px-4 py-2 text-sm font-medium text-emerald-800 hover:bg-emerald-100 dark:border-emerald-800 dark:text-emerald-200 dark:hover:bg-emerald-900/40">
                Last opp kvittering for verifisering
              </Link>
            </>
          ) : (
            <>
              <Link href="/receipts" className="rounded-xl bg-amber-600 px-4 py-2 text-sm font-medium text-white hover:bg-amber-500">
                Forbedre datagrunnlaget
              </Link>
              <Link href="/confidence" className="rounded-xl border border-amber-300 px-4 py-2 text-sm font-medium text-amber-800 hover:bg-amber-100 dark:border-amber-800 dark:text-amber-200 dark:hover:bg-amber-900/40">
                Se hvorfor anbefaling holdes igjen
              </Link>
            </>
          )}
          <Link href="/alerts" className="rounded-xl border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:text-slate-200 dark:hover:bg-slate-800">
            Sett prisvarsel
          </Link>
        </div>
      </section>

      <div className="mt-6 grid gap-4 md:grid-cols-3 fade-rise-delayed">
        <div className="rounded-2xl border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900">
          <p className="text-sm text-slate-500">Billigste butikk</p>
          <p className="mt-1 text-xl font-semibold">{result.cheapestStore?.storeName ?? "-"}</p>
        </div>
        <div className="rounded-2xl border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900">
          <p className="text-sm text-slate-500">Total hos billigste</p>
          <p className="mt-1 text-xl font-semibold">{formatNok(result.cheapestStore?.totalPrice ?? 0)}</p>
        </div>
        <div className="rounded-2xl border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900">
          <p className="text-sm text-slate-500">Estimert spart belop</p>
          <p className="mt-1 text-xl font-semibold text-emerald-600">{formatNok(result.estimatedSavings)}</p>
        </div>
      </div>

      <section className="mt-4 rounded-2xl border border-cyan-200 bg-cyan-50/80 p-4 text-sm dark:border-cyan-900 dark:bg-cyan-950/20">
        <p className="font-medium text-cyan-900 dark:text-cyan-100">Dekningsscore for denne handlelisten: {result.coverageScore}/100</p>
        <p className="mt-1 text-cyan-800/90 dark:text-cyan-200/90">
          {result.coverageScore >= 80
            ? "Sterk dekning. Anbefalingen bygger pa et bredt sammenligningsgrunnlag."
            : result.coverageScore >= 55
              ? "Middels dekning. Bruk anbefalingen med moderat forsiktighet."
              : "Lav dekning. Last opp kvitteringer og utvid listen for mer robust anbefaling."}
        </p>
      </section>

      <section className="mt-4 grid gap-4 md:grid-cols-4 fade-rise-delayed">
        <article className="rounded-2xl border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900">
          <p className="text-sm text-slate-500">Tillitsscore</p>
          <p className="mt-1 text-2xl font-semibold">{result.trustMetrics.trustScore}/100</p>
        </article>
        <article className="rounded-2xl border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900">
          <p className="text-sm text-slate-500">Snittalder priser</p>
          <p className="mt-1 text-2xl font-semibold">
            {result.trustMetrics.averagePriceAgeDays !== null ? `${result.trustMetrics.averagePriceAgeDays} d` : "-"}
          </p>
        </article>
        <article className="rounded-2xl border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900">
          <p className="text-sm text-slate-500">Nyeste observasjon</p>
          <p className="mt-1 text-2xl font-semibold">
            {result.trustMetrics.newestObservationHours !== null ? `${result.trustMetrics.newestObservationHours} t` : "-"}
          </p>
        </article>
        <article className="rounded-2xl border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900">
          <p className="text-sm text-slate-500">Kildediversitet</p>
          <p className="mt-1 text-2xl font-semibold">{result.trustMetrics.sourceDiversity}</p>
        </article>
      </section>

      {result.trustMetrics.filteredOutlierStores > 0 ? (
        <section className="mt-4 rounded-2xl border border-amber-200 bg-amber-50/80 p-4 text-sm dark:border-amber-900 dark:bg-amber-950/25">
          <p className="font-medium text-amber-900 dark:text-amber-100">Prisavvik ble filtrert automatisk</p>
          <p className="mt-1 text-amber-800/90 dark:text-amber-200/90">
            {result.trustMetrics.filteredOutlierStores} butikkdatasett er holdt utenfor fordi prisene avviker kraftig fra normalnivaet for samme vare.
          </p>
        </section>
      ) : null}

      <section className="mt-4 grid gap-4 md:grid-cols-3">
        <article className="rounded-2xl border border-emerald-200 bg-emerald-50/80 p-4 dark:border-emerald-900 dark:bg-emerald-950/25">
          <p className="text-xs font-semibold uppercase tracking-wide text-emerald-700 dark:text-emerald-300">Kjop na-signaler</p>
          <p className="mt-1 text-2xl font-semibold text-emerald-800 dark:text-emerald-200">{buyNowCount}</p>
          <p className="mt-1 text-xs text-emerald-800/80 dark:text-emerald-200/80">Prisdriververdi: {formatNok(result.recommendation.timingImpact.buyNowValue)}</p>
        </article>
        <article className="rounded-2xl border border-amber-200 bg-amber-50/80 p-4 dark:border-amber-900 dark:bg-amber-950/25">
          <p className="text-xs font-semibold uppercase tracking-wide text-amber-700 dark:text-amber-300">Vent-signaler</p>
          <p className="mt-1 text-2xl font-semibold text-amber-800 dark:text-amber-200">{waitCount}</p>
          <p className="mt-1 text-xs text-amber-800/80 dark:text-amber-200/80">Prisdriververdi: {formatNok(result.recommendation.timingImpact.waitValue)}</p>
        </article>
        <article className="rounded-2xl border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900">
          <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Noytrale signaler</p>
          <p className="mt-1 text-2xl font-semibold">{neutralCount}</p>
        </article>
      </section>

      <section className="mt-6 grid gap-4 lg:grid-cols-[1.2fr_0.8fr] fade-rise-delayed">
        <article className="rounded-3xl border border-slate-200 bg-white p-5 dark:border-slate-800 dark:bg-slate-900">
          <h2 className="text-lg font-semibold">Hvorfor anbefaler vi dette?</h2>
          <div className="mt-4 space-y-3 text-sm">
            {result.recommendation.why.map((line, index) => (
              <div key={`why-${index}`} className="rounded-2xl border border-slate-200 bg-slate-50/80 p-3 dark:border-slate-800 dark:bg-slate-950/50">
                {line}
              </div>
            ))}
          </div>

          <h3 className="mt-5 text-sm font-semibold uppercase tracking-wide text-slate-500">Neste steg for hoyere gevinst</h3>
          <ul className="mt-2 space-y-2 text-sm">
            {result.recommendation.nextActions.map((line, index) => (
              <li key={`next-${index}`} className="rounded-xl border border-cyan-200 bg-cyan-50/70 px-3 py-2 text-cyan-900 dark:border-cyan-900 dark:bg-cyan-950/20 dark:text-cyan-100">
                {line}
              </li>
            ))}
          </ul>

          {result.recommendation.riskFlags.length > 0 ? (
            <>
              <h3 className="mt-5 text-sm font-semibold uppercase tracking-wide text-slate-500">Risikoflagg</h3>
              <ul className="mt-2 space-y-2 text-sm">
                {result.recommendation.riskFlags.map((line, index) => (
                  <li key={`risk-${index}`} className="rounded-xl border border-amber-200 bg-amber-50/70 px-3 py-2 text-amber-900 dark:border-amber-900 dark:bg-amber-950/20 dark:text-amber-100">
                    {line}
                  </li>
                ))}
              </ul>
            </>
          ) : null}

          <div className="mt-4 rounded-2xl border border-slate-200 bg-slate-50/80 p-3 text-xs text-slate-600 dark:border-slate-800 dark:bg-slate-950/40 dark:text-slate-300">
            Timing-sammendrag: {buyNowCount} kjop-na, {waitCount} vent, {neutralCount} noytral.
          </div>
        </article>

        <article className="rounded-3xl border border-slate-200 bg-white p-5 dark:border-slate-800 dark:bg-slate-900">
          <h2 className="text-lg font-semibold">Dekning per butikk</h2>
          <ul className="mt-4 space-y-2 text-sm">
            {result.totals.map((store) => (
              <li key={store.storeId} className="rounded-2xl border border-slate-200 px-3 py-3 dark:border-slate-800">
                <div className="flex items-center justify-between gap-3">
                  <span className="font-medium">{store.storeName}</span>
                  <span>{formatNok(store.totalPrice)}</span>
                </div>
                <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                  Dekning {store.coveredItems}/{result.analyzedItems} varer · nyeste observasjon {store.newestHours !== null ? `${store.newestHours} t` : "-"} · kilder {store.sourceCount}
                </p>
                <div className="mt-2 flex flex-wrap gap-1.5 text-[11px]">
                  <span className="rounded-full bg-emerald-100 px-2 py-0.5 font-semibold text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-200">
                    Kampanjetreff: {store.promoAppliedItems}
                  </span>
                  <span className="rounded-full bg-cyan-100 px-2 py-0.5 font-semibold text-cyan-800 dark:bg-cyan-900/40 dark:text-cyan-200">
                    Medlemspris brukt: {store.loyaltyAppliedItems}
                  </span>
                  <span className="rounded-full bg-amber-100 px-2 py-0.5 font-semibold text-amber-800 dark:bg-amber-900/40 dark:text-amber-200">
                    Last pga medlemskrav: {store.membershipLockedItems}
                  </span>
                </div>
                {store.membershipLockedProducts.length > 0 ? (
                  <div className="mt-2 rounded-xl border border-amber-200 bg-amber-50/70 px-2.5 py-2 text-[11px] text-amber-900 dark:border-amber-800 dark:bg-amber-950/30 dark:text-amber-200">
                    <p className="font-semibold">Varer med medlemslas:</p>
                    <p className="mt-1">{store.membershipLockedProducts.slice(0, 4).join(", ")}{store.membershipLockedProducts.length > 4 ? ` +${store.membershipLockedProducts.length - 4} til` : ""}</p>
                  </div>
                ) : null}
              </li>
            ))}
          </ul>
        </article>
      </section>

      <section className="mt-8 grid gap-6 lg:grid-cols-2 fade-rise-slow">
        <PriceComparisonTable
          rows={result.totals.map((row, i) => ({
            storeName: row.storeName,
            totalPrice: row.totalPrice,
            isCheapest: i === 0,
          }))}
        />
        <StoreComparisonChart data={result.totals.map((t) => ({ storeName: t.storeName, totalPrice: t.totalPrice }))} />
      </section>

      <section className="mt-8 rounded-3xl border border-slate-200 bg-white p-5 fade-rise-slow dark:border-slate-800 dark:bg-slate-900">
        <h2 className="text-lg font-semibold">Varer som driver prisforskjellen</h2>
        <p className="mt-1 text-sm text-slate-600 dark:text-slate-300">Prioriter disse varene for stordrift i besparelse.</p>
        {result.priceyDrivers.length === 0 ? (
          <p className="mt-3 text-sm text-slate-500 dark:text-slate-400">Ingen tydelige prisdrivere ennå. Legg til flere varer for bedre innsikt.</p>
        ) : (
          <ul className="mt-3 space-y-2.5 text-sm">
            {result.priceyDrivers.map((item) => (
              <li key={item.productId} className="flex items-center justify-between rounded-xl border border-slate-200 px-3 py-3 dark:border-slate-800">
                <div>
                  <p className="font-medium">{item.productName}</p>
                  <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                    {item.trend.last7Avg !== null ? `7d snitt: ${formatNok(item.trend.last7Avg)}` : "7d snitt: -"}
                  </p>
                </div>
                <div className="text-right">
                  <p className="font-medium text-rose-600">{formatNok(item.difference)}</p>
                  <p className={`text-xs ${item.trend.action === "kjop-na" ? "text-emerald-700 dark:text-emerald-300" : item.trend.action === "vent" ? "text-amber-700 dark:text-amber-300" : "text-slate-500 dark:text-slate-400"}`}>
                    {item.trend.action === "kjop-na"
                      ? "Signal: Kjop na"
                      : item.trend.action === "vent"
                        ? "Signal: Vent"
                        : "Signal: Noytral"}
                    {item.trend.changePct !== null ? ` (${item.trend.changePct > 0 ? "+" : ""}${item.trend.changePct}%)` : ""}
                  </p>
                </div>
              </li>
            ))}
          </ul>
        )}

        <div className="mt-5 rounded-xl border border-slate-200 bg-slate-50/80 p-3 text-xs text-slate-600 dark:border-slate-800 dark:bg-slate-950/40 dark:text-slate-300">
          <p>
            Scenario: Hvis du handler hos dyreste alternativ i dag, taper du omtrent <strong>{formatNok(result.estimatedSavings)}</strong> mot billigste.
          </p>
        </div>

        <p className="mt-4 text-xs text-slate-500 dark:text-slate-400">
          Se metoden bak confidence på <Link href="/confidence" className="font-medium text-emerald-700 hover:underline dark:text-emerald-300">Data-siden</Link>.
        </p>
      </section>

      <section className="mt-6 fade-rise-slow">
        <TransparencySnapshot
          metrics={transparencyMetrics}
          title="Globalt prisgrunnlag bak anbefalingene"
          subtitle="Sammenligningen er lokal for handlelisten din, men den hviler pa et bredere prisgrunnlag med synlig filtrering og kvitteringsverifisering."
        />
      </section>

      <div className="mobile-bottom-bar fixed inset-x-0 bottom-0 z-40 border-t border-slate-200 bg-white/95 p-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] backdrop-blur md:hidden dark:border-slate-800 dark:bg-slate-950/90">
        <div className="mobile-bottom-actions mx-auto grid max-w-6xl grid-cols-2 gap-2">
          <Link href="/shopping-list" className="mobile-bottom-action min-w-0 rounded-xl border border-slate-300 px-2.5 py-2 text-center text-[13px] font-medium leading-tight sm:px-3 sm:text-sm dark:border-slate-700">
            Handleliste
          </Link>
          <Link href="/alerts" className="mobile-bottom-action min-w-0 rounded-xl bg-emerald-600 px-2.5 py-2 text-center text-[13px] font-medium leading-tight text-white sm:px-3 sm:text-sm">
            Sett varsel
          </Link>
        </div>
      </div>
    </main>
  );
}
