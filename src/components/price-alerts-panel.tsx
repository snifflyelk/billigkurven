"use client";

import { useMemo, useState } from "react";

type ProductOption = {
  id: string;
  name: string;
  brand: string;
};

type AlertRow = {
  id: string;
  productId: string;
  targetPrice: number | null;
  targetDropPct: number | null;
  notifyOnBuyNow: boolean;
  isActive: boolean;
  updatedAt: string;
  latestPrice?: number | null;
  timing?: {
    recommendation: "kjop-na" | "vent" | "noytral" | "ukjent";
    changePct: number | null;
    dropFromLast7Pct?: number | null;
    confidencePct?: number | null;
  };
  urgency?: {
    level: "hoy" | "medium" | "lav";
    label: string;
  };
  product: {
    name: string;
    brand: string;
    prices?: Array<{
      price: string | number;
      store: { name: string };
    }>;
  };
};

export function PriceAlertsPanel({
  products,
  initialAlerts,
}: {
  products: ProductOption[];
  initialAlerts: AlertRow[];
}) {
  const [alerts, setAlerts] = useState<AlertRow[]>(initialAlerts);
  const [productId, setProductId] = useState(products[0]?.id ?? "");
  const [targetPrice, setTargetPrice] = useState("");
  const [targetDropPct, setTargetDropPct] = useState("");
  const [notifyOnBuyNow, setNotifyOnBuyNow] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const productsById = useMemo(() => {
    const map = new Map<string, ProductOption>();
    for (const product of products) map.set(product.id, product);
    return map;
  }, [products]);

  const orderedAlerts = useMemo(() => {
    const priority = { hoy: 0, medium: 1, lav: 2 } as const;
    return alerts
      .slice()
      .sort((left, right) => {
        const leftPriority = priority[left.urgency?.level ?? "lav"];
        const rightPriority = priority[right.urgency?.level ?? "lav"];
        if (leftPriority !== rightPriority) return leftPriority - rightPriority;
        return Number(new Date(right.updatedAt)) - Number(new Date(left.updatedAt));
      });
  }, [alerts]);

  async function refreshAlerts() {
    const response = await fetch("/api/alerts", { cache: "no-store" });
    const payload = await response.json();
    if (response.ok && Array.isArray(payload.alerts)) {
      setAlerts(payload.alerts as AlertRow[]);
    }
  }

  async function createAlert(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    if (!productId) return;
    setSaving(true);

    try {
      const response = await fetch("/api/alerts", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          productId,
          targetPrice: targetPrice.trim() ? Number(targetPrice) : null,
          targetDropPct: targetDropPct.trim() ? Number(targetDropPct) : null,
          notifyOnBuyNow,
        }),
      });

      const payload = await response.json();
      if (!response.ok) {
        setError(payload?.error ?? "Kunne ikke lagre varsel.");
        return;
      }

      setTargetPrice("");
      setTargetDropPct("");
      await refreshAlerts();
    } finally {
      setSaving(false);
    }
  }

  async function toggleAlert(id: string, isActive: boolean) {
    await fetch(`/api/alerts/${id}`, {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ isActive: !isActive }),
    });
    await refreshAlerts();
  }

  async function removeAlert(id: string) {
    await fetch(`/api/alerts/${id}`, { method: "DELETE" });
    await refreshAlerts();
  }

  function proximityBadge(alert: AlertRow) {
    const latest = Number(alert.product.prices?.[0]?.price ?? NaN);
    if (!Number.isFinite(latest) || alert.targetPrice === null) return "Uten målsum";
    const diff = latest - alert.targetPrice;
    if (diff <= 0) return "Mål oppnådd";
    if (diff <= 3) return "Nesten der";
    return "Ikke nær ennå";
  }

  return (
    <section className="grid gap-6 lg:grid-cols-[1fr_1.25fr]">
      <article id="new-alert-card" className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900">
        <h2 className="text-lg font-semibold">Nytt prisvarsel</h2>
        <p className="mt-1 text-sm text-slate-600 dark:text-slate-300">Kombiner målsum, prisfall-prosent og trendsignal for bedre timing.</p>
        <form className="mt-4 space-y-3" onSubmit={createAlert}>
          <label className="block text-sm text-slate-600 dark:text-slate-300">
            Produkt
            <select
              className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-950"
              value={productId}
              onChange={(event) => setProductId(event.target.value)}
            >
              {products.map((product) => (
                <option key={product.id} value={product.id}>
                  {product.name} ({product.brand})
                </option>
              ))}
            </select>
          </label>

          <label className="block text-sm text-slate-600 dark:text-slate-300">
            Målsum (kr, valgfri)
            <input
              className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-950"
              value={targetPrice}
              onChange={(event) => setTargetPrice(event.target.value)}
              placeholder="f.eks. 39.90"
              inputMode="decimal"
            />
          </label>

          <label className="block text-sm text-slate-600 dark:text-slate-300">
            Drop i prosent (valgfri)
            <input
              className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-950"
              value={targetDropPct}
              onChange={(event) => setTargetDropPct(event.target.value)}
              placeholder="f.eks. 10"
              inputMode="decimal"
            />
          </label>

          <label className="flex items-center gap-2 text-sm text-slate-600 dark:text-slate-300">
            <input
              type="checkbox"
              checked={notifyOnBuyNow}
              onChange={(event) => setNotifyOnBuyNow(event.target.checked)}
            />
            Varsle ved &quot;kjøp nå&quot;-signal
          </label>

          {error ? <p className="text-sm text-rose-600">{error}</p> : null}

          <button
            type="submit"
            disabled={saving}
            className="w-full rounded-xl bg-emerald-600 px-4 py-2.5 text-sm font-medium text-white hover:bg-emerald-500 disabled:opacity-60"
          >
            {saving ? "Lagrer..." : "Lagre varsel"}
          </button>
        </form>
      </article>

      <article id="alert-list" className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900">
        <h2 className="text-lg font-semibold">Aktive og historiske varsler</h2>
        <p className="mt-1 text-sm text-slate-600 dark:text-slate-300">Prioriter varer med &quot;Mål oppnådd&quot; eller &quot;Nesten der&quot;.</p>
        {alerts.length === 0 ? (
          <p className="mt-3 text-sm text-slate-500 dark:text-slate-400">Ingen varsler ennå.</p>
        ) : (
          <ul className="mt-4 space-y-3 text-sm">
            {orderedAlerts.map((alert) => {
              const product = productsById.get(alert.productId);
              const latestPrice = alert.latestPrice ?? alert.product.prices?.[0]?.price;
              const latestStore = alert.product.prices?.[0]?.store?.name;
              const badge = proximityBadge(alert);
              return (
                <li key={alert.id} className="rounded-2xl border border-slate-200 p-3.5 dark:border-slate-800">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <p className="font-medium">{product?.name ?? alert.product.name}</p>
                    <span className={`rounded-full px-2 py-0.5 text-xs ${alert.isActive ? "bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-200" : "bg-slate-200 text-slate-700 dark:bg-slate-800 dark:text-slate-200"}`}>
                      {alert.isActive ? "Aktiv" : "Pause"}
                    </span>
                  </div>
                  <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                    {alert.product.brand} · Siste observerte pris: {latestPrice ?? "-"} {latestStore ? `(${latestStore})` : ""}
                  </p>
                  <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                    Målpris: {alert.targetPrice ?? "-"} · Drop%: {alert.targetDropPct ?? "-"} · Buy-now: {alert.notifyOnBuyNow ? "Ja" : "Nei"}
                  </p>
                  <div className="mt-2 flex flex-wrap items-center gap-2">
                    <span className={`rounded-full px-2 py-1 text-[11px] font-semibold ${badge === "Mål oppnådd" ? "bg-emerald-100 text-emerald-800 dark:bg-emerald-900/45 dark:text-emerald-200" : badge === "Nesten der" ? "bg-amber-100 text-amber-800 dark:bg-amber-900/45 dark:text-amber-200" : "bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-200"}`}>
                      {badge}
                    </span>
                    {alert.urgency ? (
                      <span className={`rounded-full px-2 py-1 text-[11px] font-semibold ${alert.urgency.level === "hoy" ? "bg-rose-100 text-rose-800 dark:bg-rose-900/45 dark:text-rose-200" : alert.urgency.level === "medium" ? "bg-cyan-100 text-cyan-800 dark:bg-cyan-900/45 dark:text-cyan-200" : "bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-200"}`}>
                        Prioritet: {alert.urgency.label}
                      </span>
                    ) : null}
                    {alert.timing ? (
                      <span className={`rounded-full px-2 py-1 text-[11px] font-semibold ${alert.timing.recommendation === "kjop-na" ? "bg-emerald-100 text-emerald-800 dark:bg-emerald-900/45 dark:text-emerald-200" : alert.timing.recommendation === "vent" ? "bg-amber-100 text-amber-800 dark:bg-amber-900/45 dark:text-amber-200" : "bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-200"}`}>
                        {alert.timing.recommendation === "kjop-na"
                          ? "Timing: Kjøp nå"
                          : alert.timing.recommendation === "vent"
                            ? "Timing: Vent"
                            : "Timing: Nøytral"}
                        {alert.timing.changePct !== null ? ` (${alert.timing.changePct > 0 ? "+" : ""}${alert.timing.changePct}%)` : ""}
                      </span>
                    ) : null}
                    {alert.timing?.dropFromLast7Pct !== null && alert.timing?.dropFromLast7Pct !== undefined ? (
                      <span className={`rounded-full px-2 py-1 text-[11px] font-semibold ${alert.timing.dropFromLast7Pct >= (alert.targetDropPct ?? 10) ? "bg-rose-100 text-rose-800 dark:bg-rose-900/45 dark:text-rose-200" : "bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-200"}`}>
                        Prisfall 7d: {alert.timing.dropFromLast7Pct}%
                      </span>
                    ) : null}
                    {alert.timing?.confidencePct !== null && alert.timing?.confidencePct !== undefined ? (
                      <span className="rounded-full bg-cyan-100 px-2 py-1 text-[11px] font-semibold text-cyan-800 dark:bg-cyan-900/45 dark:text-cyan-200">
                        Timing confidence: {alert.timing.confidencePct}%
                      </span>
                    ) : null}
                  </div>
                  <div className="mt-3 flex flex-wrap gap-2">
                    <button
                      className="rounded-lg border border-slate-300 px-3 py-1.5 text-xs font-medium hover:bg-slate-50 dark:border-slate-700 dark:hover:bg-slate-800"
                      onClick={() => toggleAlert(alert.id, alert.isActive)}
                    >
                      {alert.isActive ? "Sett på pause" : "Aktiver"}
                    </button>
                    <button
                      className="rounded-lg border border-rose-300 px-3 py-1.5 text-xs font-medium text-rose-700 hover:bg-rose-50 dark:border-rose-800 dark:text-rose-300 dark:hover:bg-rose-950/30"
                      onClick={() => removeAlert(alert.id)}
                    >
                      Slett
                    </button>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </article>
    </section>
  );
}
