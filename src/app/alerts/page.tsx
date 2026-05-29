import { prisma } from "@/lib/prisma";
import { DEFAULT_USER_EMAIL } from "@/lib/constants";
import { PriceAlertsPanel } from "@/components/price-alerts-panel";
import { buildAlertUrgency, buildTimingSignal } from "@/lib/alerts/signal";

export const dynamic = "force-dynamic";

export default async function AlertsPage() {
  const user = await prisma.user.findUnique({ where: { email: DEFAULT_USER_EMAIL } }).catch(() => null);

  const [products, alerts] = await Promise.all([
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
  ]);

  const serializedAlerts = alerts.map((alert) => {
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

  return (
    <main className="mx-auto max-w-6xl px-4 py-10 pb-24 md:pb-10">
      <h1 className="text-3xl font-bold tracking-tight">Prisvarsler</h1>
      <p className="mt-2 text-slate-600 dark:text-slate-300">
        Sett maalpris og trend-betingelser. Bruk varsler for a fange gode kjopstidspunkt, ikke bare laveste pris akkurat na.
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
          <p className="text-xs font-semibold uppercase tracking-wide text-rose-700 dark:text-rose-300">Hoy prioritet</p>
          <p className="mt-1 text-2xl font-semibold text-rose-900 dark:text-rose-100">{urgentCount}</p>
        </article>
      </section>

      <div className="mt-6 fade-rise-delayed">
        <PriceAlertsPanel products={products} initialAlerts={serializedAlerts} />
      </div>

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
