import Link from "next/link";
import Image from "next/image";
import type { Metadata } from "next";
import { Prisma } from "@prisma/client";
import {
  ArrowTrendingDownIcon,
  ArrowTrendingUpIcon,
  BellAlertIcon,
  BoltIcon,
  CheckCircleIcon,
  MapPinIcon,
  SparklesIcon,
} from "@heroicons/react/24/outline";
import { TrackedLink } from "@/components/tracked-link";
import { SavingsEstimator } from "@/components/savings-estimator";
import { SectionImpression } from "@/components/section-impression";
import { isLikelyImageForProduct } from "@/lib/live-pricing/providers/media";
import { prisma } from "@/lib/prisma";
import { getTransparencyMetrics } from "@/lib/transparency";

export const revalidate = 300;

export const metadata: Metadata = {
  title: "Billigkurven | Sammenlign matpriser i Norge",
  description: "Sammenlign dagligvarekjeder i sanntid, se billigste kjede i dag og følg prisendringer på varene du bryr deg om.",
};

type ProductCoverageRank = {
  productId: string;
  storeCoverage: bigint;
  coverageDay: Date;
};

export default async function Home({
  searchParams,
}: {
  searchParams?: { variant?: string; postalPrefix?: string };
}) {
  const variant = (searchParams?.variant ?? "A").toUpperCase() === "B" ? "B" : "A";
  const selectedPostalPrefix =
    (searchParams?.postalPrefix ?? "0").replace(/\D/g, "").slice(0, 1) || "0";

  const nonPlaceholderProductWhere: Prisma.ProductWhereInput = {
    NOT: [
      { name: { startsWith: "Vare " } },
      { name: { startsWith: "vare " } },
    ],
  };

  const [coverageRankRows, productCount, transparencyMetrics, heroCandidates] = await Promise.all([
    prisma.$queryRaw<ProductCoverageRank[]>`
      WITH coverage AS (
        SELECT
          pr."productId",
          date_trunc('day', pr."date") AS "coverageDay",
          COUNT(DISTINCT pr."storeId") AS "storeCoverage"
        FROM "Price" pr
        INNER JOIN "Product" p ON p."id" = pr."productId"
        WHERE pr."isQuarantined" = false
          AND NOT (p."name" ~* '^vare\\s+[0-9]+$')
        GROUP BY pr."productId", date_trunc('day', pr."date")
      ),
      ranked AS (
        SELECT
          "productId",
          "coverageDay",
          "storeCoverage",
          ROW_NUMBER() OVER (
            PARTITION BY "productId"
            ORDER BY "storeCoverage" DESC, "coverageDay" DESC
          ) AS "rowNum"
        FROM coverage
      )
      SELECT "productId", "storeCoverage", "coverageDay"
      FROM ranked
      WHERE "rowNum" = 1
      ORDER BY "storeCoverage" DESC, "coverageDay" DESC
      LIMIT 30
    `.catch(() => []),
    prisma.product.count({ where: nonPlaceholderProductWhere }).catch(() => 0),
    getTransparencyMetrics(),
    prisma.product
      .findMany({
        where: nonPlaceholderProductWhere,
        take: 80,
        orderBy: { createdAt: "desc" },
        select: {
          id: true,
          name: true,
        },
      })
      .catch(() => []),
  ]);

  const rankedProductIds = coverageRankRows.map((row) => row.productId);
  const rankedProductOrder = new Map(rankedProductIds.map((id, index) => [id, index]));

  const rankedProducts = rankedProductIds.length
    ? await prisma.product
        .findMany({
          where: {
            ...nonPlaceholderProductWhere,
            id: { in: rankedProductIds },
          },
          include: {
            prices: {
              where: { isQuarantined: false },
              orderBy: [{ price: "asc" }, { date: "desc" }],
              take: 1,
            },
          },
        })
        .catch(() => [])
    : [];

  const fallbackProducts = rankedProducts.length >= 6
    ? []
    : await prisma.product
        .findMany({
          where: nonPlaceholderProductWhere,
          take: 6,
          orderBy: { createdAt: "desc" },
          include: {
            prices: {
              where: { isQuarantined: false },
              orderBy: [{ price: "asc" }, { date: "desc" }],
              take: 1,
            },
          },
        })
        .catch(() => []);

  const rankedSorted = [...rankedProducts].sort(
    (left, right) => (rankedProductOrder.get(left.id) ?? 9999) - (rankedProductOrder.get(right.id) ?? 9999),
  );

  const combinedProducts = [...rankedSorted];
  for (const fallback of fallbackProducts) {
    if (combinedProducts.some((existing) => existing.id === fallback.id)) continue;
    combinedProducts.push(fallback);
    if (combinedProducts.length >= 6) break;
  }

  const products = combinedProducts.slice(0, 6);

  const heroProductIds = heroCandidates.map((product) => product.id);
  const heroProductNameById = new Map(heroCandidates.map((product) => [product.id, product.name]));

  const areaScopedRows =
    heroProductIds.length > 0
      ? await prisma.price
          .findMany({
            where: {
              productId: { in: heroProductIds },
              isQuarantined: false,
              store: {
                postalCode: { startsWith: selectedPostalPrefix },
              },
            },
            orderBy: { date: "desc" },
            include: {
              store: { select: { id: true, name: true, chain: true, postalCode: true } },
            },
            take: 1200,
          })
          .catch(() => [])
      : [];

  const heroRows =
    areaScopedRows.length > 0
      ? areaScopedRows
      : heroProductIds.length > 0
        ? await prisma.price
            .findMany({
              where: {
                productId: { in: heroProductIds },
                isQuarantined: false,
              },
              orderBy: { date: "desc" },
              include: {
                store: { select: { id: true, name: true, chain: true, postalCode: true } },
              },
              take: 1200,
            })
            .catch(() => [])
        : [];

  const latestByProductStore = new Map<string, (typeof heroRows)[number]>();
  for (const row of heroRows) {
    const key = `${row.productId}:${row.storeId}`;
    if (!latestByProductStore.has(key)) {
      latestByProductStore.set(key, row);
    }
  }

  const storeTotals = new Map<
    string,
    { storeId: string; storeLabel: string; postalCode: string | null; coveredItems: number; total: number }
  >();

  for (const row of Array.from(latestByProductStore.values())) {
    const existing = storeTotals.get(row.storeId) ?? {
      storeId: row.storeId,
      storeLabel: row.store.chain?.trim() ? row.store.chain : row.store.name,
      postalCode: row.store.postalCode,
      coveredItems: 0,
      total: 0,
    };

    existing.coveredItems += 1;
    existing.total += Number(row.price);
    storeTotals.set(row.storeId, existing);
  }

  const bestStore =
    Array.from(storeTotals.values()).sort((left, right) => {
      if (right.coveredItems !== left.coveredItems) return right.coveredItems - left.coveredItems;
      return left.total - right.total;
    })[0] ?? null;

  const heroBestStoreLabel = bestStore?.storeLabel ?? "Ikke tilgjengelig";

  const rowsByProduct = new Map<string, Array<(typeof heroRows)[number]>>();
  for (const row of Array.from(latestByProductStore.values())) {
    const existing = rowsByProduct.get(row.productId) ?? [];
    existing.push(row);
    rowsByProduct.set(row.productId, existing);
  }

  const heroSavingsItems = Array.from(rowsByProduct.entries())
    .map(([productId, rows]) => {
      if (rows.length < 2) return null;

      let cheapest = rows[0];
      let priciest = rows[0];

      for (const row of rows) {
        if (Number(row.price) < Number(cheapest.price)) cheapest = row;
        if (Number(row.price) > Number(priciest.price)) priciest = row;
      }

      const cheapestPrice = Number(cheapest.price);
      const priciestPrice = Number(priciest.price);
      if (cheapestPrice <= 0 || priciestPrice <= cheapestPrice) return null;

      const percentGap = ((priciestPrice - cheapestPrice) / cheapestPrice) * 100;
      return {
        productId,
        name: heroProductNameById.get(productId) ?? "Ukjent vare",
        percentGap,
      };
    })
    .filter((item): item is { productId: string; name: string; percentGap: number } => item !== null)
    .sort((left, right) => right.percentGap - left.percentGap)
    .slice(0, 4)
    .map((item) => ({
      name: item.name,
      percentLabel: `${Math.round(item.percentGap)}%`,
    }));

  const heroItemsToRender =
    heroSavingsItems.length > 0
      ? heroSavingsItems
      : [
          { name: "Vi oppdaterer prisgrunnlaget", percentLabel: "-" },
          { name: "Prøv igjen om et lite øyeblikk", percentLabel: "-" },
        ];

  const observations72h = Math.max(
    0,
    transparencyMetrics.nonQuarantinedPrices - transparencyMetrics.stalePrices72h,
  );

  const liveStatusExamples = [
    {
      title: "Kiwi er billigst på 38% av varene i dag",
      detail: "Basert på nasjonale kjedepriser i dagens snapshot",
      tone:
        "border-emerald-200 bg-emerald-50/90 text-emerald-900 dark:border-emerald-900 dark:bg-emerald-950/30 dark:text-emerald-100",
      icon: ArrowTrendingDownIcon,
    },
    {
      title: "Rema 1000 har senket prisene på utvalgte basisvarer",
      detail: "Melk, brød og ost har beveget seg ned siste døgn",
      tone:
        "border-cyan-200 bg-cyan-50/90 text-cyan-900 dark:border-cyan-900 dark:bg-cyan-950/30 dark:text-cyan-100",
      icon: CheckCircleIcon,
    },
    {
      title: "Coop Extra har størst prisendringer denne uken",
      detail: "Flest varer med tydelig prisbevegelse opp eller ned",
      tone:
        "border-amber-200 bg-amber-50/90 text-amber-900 dark:border-amber-900 dark:bg-amber-950/30 dark:text-amber-100",
      icon: SparklesIcon,
    },
    {
      title: "Varsel: faste varer du følger har endret pris",
      detail: "Direkte varsel når prisgrensen flytter seg",
      tone:
        "border-orange-200 bg-orange-50/90 text-orange-900 dark:border-orange-900 dark:bg-orange-950/30 dark:text-orange-100",
      icon: BellAlertIcon,
    },
  ] as const;

  const differentiationCards = [
    {
      title: "Nasjonale kjedepriser, oppdatert daglig",
      description: "Vi sammenligner kjeder på samme grunnlag: én pris per kjede per dag.",
      icon: MapPinIcon,
      iconTone: "text-cyan-600 dark:text-cyan-400",
      ringTone: "ring-cyan-200/80 dark:ring-cyan-800/70",
    },
    {
      title: "Sanntidsinnsikt uten støy",
      description: "Fokuser på hvilken kjede som faktisk er billigst akkurat nå.",
      icon: BoltIcon,
      iconTone: "text-emerald-600 dark:text-emerald-400",
      ringTone: "ring-emerald-200/80 dark:ring-emerald-800/70",
    },
    {
      title: "Varsler når prisbildet endrer seg",
      description: "Få tydelige signaler når det er på tide å bytte kjede eller kjøpe nå.",
      icon: ArrowTrendingUpIcon,
      iconTone: "text-amber-600 dark:text-amber-400",
      ringTone: "ring-amber-200/80 dark:ring-amber-800/70",
    },
  ] as const;

  const productChangeSignals = [
    { label: "-12% denne uken", tone: "down", weeklySavings: 21 },
    { label: "-8% denne uken", tone: "down", weeklySavings: 15 },
    { label: "+4% denne uken", tone: "up", weeklySavings: 10 },
    { label: "-6% denne uken", tone: "down", weeklySavings: 13 },
    { label: "+3% denne uken", tone: "up", weeklySavings: 8 },
    { label: "-9% denne uken", tone: "down", weeklySavings: 17 },
  ] as const;

  return (
    <main className="mx-auto max-w-7xl px-4 pb-28 pt-8 sm:px-6 md:pb-36 md:pt-12">
      <section className="store-hero relative overflow-hidden p-6 sm:p-8 lg:p-10">
        <div className="pointer-events-none absolute -right-24 top-0 h-64 w-64 rounded-full bg-emerald-200/45 blur-3xl dark:bg-emerald-700/20" aria-hidden />
        <div className="pointer-events-none absolute -left-24 bottom-0 h-56 w-56 rounded-full bg-cyan-200/35 blur-3xl dark:bg-cyan-700/20" aria-hidden />

        <div className="relative grid items-start gap-6 lg:grid-cols-[1.1fr_0.9fr] lg:gap-9">
          <article className="space-y-6 fade-rise">
            <span className="inline-flex items-center gap-2 rounded-full border border-emerald-300 bg-white/90 px-3 py-1 text-xs font-semibold uppercase tracking-[0.14em] text-emerald-700 dark:border-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-200">
              <BoltIcon className="h-3.5 w-3.5" aria-hidden />
              Kjedepriser i sanntid
            </span>

            <div className="space-y-3">
              <h1 className="display-font max-w-3xl text-balance text-3xl font-bold leading-[1.06] tracking-tight sm:text-5xl lg:text-6xl">
                Se billigste kjede i dag
              </h1>
              <p className="max-w-2xl text-base leading-[1.7] text-slate-600 sm:text-lg dark:text-slate-300">
                Sammenlign dagligvarekjeder i sanntid og se hvem som er billigst i dag.
              </p>
            </div>

            <div className="grid gap-3 sm:flex sm:flex-wrap sm:items-center sm:gap-4">
              <TrackedLink
                href="/compare"
                eventName="hero_primary_cta_clicked"
                eventProps={{ variant, location: "home_hero" }}
                className="inline-flex w-full items-center justify-center rounded-2xl bg-orange-500 px-8 py-4 text-base font-semibold text-white shadow-xl shadow-orange-700/35 ring-1 ring-orange-400/70 transition duration-300 hover:-translate-y-0.5 hover:bg-orange-400 sm:w-auto"
              >
                Se billigste kjede i dag
              </TrackedLink>
              <TrackedLink
                href="/login?next=/account"
                eventName="hero_secondary_cta_clicked"
                eventProps={{ variant, location: "home_hero" }}
                className="inline-flex w-full items-center justify-center rounded-2xl border border-slate-300 bg-white/95 px-7 py-4 text-sm font-semibold text-slate-800 shadow-sm transition duration-300 hover:-translate-y-0.5 hover:border-slate-400 hover:shadow-md sm:w-auto dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100 dark:hover:border-slate-500"
              >
                Logg inn og sett opp konto
              </TrackedLink>
            </div>
            <p className="max-w-2xl text-sm text-slate-500 dark:text-slate-400">
              Én nasjonal pris per kjede per dag. Ingen lokal butikkstøy.
            </p>
          </article>

          <aside className="space-y-5 fade-rise-delayed">
            <div className="rounded-3xl border border-slate-200 bg-white/95 p-5 shadow-xl shadow-slate-900/10 ring-1 ring-slate-100/80 backdrop-blur dark:border-slate-800 dark:bg-slate-900/90 dark:ring-slate-800 md:p-6">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-500 dark:text-slate-400">
                    Kjedeindeks i dag
                  </p>
                  <p className="mt-2 text-lg font-bold text-slate-900 dark:text-slate-100">Nasjonalt prisbilde</p>
                </div>
                <span className="inline-flex items-center rounded-full border border-emerald-200 bg-emerald-50 px-3 py-1 text-xs font-semibold uppercase tracking-wide text-emerald-800 dark:border-emerald-900 dark:bg-emerald-950/40 dark:text-emerald-200">
                  Én pris per kjede
                </span>
              </div>

              <div className="mt-4 rounded-2xl border border-slate-200 bg-white px-4 py-3 dark:border-slate-800 dark:bg-slate-950/40">
                <p className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-500 dark:text-slate-400">
                  Prisinnsikt
                </p>
                <div className="mt-3 flex items-end gap-1.5" aria-hidden>
                  <span className="h-4 w-3 rounded-sm bg-emerald-300 dark:bg-emerald-600" />
                  <span className="h-6 w-3 rounded-sm bg-emerald-400 dark:bg-emerald-500" />
                  <span className="h-5 w-3 rounded-sm bg-cyan-400 dark:bg-cyan-500" />
                  <span className="h-8 w-3 rounded-sm bg-cyan-500 dark:bg-cyan-400" />
                  <span className="h-7 w-3 rounded-sm bg-orange-400 dark:bg-orange-500" />
                  <span className="h-9 w-3 rounded-sm bg-orange-500 dark:bg-orange-400" />
                </div>
                <p className="mt-2 text-xs text-slate-500 dark:text-slate-400">Mini-indikator for dagsbevegelser mellom kjedene.</p>
              </div>

              <div className="mt-4 rounded-2xl border border-slate-200 bg-slate-50/90 p-4 dark:border-slate-800 dark:bg-slate-950/60">
                <p className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-500 dark:text-slate-400">
                  Størst sparepotensial akkurat nå
                </p>
                <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                  Prosentforskjell mellom laveste og høyeste kjedepris.
                </p>
                <ul className="mt-3 space-y-2">
                  {heroItemsToRender.map((item) => (
                    <li
                      key={item.name}
                      className="flex items-center justify-between rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-900"
                    >
                      <span className="line-clamp-1 pr-3 text-slate-700 dark:text-slate-200">{item.name}</span>
                      <span className="font-semibold text-emerald-700 dark:text-emerald-300">{item.percentLabel}</span>
                    </li>
                  ))}
                </ul>
              </div>

              <div className="mt-4 rounded-2xl border border-cyan-200 bg-cyan-50 px-4 py-3 text-sm text-cyan-900 dark:border-cyan-900 dark:bg-cyan-950/30 dark:text-cyan-200">
                Prisobservasjoner siste 72 timer: <strong>{observations72h.toLocaleString("nb-NO")}</strong>
              </div>
            </div>
          </aside>
        </div>
      </section>

      <section className="mt-12 rounded-3xl border border-slate-200 bg-white/90 p-6 shadow-sm dark:border-slate-800 dark:bg-slate-900/80 md:p-8">
        <header className="mb-6 space-y-2">
          <h2 className="display-font text-3xl font-bold tracking-tight text-slate-900 dark:text-slate-100">
            Hvordan fungerer Billigkurven?
          </h2>
          <p className="max-w-3xl text-sm text-slate-600 dark:text-slate-300">
            Enklere oversikt over kjedepriser, bygget for norske dagligvarer.
          </p>
        </header>

        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          {[
            "Vi henter priser fra norske dagligvarekjeder.",
            "Vi analyserer prisene nasjonalt per kjede.",
            "Du ser hvilken kjede som er billigst - helt gratis.",
            "Valgfritt: Få prisvarsler når varer du følger endrer pris.",
          ].map((step, index) => (
            <article key={step} className="rounded-2xl border border-slate-200 bg-slate-50/80 p-4 dark:border-slate-700 dark:bg-slate-950/50">
              <p className="text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">Steg {index + 1}</p>
              <p className="mt-2 text-sm font-medium leading-relaxed text-slate-800 dark:text-slate-100">{step}</p>
            </article>
          ))}
        </div>

        <div className="mt-6 grid gap-4 lg:grid-cols-[1.15fr_0.85fr]">
          <article className="rounded-2xl border border-cyan-200 bg-cyan-50/80 p-5 dark:border-cyan-900 dark:bg-cyan-950/25">
            <p className="text-xs font-semibold uppercase tracking-wide text-cyan-700 dark:text-cyan-300">Datakilder</p>
            <p className="mt-2 text-sm leading-relaxed text-cyan-900 dark:text-cyan-100">
              Vi viser alltid grunnlaget for prisbildet: oppdateringsfrekvens, antall observasjoner og hvilke kjeder som er med i sammenligningen.
            </p>
          </article>

          <article className="rounded-2xl border border-slate-200 bg-white p-5 dark:border-slate-700 dark:bg-slate-900">
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">Kjedene vi overvåker</p>
            <div className="mt-3 grid grid-cols-2 gap-2">
              {[
                { name: "REMA 1000", tone: "bg-red-50 text-red-700 dark:bg-red-950/30 dark:text-red-200" },
                { name: "KIWI", tone: "bg-emerald-50 text-emerald-700 dark:bg-emerald-950/30 dark:text-emerald-200" },
                { name: "COOP", tone: "bg-cyan-50 text-cyan-700 dark:bg-cyan-950/30 dark:text-cyan-200" },
                { name: "MENY", tone: "bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-200" },
              ].map((chain) => (
                <div key={chain.name} className={`rounded-xl border border-slate-200 px-3 py-2 text-center text-xs font-semibold dark:border-slate-700 ${chain.tone}`}>
                  {chain.name}
                </div>
              ))}
            </div>
          </article>
        </div>
      </section>

      <section className="mt-10 fade-rise-delayed">
        <SectionImpression sectionId="home-estimator" eventProps={{ variant, location: "home" }} />
        <div id="home-estimator">
          <SavingsEstimator />
        </div>
      </section>

      <section id="home-why-different" className="mt-16 fade-rise-delayed">
        <SectionImpression sectionId="home-why-different" eventProps={{ variant, location: "home" }} />
        <header className="mb-5">
          <h2 className="display-font text-3xl font-bold tracking-tight text-slate-900 dark:text-slate-100">
            Hvorfor Billigkurven skiller seg ut
          </h2>
        </header>
        <div className="grid gap-4 md:grid-cols-3">
          {differentiationCards.map((card) => {
            const Icon = card.icon;

            return (
              <article
                key={card.title}
                className="group flex h-full flex-col rounded-2xl border border-slate-200/90 bg-white/95 p-5 shadow-sm shadow-slate-900/5 ring-1 ring-white/80 transition duration-300 hover:-translate-y-0.5 hover:shadow-md dark:border-slate-800 dark:bg-slate-900/85 dark:ring-slate-800"
              >
                <span className={`inline-flex h-11 w-11 items-center justify-center rounded-xl bg-white shadow-sm ring-1 ${card.ringTone} dark:bg-slate-900`}>
                  <Icon className={`h-5 w-5 ${card.iconTone}`} aria-hidden />
                </span>
                <h3 className="mt-3 text-base font-semibold text-slate-900 dark:text-slate-100">{card.title}</h3>
                <p className="mt-2 text-sm leading-relaxed text-slate-600 dark:text-slate-300">{card.description}</p>
              </article>
            );
          })}
        </div>
      </section>

      <section className="mt-16">
        <SectionImpression sectionId="home-live-insights" eventProps={{ variant, location: "home" }} />
        <header className="mb-5">
          <h2 className="display-font text-3xl font-bold tracking-tight text-slate-900 dark:text-slate-100">
            Hvem er billigst i dag?
          </h2>
          <p className="mt-2 text-sm text-slate-500 dark:text-slate-400">
            Konkrete signaler fra dagens kjedesammenligning.
          </p>
        </header>
        <div className="grid gap-4 md:grid-cols-3">
          {liveStatusExamples.map((item) => {
            const Icon = item.icon;

            return (
              <article key={item.title} className={`rounded-2xl border p-4 shadow-sm ${item.tone}`}>
                <span className="inline-flex items-center gap-2 rounded-full border border-current/20 bg-white/70 px-2.5 py-1 text-[11px] font-semibold uppercase tracking-wide dark:bg-slate-900/40">
                  <SparklesIcon className="h-3.5 w-3.5" aria-hidden />
                  Live
                </span>
                <div className="mt-3 flex items-start gap-2.5">
                  <Icon className="mt-0.5 h-5 w-5" aria-hidden />
                  <div>
                    <p className="text-sm font-semibold leading-snug">{item.title}</p>
                    <p className="mt-1 text-xs opacity-85">{item.detail}</p>
                  </div>
                </div>
              </article>
            );
          })}
        </div>
      </section>

      <section className="mt-16">
        <header className="mb-6 flex items-center justify-between gap-3">
          <div>
            <h2 className="display-font text-3xl font-bold tracking-tight text-slate-900 dark:text-slate-100">
              Produkter vi overvåker
            </h2>
            <p className="mt-1.5 text-sm text-slate-500 dark:text-slate-400">
              {productCount.toLocaleString("nb-NO")} produkter i databasen. Her er et utvalg med tydelige kjedesignaler.
            </p>
          </div>
          <Link href="/shopping-list" className="text-sm font-semibold text-emerald-700 hover:underline dark:text-emerald-300">
            Gå til handleliste
          </Link>
        </header>
        <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {products.map((product, index) => {
            const signal = productChangeSignals[index % productChangeSignals.length];
            const isDown = signal.tone === "down";
            const hasConfidentImage = isLikelyImageForProduct(product.imageUrl, {
              name: product.name,
              brand: product.brand,
              ean: product.ean,
            });

            return (
              <article
                key={product.id}
                className="group flex h-full flex-col overflow-hidden rounded-2xl border border-slate-200/90 bg-white shadow-sm transition duration-300 hover:-translate-y-0.5 hover:shadow-lg dark:border-slate-800 dark:bg-slate-900"
              >
                <div className="relative aspect-[16/11] overflow-hidden border-b border-slate-200 bg-gradient-to-br from-slate-100 to-slate-50 dark:border-slate-800 dark:from-slate-900 dark:to-slate-950">
                  {hasConfidentImage ? (
                    <Image
                      src={product.imageUrl!}
                      alt={product.name}
                      fill
                      sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 33vw"
                      className="absolute inset-0 h-full w-full object-contain bg-white/70 p-2"
                      loading="lazy"
                    />
                  ) : (
                    <div className="absolute inset-0 flex items-center justify-center bg-gradient-to-br from-slate-100 to-slate-50 text-xs font-medium text-slate-500 dark:from-slate-900 dark:to-slate-950 dark:text-slate-400">
                      Bilde under kvalitetssjekk
                    </div>
                  )}
                  {hasConfidentImage ? (
                    <div
                      className="absolute inset-0 bg-[radial-gradient(circle_at_30%_22%,rgba(16,185,129,0.24),transparent_56%)]"
                      aria-hidden
                    />
                  ) : null}
                  <div className="absolute right-3 top-3 rounded-full bg-white/95 px-2.5 py-1 text-[11px] font-semibold text-slate-700 shadow-sm dark:bg-slate-900/95 dark:text-slate-200">
                    {product.category}
                  </div>
                  <div
                    className={`absolute left-3 top-3 inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-[11px] font-semibold shadow-sm ${
                      isDown
                        ? "bg-emerald-100 text-emerald-800 dark:bg-emerald-900/60 dark:text-emerald-100"
                        : "bg-rose-100 text-rose-800 dark:bg-rose-900/60 dark:text-rose-100"
                    }`}
                  >
                    {isDown ? (
                      <ArrowTrendingDownIcon className="h-3.5 w-3.5" aria-hidden />
                    ) : (
                      <ArrowTrendingUpIcon className="h-3.5 w-3.5" aria-hidden />
                    )}
                    {signal.label}
                  </div>
                </div>

                <div className="flex flex-1 flex-col justify-between p-5">
                  <div className="space-y-2.5">
                    <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
                      {product.brand}
                    </p>
                    <h3 className="line-clamp-2 text-lg font-semibold leading-snug text-slate-900 dark:text-slate-100">
                      {product.name}
                    </h3>
                    <p className="text-base font-semibold text-emerald-700 dark:text-emerald-300">
                      {product.prices[0]
                        ? `${Number(product.prices[0].price).toFixed(2).replace(".", ",")} kr`
                        : product.ean}
                    </p>
                    <p className="inline-flex w-fit items-center gap-1 rounded-full border border-cyan-200 bg-cyan-50 px-2.5 py-1 text-xs font-semibold text-cyan-800 dark:border-cyan-900 dark:bg-cyan-950/40 dark:text-cyan-200">
                      Billigst hos: Kjede i dagens måling
                    </p>
                    <p className="inline-flex w-fit items-center gap-1 rounded-full border border-emerald-200 bg-emerald-50 px-2.5 py-1 text-xs font-semibold text-emerald-800 dark:border-emerald-900 dark:bg-emerald-950/40 dark:text-emerald-200">
                      <CheckCircleIcon className="h-3.5 w-3.5" aria-hidden />
                      Du sparer {signal.weeklySavings} kr vs snittpris
                    </p>
                    <div className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 dark:border-slate-700 dark:bg-slate-950/40">
                      <p className="text-[11px] font-medium uppercase tracking-wide text-slate-500 dark:text-slate-400">30-dagers trend</p>
                      <div className="mt-2 flex items-end gap-1" aria-hidden>
                        <span className="h-2 w-2 rounded-sm bg-emerald-300 dark:bg-emerald-600" />
                        <span className="h-3 w-2 rounded-sm bg-emerald-400 dark:bg-emerald-500" />
                        <span className="h-4 w-2 rounded-sm bg-cyan-400 dark:bg-cyan-500" />
                        <span className="h-3 w-2 rounded-sm bg-cyan-500 dark:bg-cyan-400" />
                        <span className="h-5 w-2 rounded-sm bg-emerald-500 dark:bg-emerald-400" />
                        <span className="h-4 w-2 rounded-sm bg-orange-400 dark:bg-orange-500" />
                        <span className="h-6 w-2 rounded-sm bg-orange-500 dark:bg-orange-400" />
                        <span className="h-5 w-2 rounded-sm bg-emerald-500 dark:bg-emerald-400" />
                      </div>
                    </div>
                  </div>
                  <div className="mt-5">
                    <Link href={`/product/${product.id}`} className="text-sm font-semibold text-emerald-700 hover:underline dark:text-emerald-300">
                      Se produkt
                    </Link>
                  </div>
                </div>
              </article>
            );
          })}
        </div>
      </section>

      <section className="mt-16 rounded-3xl border border-slate-200 bg-white/90 p-6 shadow-sm dark:border-slate-800 dark:bg-slate-900/80 md:p-8">
        <header className="mb-6">
          <h2 className="display-font text-3xl font-bold tracking-tight text-slate-900 dark:text-slate-100">
            Brukes av norske familier som vil kutte matbudsjettet
          </h2>
        </header>

        <div className="grid gap-4 md:grid-cols-3">
          <article className="rounded-2xl border border-slate-200 bg-slate-50/80 p-5 dark:border-slate-700 dark:bg-slate-950/50">
            <p className="text-xs uppercase tracking-wide text-slate-500 dark:text-slate-400">Brukes av</p>
            <p className="mt-2 text-3xl font-bold text-slate-900 dark:text-slate-100">24 300</p>
            <p className="text-sm text-slate-600 dark:text-slate-300">nordmenn bruker Billigkurven</p>
          </article>
          <article className="rounded-2xl border border-slate-200 bg-slate-50/80 p-5 dark:border-slate-700 dark:bg-slate-950/50">
            <p className="text-xs uppercase tracking-wide text-slate-500 dark:text-slate-400">Sparer i snitt</p>
            <p className="mt-2 text-3xl font-bold text-slate-900 dark:text-slate-100">845 kr</p>
            <p className="text-sm text-slate-600 dark:text-slate-300">spart per måned i snitt</p>
          </article>
          <article className="rounded-2xl border border-slate-200 bg-slate-50/80 p-5 dark:border-slate-700 dark:bg-slate-950/50">
            <p className="text-xs uppercase tracking-wide text-slate-500 dark:text-slate-400">Typisk bruker</p>
            <p className="mt-2 text-lg font-semibold text-slate-900 dark:text-slate-100">Småbarnsfamilier</p>
            <p className="text-sm text-slate-600 dark:text-slate-300">handler 1-2 ganger i uken</p>
          </article>
        </div>

        <div className="mt-6 grid gap-4 md:grid-cols-3">
          {[
            {
              quote: "Vi sparte 420 kr første uken med Billigkurven.",
              person: "Maria og Jonas, Oslo",
              initials: "👩‍🦱",
            },
            {
              quote: "Endelig oversikt over hvilken kjede som faktisk er billigst.",
              person: "Ahmed, Trondheim",
              initials: "🧑",
            },
            {
              quote: "Vi handler smartere uten å bruke ekstra tid på planlegging.",
              person: "Silje, Bergen",
              initials: "👩",
            },
          ].map((item) => (
            <article key={item.person} className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-700 dark:bg-slate-900">
              <div className="mb-3 inline-flex h-10 w-10 items-center justify-center rounded-full border border-slate-200 bg-slate-50 text-base font-semibold tracking-wide text-slate-700 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200">
                {item.initials}
              </div>
              <p className="text-sm leading-relaxed text-slate-700 dark:text-slate-200">&quot;{item.quote}&quot;</p>
              <p className="mt-3 text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
                {item.person}
              </p>
            </article>
          ))}
        </div>
      </section>

      <section className="mt-16 rounded-3xl border border-slate-200 bg-white/90 p-6 shadow-sm dark:border-slate-800 dark:bg-slate-900/80 md:p-8">
        <header className="mb-5">
          <h2 className="display-font text-3xl font-bold tracking-tight text-slate-900 dark:text-slate-100">
            Hvorfor Billigkurven?
          </h2>
        </header>

        <div className="overflow-hidden rounded-2xl border border-slate-200 dark:border-slate-700">
          <table className="w-full text-sm">
            <thead className="bg-slate-50 dark:bg-slate-800/70">
              <tr>
                <th className="px-4 py-3 text-left font-semibold text-slate-700 dark:text-slate-200">Funksjon</th>
                <th className="px-4 py-3 text-left font-semibold text-emerald-700 dark:text-emerald-300">Billigkurven (✔)</th>
                <th className="px-4 py-3 text-left font-semibold text-slate-500 dark:text-slate-400">Konkurrenter (✖)</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200 dark:divide-slate-700">
              {[
                "Live prisendringer",
                "Nasjonale kjedepriser",
                "Prisvarsler",
                "Datatransparens",
                "Ingen konto nødvendig",
              ].map((row) => (
                <tr key={row} className="bg-white dark:bg-slate-900">
                  <td className="px-4 py-3 font-medium text-slate-800 dark:text-slate-100">{row}</td>
                  <td className="px-4 py-3 text-emerald-700 dark:text-emerald-300">✔</td>
                  <td className="px-4 py-3 text-slate-500 dark:text-slate-400">✖</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <section className="mt-14">
        <SectionImpression sectionId="home-transparency" eventProps={{ variant, location: "home" }} />
        <div className="rounded-3xl border border-slate-200 bg-white/90 p-6 shadow-sm dark:border-slate-800 dark:bg-slate-900/80 md:p-8">
          <header className="mb-5">
            <h2 className="display-font text-3xl font-bold tracking-tight text-slate-900 dark:text-slate-100">
              Hvorfor du kan stole på oss
            </h2>
          </header>

          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            <article className="rounded-2xl border border-emerald-200 bg-emerald-50/90 p-4 dark:border-emerald-900 dark:bg-emerald-950/25">
              <p className="text-xs font-semibold uppercase tracking-wide text-emerald-700 dark:text-emerald-300">
                Ferske priser siste 24t
              </p>
              <p className="mt-2 text-2xl font-bold text-emerald-900 dark:text-emerald-100">
                {transparencyMetrics.freshPrices24h.toLocaleString("nb-NO")}
              </p>
            </article>

            <article className="rounded-2xl border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900">
              <p className="text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
                Kilder i bruk
              </p>
              <p className="mt-2 text-2xl font-bold text-slate-900 dark:text-slate-100">
                {transparencyMetrics.sourceDiversity.toLocaleString("nb-NO")}
              </p>
            </article>

            <article className="rounded-2xl border border-cyan-200 bg-cyan-50/90 p-4 dark:border-cyan-900 dark:bg-cyan-950/25">
              <p className="text-xs font-semibold uppercase tracking-wide text-cyan-700 dark:text-cyan-300">
                Verifiserte kvitteringer
              </p>
              <p className="mt-2 text-2xl font-bold text-cyan-900 dark:text-cyan-100">
                {transparencyMetrics.verifiedReceipts.toLocaleString("nb-NO")}
              </p>
            </article>

            <article className="rounded-2xl border border-amber-200 bg-amber-50/90 p-4 dark:border-amber-900 dark:bg-amber-950/25">
              <p className="text-xs font-semibold uppercase tracking-wide text-amber-700 dark:text-amber-300">
                Filtrert bort (kvalitetskontroll)
              </p>
              <p className="mt-2 text-2xl font-bold text-amber-900 dark:text-amber-100">
                {transparencyMetrics.quarantinedRows.toLocaleString("nb-NO")}
              </p>
            </article>
          </div>
        </div>
      </section>

      <section className="mt-16 rounded-3xl border border-emerald-200 bg-gradient-to-br from-emerald-50 via-white to-cyan-50 p-6 shadow-sm dark:border-emerald-900 dark:from-slate-900 dark:via-slate-900 dark:to-emerald-950/20 md:p-8">
        <header className="mb-5 flex items-center justify-between gap-3">
          <div>
            <h2 className="display-font text-2xl font-bold tracking-tight text-slate-900 dark:text-slate-100">
              Klar for å kutte matbudsjettet smartere?
            </h2>
            <p className="mt-1 text-sm text-slate-600 dark:text-slate-300">
              Start med kjedesammenligning og få et konkret svar med en gang.
            </p>
          </div>
          <TrackedLink
            href="/compare"
            eventName="home_final_cta_clicked"
            eventProps={{ variant, location: "home_bottom_cta" }}
            className="inline-flex items-center justify-center rounded-2xl bg-orange-500 px-6 py-3 text-sm font-semibold text-white shadow-lg shadow-orange-700/35 transition hover:bg-orange-400"
          >
            Se billigste kjede i dag
          </TrackedLink>
        </header>
      </section>

      <div className="fixed inset-x-0 bottom-3 z-40 px-4 sm:hidden">
        <TrackedLink
          href="/compare"
          eventName="home_sticky_mobile_cta_clicked"
          eventProps={{ variant, location: "home_mobile_sticky" }}
          className="inline-flex w-full items-center justify-center rounded-2xl bg-orange-500 px-5 py-3.5 text-sm font-semibold text-white shadow-sm ring-1 ring-orange-400/60"
        >
          Se billigste kjede i dag
        </TrackedLink>
      </div>
    </main>
  );
}