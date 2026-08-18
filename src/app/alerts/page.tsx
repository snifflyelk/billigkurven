import { prisma } from "@/lib/prisma";
import { PriceAlertsPanel } from "@/components/price-alerts-panel";
import { buildAlertUrgency, buildTimingSignal } from "@/lib/alerts/signal";
import { SectionImpression } from "@/components/section-impression";
import { readAlertDigestHistory } from "@/lib/alerts/history";
import { requireAuthenticatedSessionUserId } from "@/lib/user-session";

export const dynamic = "force-dynamic";

export default async function AlertsPage() {
  const currentUserId = await requireAuthenticatedSessionUserId("/alerts");
  const user = await prisma.user.findUnique({ where: { id: currentUserId } }).catch(() => null);

  const [products, priceAlerts, digestHistory] = await Promise.all([
    prisma.product.findMany({
      orderBy: { name: "asc" },
      take: 250,
      select: { id: true, name: true, brand: true },
    }),
    user
      ? prisma.priceAlert.findMany({
          where: { userId: user.id },
          orderBy: [{ isActive: "desc" }, { updatedAt: "desc" }],
          include: {
            product: {
              include: {
                prices: {
                  where: { isQuarantined: false },
                  take: 30,
                  orderBy: { date: "desc" },
                  include: { store: true },
                },
              },
            },
          },
        })
      : [],
    readAlertDigestHistory(6),
  ]);

  const serializedAlerts = priceAlerts.map((alert) => {
    const timing = buildTimingSignal(
      alert.product.prices.map((row) => ({
        price: Number(row.price),
        date: row.date,
      })),
    );
    const latestPrice = alert.product.prices[0] ? Number(alert.product.prices[0].price) : null;
    const urgency = buildAlertUrgency({
      latestPrice,
      targetPrice: alert.targetPrice !== null ? Number(alert.targetPrice) : null,
      targetDropPct: alert.targetDropPct,
      dropFromLast7Pct: timing.dropFromLast7Pct,
      recommendation: timing.recommendation,
    });

    return {
      id: alert.id,
      productId: alert.productId,
      targetPrice: alert.targetPrice !== null ? Number(alert.targetPrice) : null,
      targetDropPct: alert.targetDropPct,
      notifyOnBuyNow: alert.notifyOnBuyNow,
      isActive: alert.isActive,
      updatedAt: alert.updatedAt.toISOString(),
      latestPrice,
      timing,
      urgency,
      product: {
        name: alert.product.name,
        brand: alert.product.brand,
        prices: alert.product.prices.map((price) => ({
          price: Number(price.price),
          store: { name: price.store.name },
        })),
      },
    };
  });

  const activeCount = serializedAlerts.filter((alert) => alert.isActive).length;
  const buyNowEnabledCount = serializedAlerts.filter((alert) => alert.notifyOnBuyNow).length;
  const urgentCount = serializedAlerts.filter((alert) => alert.urgency.level === "hoy").length;
  const priceDropOpportunities = serializedAlerts.filter(
    (alert) => (alert.timing?.dropFromLast7Pct ?? 0) >= (alert.targetDropPct ?? 10),
  ).length;
  const basketSignal =
    urgentCount >= 3
      ? "Høy prioritet: flere nøkkelvarer bør håndteres nå"
      : urgentCount > 0
        ? "Moderat prioritet: enkelte varer nær trigger"
        : "Lav prioritet: ingen sterke kurvsignaler nå";

  return (
    <main className="mx-auto max-w-6xl px-4 py-10 pb-24 md:pb-10">
      <h1 className="text-3xl font-bold tracking-tight">Prisvarsler</h1>
      <p className="mt-2 text-slate-600 dark:text-slate-300">
        Sett målpris og trend-betingelser. Bruk varsler for å fange gode kjøpstidspunkt, ikke bare laveste pris akkurat nå.
      </p>

      <section className="mt-5 grid gap-4 md:grid-cols-4 fade-rise">
        <article className="rounded-2xl border border-emerald-200 bg-emerald-50/80 p-4 dark:border-emerald-900 dark:bg-emerald-950/25">
          <p className="text-xs font-semibold uppercase tracking-wide text-emerald-700 dark:text-emerald-300">Aktive varsler</p>
          <p className="mt-1 text-2xl font-semibold text-emerald-800 dark:text-emerald-200">{activeCount}</p>
        </article>
        <article className="rounded-2xl border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900">
          <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Buy-now aktivert</p>
          <p className="mt-1 text-2xl font-semibold">{buyNowEnabledCount}</p>
        </article>
        <article className="rounded-2xl border border-cyan-200 bg-cyan-50/80 p-4 dark:border-cyan-900 dark:bg-cyan-950/20">
          <p className="text-xs font-semibold uppercase tracking-wide text-cyan-700 dark:text-cyan-300">Overvakede produkter</p>
          <p className="mt-1 text-2xl font-semibold text-cyan-900 dark:text-cyan-100">{serializedAlerts.length}</p>
        </article>
        <article className="rounded-2xl border border-rose-200 bg-rose-50/80 p-4 dark:border-rose-900 dark:bg-rose-950/20">
          <p className="text-xs font-semibold uppercase tracking-wide text-rose-700 dark:text-rose-300">Høy prioritet</p>
          <p className="mt-1 text-2xl font-semibold text-rose-900 dark:text-rose-100">{urgentCount}</p>
        </article>
        <article className="rounded-2xl border border-amber-200 bg-amber-50/80 p-4 dark:border-amber-900 dark:bg-amber-950/20 md:col-span-2">
          <p className="text-xs font-semibold uppercase tracking-wide text-amber-700 dark:text-amber-300">Prisfall muligheter</p>
          <p className="mt-1 text-2xl font-semibold text-amber-900 dark:text-amber-100">{priceDropOpportunities}</p>
          <p className="mt-1 text-xs text-amber-800/80 dark:text-amber-200/80">Varsler der produktet allerede har falt tydelig mot siste 7 dager.</p>
        </article>
      </section>

      <section id="alerts-basket-strategy" className="mt-4 rounded-2xl border border-indigo-200 bg-indigo-50/80 p-4 text-sm dark:border-indigo-900 dark:bg-indigo-950/20">
        <SectionImpression sectionId="alerts-basket-strategy" eventProps={{ location: "alerts" }} />
        <p className="font-semibold text-indigo-900 dark:text-indigo-100">Fra enkeltvarsel til handlekurv-varsel</p>
        <p className="mt-1 text-indigo-900/90 dark:text-indigo-100/90">
          Bruk varsler på flere faste varer samtidig for å fange beste handlevindu for hele uken, ikke bare ett produkt.
        </p>
        <p className="mt-2 rounded-xl border border-indigo-300 bg-white/80 px-3 py-2 text-xs font-medium text-indigo-900 dark:border-indigo-800 dark:bg-slate-900/70 dark:text-indigo-100">
          Kurvsignal akkurat nå: {basketSignal}
        </p>
      </section>

      <div className="mt-6 fade-rise-delayed">
        <PriceAlertsPanel products={products} initialAlerts={serializedAlerts} />
      </div>

      <section className="mt-6 rounded-3xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900">
        <h2 className="text-lg font-semibold">Siste handlekurv-digest sendt</h2>
        <p className="mt-1 text-sm text-slate-600 dark:text-slate-300">Gir sporbarhet på hva varselmotoren faktisk har sendt ut.</p>

        {digestHistory.length === 0 ? (
          <p className="mt-3 text-sm text-slate-500 dark:text-slate-400">Ingen digest-logg funnet ennå.</p>
        ) : (
          <ul className="mt-4 space-y-2 text-sm">
            {digestHistory.map((entry) => (
              <li key={`${entry.at}-${entry.to}`} className="rounded-2xl border border-slate-200 px-3 py-3 dark:border-slate-800">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <p className="font-medium">{entry.subject}</p>
                  <span className={`rounded-full px-2 py-0.5 text-xs font-semibold ${entry.channel === "email" ? "bg-emerald-100 text-emerald-800 dark:bg-emerald-900/45 dark:text-emerald-200" : "bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-200"}`}>
                    {entry.channel}
                  </span>
                </div>
                <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                  {new Date(entry.at).toLocaleString("nb-NO")} · mottaker {entry.to}
                </p>
                <p className="mt-1 text-xs text-slate-600 dark:text-slate-300">
                  Triggere: {entry.triggeredItems} · Kjøp nå: {entry.buyNowCount} · Målpris oppnådd: {entry.targetReachedCount}
                </p>
              </li>
            ))}
          </ul>
        )}
      </section>

      <div className="mobile-bottom-bar fixed inset-x-0 bottom-0 z-40 border-t border-slate-200 bg-white/95 p-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] backdrop-blur md:hidden dark:border-slate-800 dark:bg-slate-950/90">
        <div className="mobile-bottom-actions mx-auto grid max-w-6xl grid-cols-2 gap-2">
          <a href="#new-alert-card" className="mobile-bottom-action min-w-0 rounded-xl border border-slate-300 px-2.5 py-2 text-center text-[13px] font-medium leading-tight sm:px-3 sm:text-sm dark:border-slate-700">
            Nytt varsel
          </a>
          <a href="#alert-list" className="mobile-bottom-action min-w-0 rounded-xl bg-emerald-600 px-2.5 py-2 text-center text-[13px] font-medium leading-tight text-white sm:px-3 sm:text-sm">
            Mine varsler
          </a>
        </div>
      </div>
    </main>
  );
}
