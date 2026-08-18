import { PriceComparisonTable } from "@/components/price-comparison-table";
import { compareShoppingList } from "@/lib/compare";
import { prisma } from "@/lib/prisma";
import { requireAuthenticatedSessionUserId } from "@/lib/user-session";
import { formatNok } from "@/lib/utils";
import { TrackedLink } from "@/components/tracked-link";
import { SectionImpression } from "@/components/section-impression";
import { getExperimentVariant } from "@/lib/experiments";
import Link from "next/link";
import type { Metadata } from "next";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Sammenlign butikker | Billigkurven",
  description: "Se hvilken butikk som er billigst for handlelisten din, hva du kan spare, og hva du bør kjøpe nå.",
};

export default async function ComparePage({
  searchParams,
}: {
  searchParams: { shoppingListId?: string; postalPrefix?: string };
}) {
  const currentUserId = await requireAuthenticatedSessionUserId("/compare");
  const experimentVariant = getExperimentVariant("compare_recommendation_cards_v1", currentUserId);
  let shoppingListId = searchParams.shoppingListId;
  const postalPrefix = searchParams.postalPrefix?.trim() ? searchParams.postalPrefix.trim() : null;

  if (shoppingListId) {
    const ownedList = await prisma.shoppingList.findFirst({
      where: { id: shoppingListId, userId: currentUserId },
      select: { id: true },
    });
    if (!ownedList) {
      shoppingListId = undefined;
    }
  }

  if (!shoppingListId) {
    const list = await prisma.shoppingList.findFirst({ where: { userId: currentUserId }, orderBy: { createdAt: "desc" } });
    shoppingListId = list?.id;
  }

  if (!shoppingListId) {
    return (
      <main className="mx-auto max-w-5xl px-4 py-10">
        <h1 className="text-3xl font-bold">Sammenligning</h1>
        <p className="mt-4 text-slate-600 dark:text-slate-300">Ingen handleliste funnet for sammenligning.</p>
        <section className="mt-6 rounded-2xl border border-slate-200 bg-white p-5 dark:border-slate-800 dark:bg-slate-900">
          <p className="text-sm text-slate-600 dark:text-slate-300">
            Logg inn og opprett handleliste under konto for å få anbefalt billigste butikk og estimert besparelse.
          </p>
          <div className="mt-4 flex flex-wrap gap-3">
            <Link href="/login?next=/account" className="rounded-xl bg-emerald-600 px-4 py-2 text-sm font-medium text-white hover:bg-emerald-500">
              Logg inn og sett opp konto
            </Link>
            <Link href="/shopping-list" className="rounded-xl border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:text-slate-200 dark:hover:bg-slate-800">
              Se handleliste
            </Link>
          </div>
        </section>
      </main>
    );
  }

  let result: Awaited<ReturnType<typeof compareShoppingList>>;

  try {
    result = await compareShoppingList(shoppingListId, { postalPrefix });
  } catch {
    return (
      <main className="mx-auto max-w-5xl px-4 py-10">
        <h1 className="text-3xl font-bold">Kjedesammenligning</h1>
        <section className="mt-4 rounded-2xl border border-rose-200 bg-rose-50/80 p-5 text-sm dark:border-rose-900 dark:bg-rose-950/25">
          <p className="font-semibold text-rose-900 dark:text-rose-100">Kunne ikke hente sammenligningen akkurat nå.</p>
          <p className="mt-1 text-rose-800/90 dark:text-rose-200/90">
            Prøv igjen om noen sekunder, eller gå til handlelisten og oppdater dataene før ny sammenligning.
          </p>
          <div className="mt-4 flex flex-wrap gap-3">
            <TrackedLink
              href="/compare"
              eventName="compare_retry_clicked"
              eventProps={{ source: "compare_error_state" }}
              className="rounded-xl bg-rose-600 px-4 py-2 text-sm font-medium text-white hover:bg-rose-500"
            >
              Prøv igjen
            </TrackedLink>
            <Link href="/shopping-list" className="rounded-xl border border-rose-300 px-4 py-2 text-sm font-medium text-rose-800 hover:bg-rose-100 dark:border-rose-800 dark:text-rose-200 dark:hover:bg-rose-900/40">
              Gå til handleliste
            </Link>
          </div>
        </section>
      </main>
    );
  }
  const buyNowDrivers = result.priceyDrivers.filter((item) => item.trend.action === "kjop-na").slice(0, 3);
  const waitDrivers = result.priceyDrivers.filter((item) => item.trend.action === "vent").slice(0, 3);
  const topDrivers = result.priceyDrivers.slice(0, 5);

  return (
    <main className="mx-auto max-w-6xl px-4 py-10 pb-24 md:py-12 md:pb-10">
      <header className="max-w-3xl fade-rise">
        <h1 className="text-4xl font-bold tracking-tight">Butikksammenligning</h1>
        <p className="mt-3 text-slate-600 dark:text-slate-300">Ett tydelig svar på hvor du bør handle i dag og hva du kan spare.</p>
      </header>

      <section className="mt-6 rounded-2xl border border-cyan-200 bg-cyan-50/70 p-5 text-sm shadow-sm dark:border-cyan-900 dark:bg-cyan-950/25">
        <p className="font-semibold text-cyan-900 dark:text-cyan-100">Hyperlokal filtrering</p>
        <p className="mt-1 text-cyan-800/90 dark:text-cyan-200/90">Filtrer anbefalingen på postnummer for mer relevante butikkvalg i ditt område.</p>
        <div className="mt-3 flex flex-wrap gap-2">
          <Link
            href={shoppingListId ? `/compare?shoppingListId=${shoppingListId}` : "/compare"}
            className={`rounded-full border px-3 py-1 text-xs font-semibold ${postalPrefix === null ? "border-cyan-700 bg-cyan-700 text-white dark:border-cyan-300 dark:bg-cyan-300 dark:text-cyan-950" : "border-cyan-300 text-cyan-800 hover:bg-cyan-100 dark:border-cyan-800 dark:text-cyan-200 dark:hover:bg-cyan-900/40"}`}
          >
            Hele landet
          </Link>
          {["0", "3", "4", "5", "7"].map((prefix) => (
            <Link
              key={prefix}
              href={shoppingListId ? `/compare?shoppingListId=${shoppingListId}&postalPrefix=${prefix}` : `/compare?postalPrefix=${prefix}`}
              className={`rounded-full border px-3 py-1 text-xs font-semibold ${postalPrefix === prefix ? "border-cyan-700 bg-cyan-700 text-white dark:border-cyan-300 dark:bg-cyan-300 dark:text-cyan-950" : "border-cyan-300 text-cyan-800 hover:bg-cyan-100 dark:border-cyan-800 dark:text-cyan-200 dark:hover:bg-cyan-900/40"}`}
            >
              Post {prefix}xxx
            </Link>
          ))}
        </div>
        <p className="mt-2 text-xs text-cyan-800/90 dark:text-cyan-200/90">Aktivt filter: {result.personalization.postalFilter ? `Post ${result.personalization.postalFilter}xxx` : "Ingen"}</p>
      </section>

      <section id="compare-recommendation-hero" className="mt-6 rounded-3xl border border-emerald-200 bg-gradient-to-br from-emerald-50 via-white to-cyan-50 p-6 fade-rise dark:border-emerald-900 dark:from-emerald-950/20 dark:via-slate-950 dark:to-cyan-950/20">
        <SectionImpression
          sectionId="compare-recommendation-hero"
          eventName="experiment_exposure"
          eventProps={{ experiment: "compare_recommendation_cards_v1", variant: experimentVariant, location: "compare_hero" }}
        />
        <p className="text-sm font-medium text-emerald-700 dark:text-emerald-300">
          {result.recommendation.shouldAutoRecommend ? "Anbefaling i dag" : "Foreløpig vurdering"}
        </p>
        <h2 className="mt-1 text-3xl font-bold tracking-tight">
          {result.recommendation.shouldAutoRecommend
            ? `Handle hos ${result.recommendation.recommendedStore?.storeName ?? "-"}`
            : `Billigste observerte kjede: ${result.cheapestStore?.storeName ?? "-"}`}
        </h2>
        <p className="mt-2 text-sm text-emerald-800 dark:text-emerald-200">
          Estimert gevinst: {formatNok(result.estimatedSavings)} sammenlignet med dyreste alternativ.
        </p>
        <p className="mt-2 text-sm text-emerald-900/90 dark:text-emerald-100/90">
          {experimentVariant === "variant"
            ? `${result.recommendation.message} Vi optimaliserer med timing, kampanje og medlemspris i samme beslutning.`
            : result.recommendation.message}
        </p>
        <div className="mt-4 flex flex-wrap gap-3">
          {result.recommendation.shouldAutoRecommend ? (
            <>
              <TrackedLink
                href="/shopping-list"
                eventName="compare_recommendation_clicked"
                eventProps={{ source: "compare_primary_cta", hasPostalFilter: Boolean(postalPrefix), experimentVariant }}
                className="rounded-xl bg-emerald-600 px-4 py-2 text-sm font-medium text-white hover:bg-emerald-500"
              >
                Bruk anbefalingen nå
              </TrackedLink>
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

      <section className="mt-4 grid gap-4 md:grid-cols-3 fade-rise-delayed">
        <article className="rounded-2xl border border-cyan-200 bg-cyan-50/80 p-4 dark:border-cyan-900 dark:bg-cyan-950/20">
          <p className="text-xs font-semibold uppercase tracking-wide text-cyan-700 dark:text-cyan-300">Medlemspris brukt</p>
          <p className="mt-1 text-2xl font-semibold text-cyan-900 dark:text-cyan-100">{result.pricingTruth.loyaltyAppliedItems}</p>
          <p className="mt-1 text-xs text-cyan-800/80 dark:text-cyan-200/80">linjer fikk lavere pris via medlemspris.</p>
        </article>
        <article className="rounded-2xl border border-amber-200 bg-amber-50/80 p-4 dark:border-amber-900 dark:bg-amber-950/20">
          <p className="text-xs font-semibold uppercase tracking-wide text-amber-700 dark:text-amber-300">Låst bak medlemskap</p>
          <p className="mt-1 text-2xl font-semibold text-amber-900 dark:text-amber-100">{result.pricingTruth.membershipLockedItems}</p>
          <p className="mt-1 text-xs text-amber-800/80 dark:text-amber-200/80">linjer kan bli billigere hvis medlemspris aktiveres.</p>
        </article>
        <article className="rounded-2xl border border-emerald-200 bg-emerald-50/80 p-4 dark:border-emerald-900 dark:bg-emerald-950/20">
          <p className="text-xs font-semibold uppercase tracking-wide text-emerald-700 dark:text-emerald-300">Kampanjepris brukt</p>
          <p className="mt-1 text-2xl font-semibold text-emerald-900 dark:text-emerald-100">{result.pricingTruth.promoAppliedItems}</p>
          <p className="mt-1 text-xs text-emerald-800/80 dark:text-emerald-200/80">linjer med aktiv kampanje i sammenligningen.</p>
        </article>
      </section>

      <section className="mt-6 grid gap-4 lg:grid-cols-2 fade-rise-delayed">
        <article className="rounded-2xl border border-emerald-200 bg-emerald-50/80 p-4 dark:border-emerald-900 dark:bg-emerald-950/25">
          <h2 className="text-base font-semibold text-emerald-900 dark:text-emerald-100">Kjøp nå-plan</h2>
          <p className="mt-1 text-sm text-emerald-900/90 dark:text-emerald-100/90">Varer med best signal akkurat nå. Prioriter disse først i denne handleturen.</p>
          {buyNowDrivers.length === 0 ? (
            <p className="mt-3 text-sm text-emerald-800/90 dark:text-emerald-200/90">Ingen sterke kjøp-nå signaler akkurat nå.</p>
          ) : (
            <ul className="mt-3 space-y-2 text-sm">
              {buyNowDrivers.map((item) => (
                <li key={`buy-now-${item.productId}`} className="rounded-xl border border-emerald-200 bg-white/80 px-3 py-2 dark:border-emerald-900 dark:bg-slate-900/70">
                  <span className="font-medium text-slate-900 dark:text-slate-100">{item.productName}</span>
                  <span className="ml-2 text-emerald-800 dark:text-emerald-200">Potensiell effekt {formatNok(item.difference)}</span>
                  <p className="mt-1 text-xs text-emerald-700/90 dark:text-emerald-300/90">
                    Vindu: {item.trend.windowHint} · Score {item.trend.buyWindowScore ?? "-"}/100 · Confidence {item.trend.confidencePct ?? "-"}%
                  </p>
                </li>
              ))}
            </ul>
          )}
        </article>

        <article className="rounded-2xl border border-amber-200 bg-amber-50/80 p-4 dark:border-amber-900 dark:bg-amber-950/25">
          <h2 className="text-base font-semibold text-amber-900 dark:text-amber-100">Vent/bytt-plan</h2>
          <p className="mt-1 text-sm text-amber-900/90 dark:text-amber-100/90">Varer der timing eller alternativt merke kan gi bedre totalpris.</p>
          {waitDrivers.length === 0 ? (
            <p className="mt-3 text-sm text-amber-800/90 dark:text-amber-200/90">Ingen sterke vent-signaler nå.</p>
          ) : (
            <ul className="mt-3 space-y-2 text-sm">
              {waitDrivers.map((item) => (
                <li key={`wait-${item.productId}`} className="rounded-xl border border-amber-200 bg-white/80 px-3 py-2 dark:border-amber-900 dark:bg-slate-900/70">
                  <span className="font-medium text-slate-900 dark:text-slate-100">{item.productName}</span>
                  <span className="ml-2 text-amber-800 dark:text-amber-200">Prisgap {formatNok(item.difference)}</span>
                  <p className="mt-1 text-xs text-amber-700/90 dark:text-amber-300/90">
                    Vindu: {item.trend.windowHint} · Score {item.trend.buyWindowScore ?? "-"}/100 · Confidence {item.trend.confidencePct ?? "-"}%
                  </p>
                </li>
              ))}
            </ul>
          )}
        </article>
      </section>

      <div className="mt-6 grid gap-4 md:grid-cols-3 fade-rise-delayed">
        <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-800 dark:bg-slate-900">
          <p className="text-sm text-slate-500">Billigste kjede</p>
          <p className="mt-1 text-xl font-semibold">{result.cheapestStore?.storeName ?? "-"}</p>
        </div>
        <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-800 dark:bg-slate-900">
          <p className="text-sm text-slate-500">Total hos billigste</p>
          <p className="mt-1 text-xl font-semibold">{formatNok(result.cheapestStore?.totalPrice ?? 0)}</p>
        </div>
        <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-800 dark:bg-slate-900">
          <p className="text-sm text-slate-500">Estimert spart beløp</p>
          <p className="mt-1 text-xl font-semibold text-emerald-600">{formatNok(result.estimatedSavings)}</p>
        </div>
      </div>

      <section className="mt-6 fade-rise-delayed">
        <h2 className="mb-3 text-lg font-semibold">Sammenligning mellom kjeder</h2>
        <PriceComparisonTable
          rows={result.totals.map((row, i) => ({
            storeName: row.storeName,
            totalPrice: row.totalPrice,
            isCheapest: i === 0,
          }))}
        />
      </section>

      <section className="mt-6 rounded-3xl border border-slate-200 bg-white p-5 fade-rise-slow dark:border-slate-800 dark:bg-slate-900">
        <h2 className="text-lg font-semibold">Varer med størst prisforskjell</h2>
        <p className="mt-1 text-sm text-slate-600 dark:text-slate-300">Her får du raskt oversikt over hva som påvirker totalsummen mest.</p>
        {topDrivers.length === 0 ? (
          <p className="mt-3 text-sm text-slate-500 dark:text-slate-400">Ingen tydelige prisdrivere ennå. Legg til flere varer for bedre innsikt.</p>
        ) : (
          <ul className="mt-3 space-y-2.5 text-sm">
            {topDrivers.map((item) => (
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
                      ? "Signal: Kjøp nå"
                      : item.trend.action === "vent"
                        ? "Signal: Vent"
                        : "Signal: Nøytral"}
                    {item.trend.changePct !== null ? ` (${item.trend.changePct > 0 ? "+" : ""}${item.trend.changePct}%)` : ""}
                  </p>
                  <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                    Kjøpevindu-score: {item.trend.buyWindowScore ?? "-"}/100 · Confidence: {item.trend.confidencePct ?? "-"}%
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
