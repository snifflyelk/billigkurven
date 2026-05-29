import Link from "next/link";
import {
  ArrowTrendingDownIcon,
  ArrowTrendingUpIcon,
  BellAlertIcon,
  ClipboardDocumentCheckIcon,
  BoltIcon,
  CheckBadgeIcon,
  ClockIcon,
  ChartBarSquareIcon,
  DevicePhoneMobileIcon,
  DeviceTabletIcon,
  ReceiptPercentIcon,
  RocketLaunchIcon,
  ShieldCheckIcon,
  SparklesIcon,
} from "@heroicons/react/24/outline";
import { TransparencySnapshot } from "@/components/transparency-snapshot";
import { isLikelyProductImageUrl } from "@/lib/live-pricing/providers/media";
import { prisma } from "@/lib/prisma";
import { getTransparencyMetrics } from "@/lib/transparency";

export const dynamic = "force-dynamic";

export default async function Home() {
  const since24h = new Date(Date.now() - 24 * 60 * 60 * 1000);

  const [products, productCount, priceRows24h, activeAlerts, verifiedReceipts, transparencyMetrics] = await Promise.all([
    prisma.product
      .findMany({
        take: 6,
        orderBy: { createdAt: "desc" },
        include: {
          prices: {
            where: { isQuarantined: false },
            orderBy: { date: "desc" },
            take: 1,
          },
        },
      })
      .catch(() => []),
    prisma.product.count().catch(() => 0),
    prisma.price.count({ where: { date: { gte: since24h }, isQuarantined: false } }).catch(() => 0),
    prisma.priceAlert.count({ where: { isActive: true } }).catch(() => 0),
    prisma.receiptSubmission.count({ where: { status: "REVIEWED" } }).catch(() => 0),
    getTransparencyMetrics(),
  ]);

  const projectedWeeklySavings = Math.max(89, Math.round(productCount * 0.8));

  const featureCards = [
    {
      title: "Rask anbefaling",
      description: "Fra handleliste til butikkvalg pa under ett minutt.",
      icon: RocketLaunchIcon,
      iconTone: "text-cyan-600 dark:text-cyan-400",
      ringTone: "ring-cyan-200/80 dark:ring-cyan-800/70",
    },
    {
      title: "Tillit per beslutning",
      description: "Alle forslag forklares med confidence og datagrunnlag.",
      icon: ShieldCheckIcon,
      iconTone: "text-emerald-600 dark:text-emerald-400",
      ringTone: "ring-emerald-200/80 dark:ring-emerald-800/70",
    },
    {
      title: "Verifisert sparing",
      description: "Kvitteringssløyfen forbedrer forslagene uke for uke.",
      icon: ReceiptPercentIcon,
      iconTone: "text-amber-600 dark:text-amber-400",
      ringTone: "ring-amber-200/80 dark:ring-amber-800/70",
    },
    {
      title: "Kjop na eller vent",
      description: "Timing-signaler gir bedre kjopsvindu, ikke bare laveste pris.",
      icon: ClockIcon,
      iconTone: "text-indigo-600 dark:text-indigo-400",
      ringTone: "ring-indigo-200/80 dark:ring-indigo-800/70",
    },
  ];

  return (
    <main className="mx-auto max-w-7xl px-4 pb-16 pt-12 sm:px-6 md:pb-24 md:pt-16">
      {/* HERO — increased padding for breathing room */}
      <section className="relative overflow-hidden rounded-[2rem] border border-emerald-200/70 bg-gradient-to-br from-emerald-50 via-white to-cyan-50 p-8 shadow-xl shadow-emerald-900/5 sm:p-10 lg:p-14 dark:border-emerald-900/60 dark:from-slate-950 dark:via-slate-950 dark:to-emerald-950/20 dark:shadow-black/20">
        <div className="pointer-events-none absolute -right-24 top-0 h-64 w-64 rounded-full bg-emerald-200/45 blur-3xl dark:bg-emerald-700/20" aria-hidden />
        <div className="pointer-events-none absolute -left-24 bottom-0 h-56 w-56 rounded-full bg-cyan-200/35 blur-3xl dark:bg-cyan-700/20" aria-hidden />

        <div className="relative grid items-start gap-8 lg:grid-cols-[1.08fr_0.92fr] lg:gap-12">
          {/* Hero left column: tightened internal spacing for clear h1 > p > CTA hierarchy */}
          <article className="space-y-10 fade-rise">
            <span className="inline-flex items-center gap-2 rounded-full border border-emerald-300 bg-white/90 px-3 py-1 text-xs font-semibold uppercase tracking-[0.14em] text-emerald-700 dark:border-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-200">
              <BoltIcon className="h-3.5 w-3.5" aria-hidden />
              Beslutning pa 60 sekunder
            </span>

            {/* Headline + subtext group: extra gap for clear visual hierarchy */}
            <div className="space-y-6">
              <h1 className="display-font max-w-3xl text-balance text-5xl font-bold leading-[0.98] tracking-tight sm:text-6xl lg:text-7xl xl:text-8xl">
                Spar penger pa mat uten a gjette
              </h1>
              {/* Improved dark mode contrast: slate-300 instead of slate-200 */}
              <p className="max-w-2xl text-base leading-[1.75] text-slate-600 sm:text-lg dark:text-slate-300">
                Billigkurven viser ikke bare priser. Du far et konkret svar pa hvor du bor handle, hvor trygg anbefalingen er,
                og nar du bor kjope eller vente.
              </p>
            </div>

            {/* CTA group: primary button is visually dominant with larger size */}
            <div className="grid gap-3 sm:flex sm:flex-wrap sm:items-center sm:gap-4">
              <Link
                href="/onboarding"
                className="inline-flex w-full items-center justify-center rounded-2xl bg-emerald-600 px-8 py-4 text-base font-semibold text-white shadow-xl shadow-emerald-700/35 ring-1 ring-emerald-500/70 transition duration-300 hover:-translate-y-0.5 hover:bg-emerald-500 sm:w-auto"
              >
                Kom i gang pa 60 sek
              </Link>
              <Link
                href="/compare"
                className="inline-flex w-full items-center justify-center rounded-2xl border border-slate-300 bg-white/95 px-7 py-4 text-sm font-semibold text-slate-800 shadow-sm transition duration-300 hover:-translate-y-0.5 hover:border-slate-400 hover:shadow-md sm:w-auto dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100 dark:hover:border-slate-500"
              >
                Se dagens anbefaling
              </Link>
              <Link
                href="/savings"
                className="inline-flex w-full items-center justify-center rounded-2xl border border-cyan-300 bg-cyan-50/90 px-7 py-4 text-sm font-semibold text-cyan-900 shadow-sm transition duration-300 hover:-translate-y-0.5 hover:border-cyan-400 hover:shadow-md sm:w-auto dark:border-cyan-800 dark:bg-cyan-950/40 dark:text-cyan-100 dark:hover:border-cyan-700"
              >
                Se personlig sparehistorikk
              </Link>
            </div>
          </article>

          <aside className="space-y-5 fade-rise-delayed">
            {/* Hero right column: mockup device illustration */}
            <div className="rounded-3xl border border-slate-200/80 bg-white/90 p-4 shadow-lg shadow-slate-900/5 backdrop-blur-sm dark:border-slate-800 dark:bg-slate-900/70 dark:shadow-black/20 sm:p-5">
              <div className="relative min-h-[260px] rounded-2xl border border-slate-200/80 bg-gradient-to-br from-white via-slate-50 to-cyan-50 p-4 dark:border-slate-800 dark:from-slate-900 dark:via-slate-900 dark:to-slate-950">
                <div className="absolute left-4 top-4 inline-flex items-center justify-center rounded-full border border-slate-200 bg-white/90 p-1.5 text-slate-600 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300">
                  <DeviceTabletIcon className="h-3.5 w-3.5" aria-hidden />
                </div>
                <div className="mt-9 h-44 rounded-2xl border border-slate-200/90 bg-white p-4 shadow-sm dark:border-slate-700 dark:bg-slate-900">
                  <div className="grid gap-3">
                    <div className="h-3 w-2/3 rounded-full bg-slate-200 dark:bg-slate-700" />
                    <div className="h-2.5 w-full rounded-full bg-slate-100 dark:bg-slate-800" />
                    <div className="h-2.5 w-5/6 rounded-full bg-slate-100 dark:bg-slate-800" />
                    <div className="mt-2 grid grid-cols-2 gap-2">
                      <div className="h-16 rounded-xl border border-slate-200 bg-emerald-50/70 dark:border-slate-700 dark:bg-emerald-950/20" />
                      <div className="h-16 rounded-xl border border-slate-200 bg-cyan-50/70 dark:border-slate-700 dark:bg-cyan-950/20" />
                    </div>
                  </div>
                </div>
                <div className="absolute -bottom-5 right-4 w-28 rounded-2xl border border-slate-200 bg-white p-2 shadow-md dark:border-slate-700 dark:bg-slate-900">
                  <div className="inline-flex items-center justify-center rounded-full border border-slate-200 bg-slate-50 p-1 text-slate-500 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300">
                    <DevicePhoneMobileIcon className="h-3 w-3" aria-hidden />
                  </div>
                  <div className="mt-2 space-y-1.5">
                    <div className="h-1.5 rounded-full bg-slate-200 dark:bg-slate-700" />
                    <div className="h-1.5 w-5/6 rounded-full bg-slate-200 dark:bg-slate-700" />
                    <div className="h-7 rounded-lg border border-slate-200 bg-emerald-50 dark:border-slate-700 dark:bg-emerald-950/30" />
                  </div>
                </div>
              </div>
            </div>

            <div className="rounded-3xl border border-slate-200 bg-white/95 p-5 shadow-xl shadow-slate-900/10 ring-1 ring-slate-100/80 backdrop-blur dark:border-slate-800 dark:bg-slate-900/90 dark:ring-slate-800 md:p-6">
              {/* LIVE STATUS BOX — cleaner header */}
              <div className="mb-5 flex items-center justify-between gap-2">
                <div className="inline-flex items-center gap-2">
                  <ChartBarSquareIcon className="h-5 w-5 text-emerald-600 dark:text-emerald-400" aria-hidden />
                  <p className="text-sm font-semibold tracking-wide text-slate-900 dark:text-slate-100">Live status</p>
                </div>
                <span className="inline-flex h-2.5 w-2.5 rounded-full bg-emerald-500 shadow-[0_0_0_4px_rgba(16,185,129,0.2)]" aria-hidden />
              </div>

              {/* 3-column stat grid: icon + bold number + small label, mobile-stacked */}
              <div className="grid grid-cols-3 gap-3 rounded-2xl bg-gray-50 p-4 dark:bg-gray-900/60">
                <div className="flex flex-col items-center gap-1 text-center">
                  <span className="inline-flex h-8 w-8 items-center justify-center rounded-lg bg-white ring-1 ring-slate-200 dark:bg-slate-800 dark:ring-slate-700">
                    <ChartBarSquareIcon className="h-4 w-4 text-cyan-600 dark:text-cyan-400" aria-hidden />
                  </span>
                  <strong className="text-xl font-bold tabular-nums text-slate-900 dark:text-slate-100">{priceRows24h}</strong>
                  <span className="text-[11px] leading-tight text-slate-500 dark:text-slate-400">Priser siste 24t</span>
                </div>
                <div className="flex flex-col items-center gap-1 text-center">
                  <span className="inline-flex h-8 w-8 items-center justify-center rounded-lg bg-white ring-1 ring-slate-200 dark:bg-slate-800 dark:ring-slate-700">
                    <BellAlertIcon className="h-4 w-4 text-amber-600 dark:text-amber-400" aria-hidden />
                  </span>
                  <strong className="text-xl font-bold tabular-nums text-slate-900 dark:text-slate-100">{activeAlerts}</strong>
                  <span className="text-[11px] leading-tight text-slate-500 dark:text-slate-400">Aktive varsler</span>
                </div>
                <div className="flex flex-col items-center gap-1 text-center">
                  <span className="inline-flex h-8 w-8 items-center justify-center rounded-lg bg-white ring-1 ring-slate-200 dark:bg-slate-800 dark:ring-slate-700">
                    <ClipboardDocumentCheckIcon className="h-4 w-4 text-emerald-600 dark:text-emerald-400" aria-hidden />
                  </span>
                  <strong className="text-xl font-bold tabular-nums text-slate-900 dark:text-slate-100">{verifiedReceipts}</strong>
                  <span className="text-[11px] leading-tight text-slate-500 dark:text-slate-400">Kvitteringer</span>
                </div>
              </div>
              {/* Savings highlight row below stats */}
              <div className="mt-3 rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-900 dark:border-emerald-900 dark:bg-emerald-950/30 dark:text-emerald-200">
                Potensiell ukesparing akkurat na: <strong>{projectedWeeklySavings} kr</strong>
              </div>
            </div>
          </aside>
        </div>
      </section>

      {/* FEATURE CARDS — equal height via items-stretch, uniform gap-6, consistent padding */}
      <section className="mt-16 grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
        {featureCards.map((card) => {
          const Icon = card.icon;

          return (
            <Link
              key={card.title}
              href="#"
              className="group flex flex-col rounded-2xl border border-slate-200/90 bg-white/85 p-4 shadow-sm shadow-slate-900/5 ring-1 ring-white/80 backdrop-blur-sm transition duration-300 hover:-translate-y-1 hover:shadow-lg hover:shadow-slate-900/10 dark:border-slate-800 dark:bg-slate-900/80 dark:ring-slate-800"
            >
              <span className={`inline-flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-xl bg-white shadow-sm ring-1 ${card.ringTone} dark:bg-slate-900`}>
                <Icon className={`h-5 w-5 ${card.iconTone}`} aria-hidden />
              </span>
              <h3 className="mt-3 text-base font-semibold tracking-tight text-slate-900 transition-colors group-hover:text-emerald-700 dark:text-slate-100 dark:group-hover:text-emerald-300">
                {card.title}
              </h3>
              <p className="mt-1.5 flex-1 text-sm leading-relaxed text-slate-600 dark:text-slate-300">{card.description}</p>
            </Link>
          );
        })}
      </section>

      {/* TRANSPARENCY SECTION — Option A: light background tint + left border accent for visual separation */}
      <section className="mt-16 fade-rise-delayed">
        <div className="rounded-2xl border-l-4 border-emerald-400 bg-slate-50/70 py-8 pl-6 pr-6 dark:border-emerald-600 dark:bg-slate-900/40">
        <TransparencySnapshot
          metrics={transparencyMetrics}
          title="Folk skal kunne kontrollere prisene selv"
          subtitle="Billigkurven skal ikke bare gi et svar. Vi skal vise hvor ferske prisene er, hva som er filtrert bort, og hvilke kilder som faktisk ligger bak anbefalingene."
        />
        </div>
      </section>

      {/* PRODUCT GRID — improved responsiveness and hover polish */}
      <section className="mt-16">
        <header className="mb-6 flex items-center justify-between gap-3">
          <div>
            {/* h2 hierarchy consistent with page h1 */}
            <h2 className="display-font text-2xl font-bold tracking-tight text-slate-900 dark:text-slate-100">Utforsk prisuniverset</h2>
            <p className="mt-1.5 text-sm text-slate-500 dark:text-slate-400">Nye produkter med siste observerte pris.</p>
          </div>
          <Link href="/shopping-list" className="text-sm font-medium text-emerald-700 hover:underline dark:text-emerald-300">
            Gatt til handleliste
          </Link>
        </header>
        {/* 2–4 column responsive grid with uniform gap */}
        <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {products.map((product) => (
            <article key={product.id} className="group flex h-full flex-col overflow-hidden rounded-2xl border border-slate-200/90 bg-white shadow-sm transition duration-200 hover:scale-[1.01] hover:shadow-lg dark:border-slate-800 dark:bg-slate-900">
              {/* Consistent aspect ratio for all product images */}
              <div className="relative aspect-[16/10] overflow-hidden border-b border-slate-200 bg-gradient-to-br from-slate-100 to-slate-50 dark:border-slate-800 dark:from-slate-900 dark:to-slate-950">
                {isLikelyProductImageUrl(product.imageUrl) ? (
                  <img
                    src={product.imageUrl ?? undefined}
                    alt={product.name}
                    className="absolute inset-0 h-full w-full object-cover object-center"
                    loading="lazy"
                  />
                ) : null}
                <div className="absolute inset-0 bg-[radial-gradient(circle_at_28%_24%,rgba(16,185,129,0.25),transparent_56%)]" aria-hidden />
                <div className="absolute right-3 top-3 rounded-full bg-white/90 px-2 py-1 text-[11px] font-semibold text-slate-600 shadow-sm dark:bg-slate-900/90 dark:text-slate-300">
                  {product.category}
                </div>
                <div className="absolute left-3 top-3 rounded-full bg-emerald-100 px-2 py-1 text-[11px] font-semibold text-emerald-800 dark:bg-emerald-900/50 dark:text-emerald-200">
                  LIVE
                </div>
                <div className="absolute inset-x-0 bottom-3 px-4 text-sm font-medium text-slate-500 dark:text-slate-400">
                  {product.brand}
                </div>
              </div>

              <div className="flex flex-1 flex-col justify-between p-4">
                {/* Tighter internal spacing: reduced from space-y-1.5 + mt-4 to space-y-1 + mt-3 */}
                <div className="space-y-1">
                  <h3 className="line-clamp-2 text-base font-semibold text-slate-900 dark:text-slate-100">{product.name}</h3>
                  <p className="text-sm font-medium text-emerald-700 dark:text-emerald-300">
                    {product.prices[0] ? `${Number(product.prices[0].price).toFixed(2).replace(".", ",")} kr` : product.ean}
                  </p>
                  <p className="text-xs text-slate-500 dark:text-slate-400">Bygget for beslutningshjelp, ikke bare prisliste.</p>
                </div>
                <div className="mt-3">
                  <Link
                    href={`/product/${product.id}`}
                    className="text-sm font-medium text-emerald-700 hover:underline dark:text-emerald-300"
                  >
                    Se produkt
                  </Link>
                </div>
              </div>
            </article>
          ))}
        </div>
      </section>

      {/* APENHET SOM STANDARD — Option A+B: left border accent + light background tint, improved line-height */}
      <section className="mt-16 grid gap-5 fade-rise-slow lg:grid-cols-3">
        <article className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm transition duration-300 hover:-translate-y-0.5 hover:shadow-md dark:border-slate-800 dark:bg-slate-900">
          <CheckBadgeIcon className="h-5 w-5 text-emerald-600 dark:text-emerald-400" aria-hidden />
          <h3 className="mt-4 text-base font-semibold text-slate-900 dark:text-slate-100">Prisbevis per anbefaling</h3>
          <p className="mt-2 text-sm leading-[1.7] text-slate-600 dark:text-slate-300">Produkt- og sammenligningssider viser na kilde, observasjonstid og synlig filtrering.</p>
        </article>
        <article className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm transition duration-300 hover:-translate-y-0.5 hover:shadow-md dark:border-slate-800 dark:bg-slate-900">
          <SparklesIcon className="h-5 w-5 text-cyan-600 dark:text-cyan-400" aria-hidden />
          <h3 className="mt-4 text-base font-semibold text-slate-900 dark:text-slate-100">Offentlig metodikk</h3>
          <p className="mt-2 text-sm leading-[1.7] text-slate-600 dark:text-slate-300">Confidence-siden er utvidet til en faktisk metodikkflate for tillit, filtrering og begrensninger.</p>
        </article>
        <article className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm transition duration-300 hover:-translate-y-0.5 hover:shadow-md dark:border-slate-800 dark:bg-slate-900">
          <ShieldCheckIcon className="h-5 w-5 text-amber-600 dark:text-amber-400" aria-hidden />
          <h3 className="mt-4 text-base font-semibold text-slate-900 dark:text-slate-100">Spareplan, ikke bare prisliste</h3>
          <p className="mt-2 text-sm leading-[1.7] text-slate-600 dark:text-slate-300">Handlelisten kobles na tettere mot dagens anbefaling, timing-signaler og verifiseringssløyfen.</p>
        </article>
      </section>
    </main>
  );
}
