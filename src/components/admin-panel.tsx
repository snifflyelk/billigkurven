"use client";

import { useState } from "react";
import { useToast } from "@/components/providers/toast-provider";
import { apiRequest, toUserErrorMessage } from "@/lib/api-client";

type Product = {
  id: string;
  name: string;
  brand: string;
  ean: string;
  category: string;
  packageQuantity?: number | null;
  packageUnit?: "G" | "ML" | "STK" | null;
};

type Price = {
  id: string;
  price: number | string;
  unitPrice: number | string;
  date: Date | string;
  product: { name: string };
  store: { name: string };
};

type SourceStat = {
  source: string;
  rows24h: number;
  rows7d: number;
  totalRows: number;
  latestAt: string | null;
};

type ProviderSyncMetric = {
  provider: string;
  chain: string;
  attemptedProducts: number;
  matchedProducts: number;
  matchedPrices: number;
  skippedDuplicates: number;
  hitRate: number;
  degradedFromHistory: boolean;
  disabled: boolean;
  disabledReason: string | null;
  recentRows7d: number;
  latestObservationHours: number | null;
};

export function AdminPanel({
  products,
  prices,
  stores,
  initialSourceStats,
}: {
  products: Product[];
  prices: Price[];
  stores: { id: string; name: string }[];
  initialSourceStats: SourceStat[];
}) {
  const { showToast } = useToast();
  const [syncStatus, setSyncStatus] = useState<string | null>(null);
  const [syncing, setSyncing] = useState(false);
  const [providerMetrics, setProviderMetrics] = useState<ProviderSyncMetric[]>([]);
  const [productForm, setProductForm] = useState({
    name: "",
    brand: "",
    ean: "",
    category: "",
    imageUrl: "",
    packageQuantity: "",
    packageUnit: "",
  });
  const [priceForm, setPriceForm] = useState({
    productId: products[0]?.id ?? "",
    storeId: stores[0]?.id ?? "",
    price: "",
    unitPrice: "",
    promoPrice: "",
    loyaltyPrice: "",
    promoLabel: "",
    promoValidFrom: "",
    promoValidTo: "",
    requiresMembership: false,
  });

  const healthBadgeClass = {
    green: "bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-200",
    yellow: "bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-200",
    red: "bg-rose-100 text-rose-800 dark:bg-rose-900/40 dark:text-rose-200",
  } as const;

  function providerHealth(metric: ProviderSyncMetric) {
    if (metric.disabled) {
      return { tone: "red" as const, label: "Svak" };
    }

    if (metric.hitRate >= 55 && (metric.latestObservationHours ?? 999) <= 36) {
      return { tone: "green" as const, label: "Sterk" };
    }

    if (metric.hitRate >= 20 || (metric.latestObservationHours ?? 999) <= 96) {
      return { tone: "yellow" as const, label: "Moderat" };
    }

    return { tone: "red" as const, label: "Svak" };
  }

  function sourceHealth(source: SourceStat) {
    const ageHours = source.latestAt ? (Date.now() - new Date(source.latestAt).getTime()) / (1000 * 60 * 60) : null;

    if (source.rows24h >= 20 || (source.rows7d >= 80 && (ageHours ?? 999) <= 24)) {
      return { tone: "green" as const, label: "Sterk" };
    }

    if (source.rows7d >= 10 || (ageHours ?? 999) <= 96) {
      return { tone: "yellow" as const, label: "Moderat" };
    }

    return { tone: "red" as const, label: "Svak" };
  }

  async function addProduct() {
    try {
      await apiRequest<{ product: Product }>("/api/admin/products", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...productForm,
          packageQuantity: productForm.packageQuantity ? Number(productForm.packageQuantity) : null,
          packageUnit: productForm.packageUnit || null,
        }),
      });
      showToast({ title: "Produkt lagret", type: "success" });
      window.location.reload();
    } catch (error) {
      showToast({
        title: "Kunne ikke lagre produkt",
        description: toUserErrorMessage(error, "Prøv igjen om et øyeblikk."),
        type: "error",
        actionLabel: "Prøv igjen",
        onAction: addProduct,
      });
    }
  }

  async function addPrice() {
    try {
      await apiRequest<{ price: Price }>("/api/admin/prices", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...priceForm,
          price: Number(priceForm.price),
          unitPrice: Number(priceForm.unitPrice),
          promoPrice: priceForm.promoPrice ? Number(priceForm.promoPrice) : null,
          loyaltyPrice: priceForm.loyaltyPrice ? Number(priceForm.loyaltyPrice) : null,
          promoLabel: priceForm.promoLabel || null,
          promoValidFrom: priceForm.promoValidFrom ? new Date(priceForm.promoValidFrom).toISOString() : null,
          promoValidTo: priceForm.promoValidTo ? new Date(priceForm.promoValidTo).toISOString() : null,
        }),
      });
      showToast({ title: "Prislinje lagret", type: "success" });
      window.location.reload();
    } catch (error) {
      showToast({
        title: "Kunne ikke lagre prislinje",
        description: toUserErrorMessage(error, "Prøv igjen om et øyeblikk."),
        type: "error",
        actionLabel: "Prøv igjen",
        onAction: addPrice,
      });
    }
  }

  async function syncLivePrices() {
    setSyncing(true);
    setSyncStatus(null);

    try {
      const payload = await apiRequest<{ message?: string; providerMetrics?: ProviderSyncMetric[] }>("/api/admin/prices/sync", {
        method: "POST",
      });

      setSyncStatus(payload.message ?? "Synkronisering fullført.");
      setProviderMetrics(payload.providerMetrics ?? []);
      showToast({ title: "Prissynk fullført", description: payload.message, type: "success" });
      window.location.reload();
    } catch (error) {
      const text = toUserErrorMessage(error, "Ukjent feil ved synkronisering.");
      setSyncStatus(text);
      showToast({
        title: "Synk feilet",
        description: text,
        type: "error",
        actionLabel: "Prøv igjen",
        onAction: syncLivePrices,
      });
    } finally {
      setSyncing(false);
    }
  }

  return (
    <div className="space-y-8">
      <section className="rounded-2xl border border-emerald-200 bg-emerald-50 p-5 text-emerald-950 dark:border-emerald-900/60 dark:bg-emerald-950/30 dark:text-emerald-50">
        <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
          <div>
            <h2 className="text-lg font-semibold">Live prissynk</h2>
            <p className="mt-1 text-sm text-emerald-900/80 dark:text-emerald-100/80">
              Hent ferske priser fra alle aktive kilder og se treffrate per kilde.
            </p>
          </div>
          <button
            type="button"
            onClick={syncLivePrices}
            disabled={syncing}
            className="rounded-lg bg-emerald-700 px-4 py-2 text-white transition hover:bg-emerald-600 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {syncing ? "Synkroniserer…" : "Kjor full prissynk"}
          </button>
        </div>
        {syncStatus ? <p className="mt-3 text-sm text-emerald-900 dark:text-emerald-50">{syncStatus}</p> : null}

        {providerMetrics.length > 0 ? (
          <div className="mt-4 overflow-x-auto rounded-xl border border-emerald-300/70 bg-white/70 dark:border-emerald-800/60 dark:bg-slate-950/40">
            <table className="min-w-[56rem] w-full text-left text-xs">
              <thead className="bg-emerald-100/70 dark:bg-emerald-900/30">
                <tr>
                  <th className="px-3 py-2 font-semibold">Kilde</th>
                  <th className="px-3 py-2 font-semibold">Forsokt</th>
                  <th className="px-3 py-2 font-semibold">Treff</th>
                  <th className="px-3 py-2 font-semibold">Treffrate</th>
                  <th className="px-3 py-2 font-semibold">Nedjustering</th>
                  <th className="px-3 py-2 font-semibold">Helse</th>
                  <th className="px-3 py-2 font-semibold">Status</th>
                </tr>
              </thead>
              <tbody>
                {providerMetrics.map((metric) => {
                  const health = providerHealth(metric);

                  return (
                    <tr key={metric.provider} className="border-t border-emerald-200/80 dark:border-emerald-900/40">
                      <td className="px-3 py-2 font-medium">{metric.chain}</td>
                      <td className="px-3 py-2">{metric.attemptedProducts}</td>
                      <td className="px-3 py-2">{metric.matchedProducts}</td>
                      <td className="px-3 py-2">{metric.hitRate}%</td>
                      <td className="px-3 py-2">{metric.degradedFromHistory ? "Ja" : "Nei"}</td>
                      <td className="px-3 py-2">
                        <span className={`inline-flex rounded-full px-2 py-1 text-[11px] font-semibold ${healthBadgeClass[health.tone]}`}>
                          {health.label}
                        </span>
                      </td>
                      <td className="px-3 py-2">{metric.disabled ? (metric.disabledReason ?? "Midlertidig skrudd ned") : "Aktiv"}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        ) : null}
      </section>

      <section className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900">
        <h2 className="text-lg font-semibold">Kildestatus (siste observasjoner)</h2>
        <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">Viser hvilke kilder som faktisk leverer prisrader i praksis.</p>
        {initialSourceStats.length === 0 ? (
          <p className="mt-3 text-sm text-slate-500 dark:text-slate-400">Ingen kildedata ennå. Kjor en prissynk først.</p>
        ) : (
          <div className="mt-4 overflow-x-auto rounded-xl border border-slate-200 dark:border-slate-800">
            <table className="min-w-[48rem] w-full text-left text-sm">
              <thead className="bg-slate-50 dark:bg-slate-950/50">
                <tr>
                  <th className="px-3 py-2 font-medium">Kilde</th>
                  <th className="px-3 py-2 font-medium">Rader 24t</th>
                  <th className="px-3 py-2 font-medium">Rader 7d</th>
                  <th className="px-3 py-2 font-medium">Totalt</th>
                  <th className="px-3 py-2 font-medium">Siste observasjon</th>
                  <th className="px-3 py-2 font-medium">Helse</th>
                </tr>
              </thead>
              <tbody>
                {initialSourceStats.map((source) => {
                  const health = sourceHealth(source);

                  return (
                    <tr key={source.source} className="border-t border-slate-200 dark:border-slate-800">
                      <td className="px-3 py-2 font-medium">{source.source}</td>
                      <td className="px-3 py-2">{source.rows24h}</td>
                      <td className="px-3 py-2">{source.rows7d}</td>
                      <td className="px-3 py-2">{source.totalRows}</td>
                      <td className="px-3 py-2">{source.latestAt ? new Date(source.latestAt).toLocaleString("no-NO") : "-"}</td>
                      <td className="px-3 py-2">
                        <span className={`inline-flex rounded-full px-2 py-1 text-[11px] font-semibold ${healthBadgeClass[health.tone]}`}>
                          {health.label}
                        </span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <section className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900">
        <h2 className="text-lg font-semibold">Legg til produkt</h2>
        <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">Bruk komplette felter så produktet kan inngå i søk, varsler og historikk.</p>
        <div className="mt-3 grid gap-2 md:grid-cols-2">
          <input placeholder="name" value={productForm.name} onChange={(e) => setProductForm((prev) => ({ ...prev, name: e.target.value }))} className="rounded-lg border border-slate-300 px-3 py-2 dark:border-slate-700 dark:bg-slate-950" />
          <input placeholder="brand" value={productForm.brand} onChange={(e) => setProductForm((prev) => ({ ...prev, brand: e.target.value }))} className="rounded-lg border border-slate-300 px-3 py-2 dark:border-slate-700 dark:bg-slate-950" />
          <input placeholder="ean" value={productForm.ean} onChange={(e) => setProductForm((prev) => ({ ...prev, ean: e.target.value }))} className="rounded-lg border border-slate-300 px-3 py-2 dark:border-slate-700 dark:bg-slate-950" />
          <input placeholder="category" value={productForm.category} onChange={(e) => setProductForm((prev) => ({ ...prev, category: e.target.value }))} className="rounded-lg border border-slate-300 px-3 py-2 dark:border-slate-700 dark:bg-slate-950" />
          <input placeholder="imageUrl" value={productForm.imageUrl} onChange={(e) => setProductForm((prev) => ({ ...prev, imageUrl: e.target.value }))} className="rounded-lg border border-slate-300 px-3 py-2 dark:border-slate-700 dark:bg-slate-950" />
          <input placeholder="packageQuantity" value={productForm.packageQuantity} onChange={(e) => setProductForm((prev) => ({ ...prev, packageQuantity: e.target.value }))} className="rounded-lg border border-slate-300 px-3 py-2 dark:border-slate-700 dark:bg-slate-950" />
          <select value={productForm.packageUnit} onChange={(e) => setProductForm((prev) => ({ ...prev, packageUnit: e.target.value }))} className="rounded-lg border border-slate-300 px-3 py-2 dark:border-slate-700 dark:bg-slate-950">
            <option value="">packageUnit</option>
            <option value="G">Gram</option>
            <option value="ML">Milliliter</option>
            <option value="STK">Stykk</option>
          </select>
        </div>
        <button type="button" onClick={addProduct} className="mt-3 rounded-lg bg-emerald-600 px-4 py-2 text-white">
          Lagre produkt
        </button>
      </section>

      <section className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900">
        <h2 className="text-lg font-semibold">Legg til prislinje</h2>
        <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">Registrer basispris, kampanje og medlemspris for mer realistisk butikkvalg.</p>
        <div className="mt-3 grid gap-2 md:grid-cols-2">
          <select
            value={priceForm.productId}
            onChange={(e) => setPriceForm((prev) => ({ ...prev, productId: e.target.value }))}
            className="rounded-lg border border-slate-300 px-3 py-2 dark:border-slate-700 dark:bg-slate-950"
          >
            {products.map((product) => (
              <option key={product.id} value={product.id}>
                {product.name}
              </option>
            ))}
          </select>
          <select
            value={priceForm.storeId}
            onChange={(e) => setPriceForm((prev) => ({ ...prev, storeId: e.target.value }))}
            className="rounded-lg border border-slate-300 px-3 py-2 dark:border-slate-700 dark:bg-slate-950"
          >
            {stores.map((store) => (
              <option key={store.id} value={store.id}>
                {store.name}
              </option>
            ))}
          </select>
          <input
            placeholder="price"
            value={priceForm.price}
            onChange={(e) => setPriceForm((prev) => ({ ...prev, price: e.target.value }))}
            className="rounded-lg border border-slate-300 px-3 py-2 dark:border-slate-700 dark:bg-slate-950"
          />
          <input
            placeholder="unitPrice"
            value={priceForm.unitPrice}
            onChange={(e) => setPriceForm((prev) => ({ ...prev, unitPrice: e.target.value }))}
            className="rounded-lg border border-slate-300 px-3 py-2 dark:border-slate-700 dark:bg-slate-950"
          />
          <input
            placeholder="promoPrice (valgfri)"
            value={priceForm.promoPrice}
            onChange={(e) => setPriceForm((prev) => ({ ...prev, promoPrice: e.target.value }))}
            className="rounded-lg border border-slate-300 px-3 py-2 dark:border-slate-700 dark:bg-slate-950"
          />
          <input
            placeholder="loyaltyPrice (valgfri)"
            value={priceForm.loyaltyPrice}
            onChange={(e) => setPriceForm((prev) => ({ ...prev, loyaltyPrice: e.target.value }))}
            className="rounded-lg border border-slate-300 px-3 py-2 dark:border-slate-700 dark:bg-slate-950"
          />
          <input
            placeholder="promoLabel (f.eks. Trumf-uke)"
            value={priceForm.promoLabel}
            onChange={(e) => setPriceForm((prev) => ({ ...prev, promoLabel: e.target.value }))}
            className="rounded-lg border border-slate-300 px-3 py-2 dark:border-slate-700 dark:bg-slate-950"
          />
          <input
            type="datetime-local"
            value={priceForm.promoValidFrom}
            onChange={(e) => setPriceForm((prev) => ({ ...prev, promoValidFrom: e.target.value }))}
            className="rounded-lg border border-slate-300 px-3 py-2 dark:border-slate-700 dark:bg-slate-950"
          />
          <input
            type="datetime-local"
            value={priceForm.promoValidTo}
            onChange={(e) => setPriceForm((prev) => ({ ...prev, promoValidTo: e.target.value }))}
            className="rounded-lg border border-slate-300 px-3 py-2 dark:border-slate-700 dark:bg-slate-950"
          />
          <label className="flex items-center gap-2 rounded-lg border border-slate-300 px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-950">
            <input
              type="checkbox"
              checked={priceForm.requiresMembership}
              onChange={(e) => setPriceForm((prev) => ({ ...prev, requiresMembership: e.target.checked }))}
            />
            Medlemspris kreves
          </label>
        </div>
        <button type="button" onClick={addPrice} className="mt-3 rounded-lg bg-slate-900 px-4 py-2 text-white dark:bg-emerald-600">
          Lagre prislinje
        </button>
      </section>

      <section className="grid gap-6 lg:grid-cols-2">
        <div className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900">
          <h2 className="text-lg font-semibold">Produkter</h2>
          {products.length === 0 ? (
            <div className="mt-3 rounded-2xl border border-dashed border-slate-300 bg-slate-50/80 p-5 text-sm text-slate-500 dark:border-slate-700 dark:bg-slate-950/50 dark:text-slate-400">
              Ingen produkter registrert ennå. Start med et par basisvarer for å få sammenligningen i gang.
            </div>
          ) : (
            <ul className="mt-3 space-y-2 text-sm">
              {products.slice(0, 25).map((product) => (
                <li key={product.id} className="rounded-lg border border-slate-200 px-3 py-2 dark:border-slate-800">
                  {product.name} - {product.brand}
                </li>
              ))}
            </ul>
          )}
        </div>

        <div className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900">
          <h2 className="text-lg font-semibold">Priser</h2>
          {prices.length === 0 ? (
            <div className="mt-3 rounded-2xl border border-dashed border-slate-300 bg-slate-50/80 p-5 text-sm text-slate-500 dark:border-slate-700 dark:bg-slate-950/50 dark:text-slate-400">
              Ingen prislinjer ennå. Kjør live-synk eller registrer første pris manuelt.
            </div>
          ) : (
            <ul className="mt-3 space-y-2 text-sm">
              {prices.slice(0, 25).map((price) => (
                <li key={price.id} className="rounded-lg border border-slate-200 px-3 py-2 dark:border-slate-800">
                  {price.product.name} hos {price.store.name} - NOK {price.price}
                </li>
              ))}
            </ul>
          )}
        </div>
      </section>
    </div>
  );
}
