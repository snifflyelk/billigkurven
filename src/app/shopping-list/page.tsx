import Link from "next/link";
import { BudgetPlanner } from "@/components/budget-planner";
import { ShoppingListEditor } from "@/components/shopping-list-editor";
import { TransparencySnapshot } from "@/components/transparency-snapshot";
import { compareShoppingList } from "@/lib/compare";
import { DEFAULT_USER_EMAIL } from "@/lib/constants";
import { getCoverageMetrics } from "@/lib/coverage";
import { scoreSubstitutionCandidate } from "@/lib/product-matching";
import { prisma } from "@/lib/prisma";
import { getTransparencyMetrics } from "@/lib/transparency";
import { formatNok } from "@/lib/utils";

export const dynamic = "force-dynamic";

export default async function ShoppingListPage() {
  const user = await prisma.user.findUnique({ where: { email: DEFAULT_USER_EMAIL }, include: { preference: true } });

  if (!user) {
    return (
      <main className="mx-auto max-w-4xl px-4 py-10">
        <h1 className="text-3xl font-bold">Handleliste</h1>
        <p className="mt-4 text-slate-600 dark:text-slate-300">
          Ingen bruker funnet. Kjor onboarding for a opprette bruker og handleliste.
        </p>
        <Link href="/onboarding" className="mt-4 inline-flex rounded-xl bg-emerald-600 px-4 py-2 text-white">
          Gå til onboarding
        </Link>
      </main>
    );
  }

  const shoppingList = await prisma.shoppingList.findFirst({
    where: { userId: user.id },
    include: {
      items: {
        include: {
          product: {
            include: {
              prices: {
                where: { isQuarantined: false },
                include: { store: true },
                orderBy: { date: "desc" },
              },
            },
          },
        },
      },
    },
    orderBy: { createdAt: "desc" },
  });

  if (!shoppingList) {
    return (
      <main className="mx-auto max-w-4xl px-4 py-10">
        <h1 className="text-3xl font-bold">Handleliste</h1>
        <p className="mt-4 text-slate-600 dark:text-slate-300">Ingen handleliste funnet ennå.</p>
        <Link href="/onboarding" className="mt-4 inline-flex rounded-xl bg-emerald-600 px-4 py-2 text-white">
          Opprett handleliste
        </Link>
      </main>
    );
  }

  const categories = Array.from(new Set(shoppingList.items.map((item) => item.product.category).filter(Boolean)));

  const [plan, transparencyMetrics, coverageMetrics, substitutionPool, verifiedReceiptsAgg] = await Promise.all([
    compareShoppingList(shoppingList.id),
    getTransparencyMetrics(),
    getCoverageMetrics(),
    prisma.product.findMany({
      where: {
        category: { in: categories },
      },
      include: {
        prices: {
          where: { isQuarantined: false },
          include: { store: true },
          orderBy: { date: "desc" },
        },
      },
      take: 120,
    }).catch(() => []),
    prisma.receiptSubmission.aggregate({
      where: { userId: user.id, status: "REVIEWED" },
      _sum: { verifiedSavings: true },
      _count: { id: true },
    }).catch(() => ({ _sum: { verifiedSavings: null }, _count: { id: 0 } })),
  ]);

  const totalItems = shoppingList.items.length;
  const totalUnits = shoppingList.items.reduce((sum, item) => sum + item.quantity, 0);
  const distinctBrands = new Set(shoppingList.items.map((item) => item.product.brand)).size;
  const buyNowItems = plan.priceyDrivers.filter((item) => item.trend.action === "kjop-na").slice(0, 2);
  const waitItems = plan.priceyDrivers.filter((item) => item.trend.action === "vent").slice(0, 2);
  const mostExpensiveTotal = plan.totals[plan.totals.length - 1]?.totalPrice ?? plan.cheapestStore?.totalPrice ?? 0;

  const latestMinPriceByProduct = new Map<string, { price: number; unitPrice: number; productName: string; category: string; brand: string; packageQuantity?: number | null; packageUnit?: "G" | "ML" | "STK" | null }>();
  for (const product of substitutionPool) {
    const seenStores = new Set<string>();
    let minPrice = Number.POSITIVE_INFINITY;
    let minUnitPrice = Number.POSITIVE_INFINITY;

    for (const price of product.prices) {
      if (seenStores.has(price.storeId)) continue;
      seenStores.add(price.storeId);
      minPrice = Math.min(minPrice, Number(price.price));
      minUnitPrice = Math.min(minUnitPrice, Number(price.unitPrice));
    }

    if (Number.isFinite(minPrice)) {
      latestMinPriceByProduct.set(product.id, {
        price: minPrice,
        unitPrice: Number.isFinite(minUnitPrice) ? minUnitPrice : minPrice,
        productName: product.name,
        category: product.category,
        brand: product.brand,
        packageQuantity: product.packageQuantity,
        packageUnit: product.packageUnit,
      });
    }
  }

  const substitutionSuggestions = shoppingList.items
    .map((item) => {
      const current = latestMinPriceByProduct.get(item.productId);
      if (!current) return null;

      const candidates = substitutionPool
        .filter((candidate) => candidate.category === item.product.category && candidate.id !== item.productId)
        .map((candidate) => ({
          candidate,
          pricing: latestMinPriceByProduct.get(candidate.id),
          match: scoreSubstitutionCandidate(
            {
              name: item.product.name,
              brand: item.product.brand,
              category: item.product.category,
              packageQuantity: item.product.packageQuantity,
              packageUnit: item.product.packageUnit,
            },
            {
              name: candidate.name,
              brand: candidate.brand,
              category: candidate.category,
              packageQuantity: candidate.packageQuantity,
              packageUnit: candidate.packageUnit,
            },
          ),
        }))
        .filter((entry): entry is { candidate: (typeof substitutionPool)[number]; pricing: NonNullable<typeof entry.pricing>; match: ReturnType<typeof scoreSubstitutionCandidate> } => Boolean(entry.pricing))
        .filter((entry) => entry.match.isStrongMatch)
        .filter((entry) => entry.pricing.unitPrice < current.unitPrice * 0.92)
        .sort((left, right) => {
          if (right.match.score !== left.match.score) return right.match.score - left.match.score;
          return left.pricing.unitPrice - right.pricing.unitPrice;
        });

      const bestCandidate = candidates[0];
      if (!bestCandidate) return null;

      const estimatedSavings = Number(((current.unitPrice - bestCandidate.pricing.unitPrice) * item.quantity).toFixed(2));
      if (estimatedSavings <= 0) return null;

      return {
        currentProductName: item.product.name,
        suggestedProductName: bestCandidate.candidate.name,
        category: item.product.category,
        estimatedSavings,
        confidence: bestCandidate.candidate.brand === item.product.brand ? "hoy" as const : "medium" as const,
        reason: bestCandidate.match.reason,
      };
    })
    .filter((suggestion): suggestion is NonNullable<typeof suggestion> => Boolean(suggestion))
    .sort((left, right) => right.estimatedSavings - left.estimatedSavings)
    .slice(0, 3);

  const verifiedHistoricalSavings = Number(verifiedReceiptsAgg._sum.verifiedSavings ?? 0);
  const reviewedReceipts = verifiedReceiptsAgg._count.id;

  return (
    <main className="mx-auto max-w-5xl px-4 py-10 pb-24 md:pb-10">
      <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-3xl font-bold tracking-tight">Handleliste</h1>
        <div className="flex flex-wrap gap-2">
          <Link
            href={`/compare?shoppingListId=${shoppingList.id}`}
            className="rounded-xl bg-emerald-600 px-4 py-2 font-medium text-white hover:bg-emerald-500"
          >
            Sammenlign butikker
          </Link>
          <Link
            href="/savings"
            className="rounded-xl border border-slate-300 px-4 py-2 font-medium text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:text-slate-200 dark:hover:bg-slate-800"
          >
            Se sparehistorikk
          </Link>
        </div>
      </div>

      <section className="mb-6 grid gap-4 sm:grid-cols-3 fade-rise">
        <article className="rounded-2xl border border-emerald-200 bg-emerald-50/80 p-4 dark:border-emerald-900 dark:bg-emerald-950/25">
          <p className="text-xs uppercase tracking-wide text-emerald-700 dark:text-emerald-300">Varer</p>
          <p className="mt-1 text-2xl font-semibold text-emerald-900 dark:text-emerald-100">{totalItems}</p>
        </article>
        <article className="rounded-2xl border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900">
          <p className="text-xs uppercase tracking-wide text-slate-500">Antall enheter</p>
          <p className="mt-1 text-2xl font-semibold">{totalUnits}</p>
        </article>
        <article className="rounded-2xl border border-cyan-200 bg-cyan-50/80 p-4 dark:border-cyan-900 dark:bg-cyan-950/20">
          <p className="text-xs uppercase tracking-wide text-cyan-700 dark:text-cyan-300">Merker i kurven</p>
          <p className="mt-1 text-2xl font-semibold text-cyan-900 dark:text-cyan-100">{distinctBrands}</p>
        </article>
      </section>

      <section className="mb-6 rounded-2xl border border-sky-200 bg-sky-50/70 p-4 text-sm dark:border-sky-900 dark:bg-sky-950/30">
        <p className="font-semibold text-sky-800 dark:text-sky-300">Hjelp oss forbedre prisene (frivillig)</p>
        <p className="mt-1 text-sky-700 dark:text-sky-200">
          Soft crowdsourcing: du kan laste opp kvittering senere for bedre anbefalinger. Ingen krav i onboarding.
        </p>
        <div className="mt-3 flex items-center gap-2">
          <input type="file" disabled className="text-xs" />
          <span className="rounded-full bg-sky-100 px-2 py-1 text-xs font-medium text-sky-700 dark:bg-sky-900/50 dark:text-sky-300">
            Kommer snart
          </span>
        </div>
        <div className="mt-3">
          <Link href="/receipts" className="text-sm font-medium text-sky-800 underline-offset-4 hover:underline dark:text-sky-200">
            Gå til kvitteringsflyt
          </Link>
        </div>
      </section>

      <section className="mb-6 rounded-3xl border border-emerald-200 bg-gradient-to-br from-emerald-50 via-white to-cyan-50 p-5 fade-rise-delayed dark:border-emerald-900 dark:from-emerald-950/20 dark:via-slate-950 dark:to-cyan-950/20">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-emerald-700 dark:text-emerald-300">Dagens spareplan</p>
            <h2 className="mt-1 text-2xl font-bold tracking-tight">
              {plan.recommendation.shouldAutoRecommend
                ? `Start hos ${plan.recommendation.recommendedStore?.storeName ?? "billigste butikk"}`
                : "Bruk listen som veiledning i dag"}
            </h2>
            <p className="mt-2 max-w-2xl text-sm text-slate-700 dark:text-slate-200">{plan.recommendation.message}</p>
          </div>
          <div className="rounded-2xl border border-white/80 bg-white/90 p-4 shadow-sm dark:border-slate-800 dark:bg-slate-900/80">
            <p className="text-xs uppercase tracking-wide text-slate-500">Mulig sparing na</p>
            <p className="mt-1 text-3xl font-semibold text-emerald-700 dark:text-emerald-300">{formatNok(plan.estimatedSavings)}</p>
            <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">Mot dyreste observerte alternativ.</p>
          </div>
        </div>

        <div className="mt-5 grid gap-4 md:grid-cols-3">
          <article className="rounded-2xl border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900">
            <p className="text-xs uppercase tracking-wide text-slate-500">Best butikk i dag</p>
            <p className="mt-1 text-xl font-semibold">{plan.cheapestStore?.storeName ?? "Ikke klart ennå"}</p>
            <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">Dekning: {plan.coveredItems}/{plan.analyzedItems} varer.</p>
          </article>
          <article className="rounded-2xl border border-emerald-200 bg-emerald-50/80 p-4 dark:border-emerald-900 dark:bg-emerald-950/25">
            <p className="text-xs uppercase tracking-wide text-emerald-700 dark:text-emerald-300">Kjop na</p>
            <p className="mt-1 text-xl font-semibold text-emerald-900 dark:text-emerald-100">{buyNowItems.length || 0} varer</p>
            <p className="mt-1 text-xs text-emerald-800/80 dark:text-emerald-200/80">{buyNowItems.map((item) => item.productName).join(", ") || "Ingen tydelige vinduer akkurat na."}</p>
          </article>
          <article className="rounded-2xl border border-amber-200 bg-amber-50/80 p-4 dark:border-amber-900 dark:bg-amber-950/25">
            <p className="text-xs uppercase tracking-wide text-amber-700 dark:text-amber-300">Vent gjerne</p>
            <p className="mt-1 text-xl font-semibold text-amber-900 dark:text-amber-100">{waitItems.length || 0} varer</p>
            <p className="mt-1 text-xs text-amber-800/80 dark:text-amber-200/80">{waitItems.map((item) => item.productName).join(", ") || "Ingen tydelige vent-signaler akkurat na."}</p>
          </article>
        </div>

        <div className="mt-4 rounded-2xl border border-cyan-200 bg-cyan-50/80 p-4 text-sm dark:border-cyan-900 dark:bg-cyan-950/20">
          <p className="font-medium text-cyan-900 dark:text-cyan-100">Dekningsscore for handlelisten: {plan.coverageScore}/100</p>
          <p className="mt-1 text-cyan-800/90 dark:text-cyan-200/90">
            {plan.coverageScore >= 80
              ? "Sterk dekning pa tvers av butikker akkurat na."
              : plan.coverageScore >= 55
                ? "Middels dekning. Du far nyttige signaler, men noen varer mangler fortsatt."
                : "Lav dekning. Forbedre med kvitteringer og flere observerte priser for sikrere anbefaling."}
          </p>
        </div>

        <div className="mt-4 flex flex-wrap gap-3">
          <Link href={`/compare?shoppingListId=${shoppingList.id}`} className="rounded-xl bg-emerald-600 px-4 py-2 text-sm font-medium text-white hover:bg-emerald-500">
            Se komplett butikkplan
          </Link>
          <Link href="/confidence" className="rounded-xl border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:text-slate-200 dark:hover:bg-slate-800">
            Slik regnes anbefalingen ut
          </Link>
          <Link href="/coverage" className="rounded-xl border border-cyan-300 px-4 py-2 text-sm font-medium text-cyan-800 hover:bg-cyan-50 dark:border-cyan-800 dark:text-cyan-200 dark:hover:bg-cyan-950/40">
            Se butikkdekning
          </Link>
        </div>
      </section>

      <section className="mb-6 grid gap-6 lg:grid-cols-[1.1fr_0.9fr] fade-rise-delayed">
        <article className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <p className="text-xs font-semibold uppercase tracking-wide text-emerald-700 dark:text-emerald-300">Substitusjonsmotor</p>
              <h2 className="mt-1 text-2xl font-bold tracking-tight">Bytt noen varer og press budsjettet ned</h2>
              <p className="mt-2 text-sm text-slate-600 dark:text-slate-300">Vi foreslar billigere kandidater innen samme kategori nar prisforskjellen er tydelig nok til a vaere nyttig.</p>
            </div>
            <div className="rounded-2xl border border-cyan-200 bg-cyan-50/80 p-4 dark:border-cyan-900 dark:bg-cyan-950/25">
              <p className="text-xs uppercase tracking-wide text-cyan-700 dark:text-cyan-300">Dekningsscore na</p>
              <p className="mt-1 text-2xl font-semibold text-cyan-900 dark:text-cyan-100">{coverageMetrics.score.overall}/100</p>
            </div>
          </div>

          {substitutionSuggestions.length === 0 ? (
            <div className="mt-4 rounded-2xl border border-dashed border-slate-300 bg-slate-50/80 p-5 text-sm text-slate-500 dark:border-slate-700 dark:bg-slate-950/50 dark:text-slate-400">
              Ingen tydelige bytteforslag enda. Det betyr vanligvis at kategoridekningen er for tynn eller at prisforskjellene er for sma til a gi et seriost forslag.
            </div>
          ) : (
            <ul className="mt-4 space-y-3 text-sm">
              {substitutionSuggestions.map((suggestion) => (
                <li key={`${suggestion.currentProductName}-${suggestion.suggestedProductName}`} className="rounded-2xl border border-slate-200 px-4 py-4 dark:border-slate-800">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <p className="font-medium">Bytt {suggestion.currentProductName}</p>
                      <p className="mt-1 text-slate-600 dark:text-slate-300">med {suggestion.suggestedProductName} i kategorien {suggestion.category.toLowerCase()}.</p>
                      <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">{suggestion.reason}</p>
                    </div>
                    <div className="text-right">
                      <p className="font-semibold text-emerald-700 dark:text-emerald-300">{formatNok(suggestion.estimatedSavings)}</p>
                      <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">Tillit: {suggestion.confidence === "hoy" ? "Hoy" : "Medium"}</p>
                    </div>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </article>

        <BudgetPlanner
          userId={user.id}
          primaryStore={user.preference?.primaryStore ?? "Ukjent"}
          priceSensitivity={user.preference?.priceSensitivity ?? 50}
          initialTripBudget={user.preference?.shoppingTripBudget ?? null}
          initialWeeklyBudget={user.preference?.weeklyGroceryBudget ?? null}
          initialUseMembershipPricing={user.preference?.useMembershipPricing ?? true}
          recommendedSpend={plan.cheapestStore?.totalPrice ?? 0}
          expensiveSpend={mostExpensiveTotal}
          estimatedSavings={plan.estimatedSavings}
          verifiedHistoricalSavings={verifiedHistoricalSavings}
          reviewedReceipts={reviewedReceipts}
          substitutionSuggestions={substitutionSuggestions}
        />
      </section>

      <ShoppingListEditor shoppingListId={shoppingList.id} initialItems={shoppingList.items} />

      <section className="mt-6 fade-rise-slow">
        <TransparencySnapshot
          metrics={transparencyMetrics}
          title="Hvor robust er prisgrunnlaget akkurat na?"
          subtitle="Du skal kunne se om prisene er ferske nok og hvor mye som er filtrert bort før du bestemmer hvor du handler."
        />
      </section>

      <div className="mobile-bottom-bar fixed inset-x-0 bottom-0 z-40 border-t border-slate-200 bg-white/95 p-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] backdrop-blur md:hidden dark:border-slate-800 dark:bg-slate-950/90">
        <div className="mobile-bottom-actions mx-auto grid max-w-6xl grid-cols-2 gap-2">
          <Link href="/receipts" className="mobile-bottom-action min-w-0 rounded-xl border border-slate-300 px-2.5 py-2 text-center text-[13px] font-medium leading-tight sm:px-3 sm:text-sm dark:border-slate-700">
            Kvitteringer
          </Link>
          <Link href={`/compare?shoppingListId=${shoppingList.id}`} className="mobile-bottom-action min-w-0 rounded-xl bg-emerald-600 px-2.5 py-2 text-center text-[13px] font-medium leading-tight text-white sm:px-3 sm:text-sm">
            Sammenlign na
          </Link>
        </div>
      </div>
    </main>
  );
}
