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

type ImageReviewCandidate = {
  id: string;
  name: string;
  brand: string;
  ean: string;
  category: string;
  imageUrl: string | null;
  reason: "missing" | "invalid-url" | "possible-mismatch";
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

type OfferScanRow = {
  label: string;
  offerPrice: number;
  matched: boolean;
  matchScore: number | null;
  productName: string | null;
  latestChainPrice: number | null;
  avg30: number | null;
  trendAction: "kjop-na" | "vent" | "ukjent";
  trendScore: number | null;
  deviationVs30Pct: number | null;
  verdict: "sterkt-tilbud" | "ok-tilbud" | "svakt-tilbud" | "ukjent";
  dataPoints: number;
};

export function AdminPanel({
  products,
  prices,
  stores,
  initialSourceStats,
  imageReviewCandidates,
}: {
  products: Product[];
  prices: Price[];
  stores: { id: string; name: string }[];
  initialSourceStats: SourceStat[];
  imageReviewCandidates: ImageReviewCandidate[];
}) {
  const { showToast } = useToast();
  const [syncStatus, setSyncStatus] = useState<string | null>(null);
  const [syncing, setSyncing] = useState(false);
  const [imageSyncStatus, setImageSyncStatus] = useState<string | null>(null);
  const [imageSyncing, setImageSyncing] = useState(false);
  const [providerMetrics, setProviderMetrics] = useState<ProviderSyncMetric[]>([]);
  const [offerScanStatus, setOfferScanStatus] = useState<string | null>(null);
  const [offerScanRunning, setOfferScanRunning] = useState(false);
  const [offerScanRows, setOfferScanRows] = useState<OfferScanRow[]>([]);
  const [offerScanForm, setOfferScanForm] = useState({
    chain: "Kiwi",
    flyerUrl: "",
    flyerText: "",
    maxItems: "40",
  });
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

  async function refreshSuspiciousImages() {
    setImageSyncing(true);
    setImageSyncStatus(null);

    try {
      const payload = await apiRequest<{
        attemptedProducts: number;
        refreshedCandidates: number;
        remainingCandidates: number;
      }>("/api/admin/images/refresh", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ limit: 80 }),
      });

      const message = `Sjekket ${payload.attemptedProducts} produkter. Forbedret ${payload.refreshedCandidates}. Gjenstår ${payload.remainingCandidates}.`;
      setImageSyncStatus(message);
      showToast({ title: "Bildejobb fullfort", description: message, type: "success" });
      window.location.reload();
    } catch (error) {
      const text = toUserErrorMessage(error, "Ukjent feil ved bildeforbedring.");
      setImageSyncStatus(text);
      showToast({
        title: "Bildejobb feilet",
        description: text,
        type: "error",
        actionLabel: "Prøv igjen",
        onAction: refreshSuspiciousImages,
      });
    } finally {
      setImageSyncing(false);
    }
  }

  async function runOfferScan() {
    setOfferScanRunning(true);
    setOfferScanStatus(null);

    try {
      const maxItems = Number(offerScanForm.maxItems);
      const payload = await apiRequest<{
        scannedItems: number;
        matchedItems: number;
        strongDeals: number;
        comparisons: OfferScanRow[];
      }>("/api/admin/offers/scan", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          chain: offerScanForm.chain,
          flyerUrl: offerScanForm.flyerUrl || undefined,
          flyerText: offerScanForm.flyerText || undefined,
          maxItems: Number.isFinite(maxItems) ? maxItems : 40,
        }),
      });

      setOfferScanRows(payload.comparisons ?? []);
      const message = `Skannet ${payload.scannedItems} linjer. Matchet ${payload.matchedItems}. Sterke tilbud: ${payload.strongDeals}.`;
      setOfferScanStatus(message);
      showToast({ title: "Tilbudsavis skannet", description: message, type: "success" });
    } catch (error) {
      const text = toUserErrorMessage(error, "Ukjent feil ved tilbudsavis-scan.");
      setOfferScanStatus(text);
      showToast({
        title: "Tilbudsavis-scan feilet",
        description: text,
        type: "error",
        actionLabel: "Prov igjen",
        onAction: runOfferScan,
      });
    } finally {
      setOfferScanRunning(false);
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

      <section className="rounded-3xl border border-amber-200 bg-amber-50/60 p-5 shadow-sm dark:border-amber-900/60 dark:bg-amber-950/20">
        <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
          <div>
            <h2 className="text-lg font-semibold">Produktbilder til gjennomgang</h2>
            <p className="mt-1 text-sm text-amber-900/80 dark:text-amber-100/80">
              Viser produkter med manglende bilde eller mulig bilde-mismatch.
            </p>
          </div>
          <button
            type="button"
            onClick={refreshSuspiciousImages}
            disabled={imageSyncing}
            className="rounded-lg bg-amber-600 px-4 py-2 text-white transition hover:bg-amber-500 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {imageSyncing ? "Kjører bildejobb..." : "Kjør bildeforbedring"}
          </button>
        </div>
        {imageSyncStatus ? <p className="mt-3 text-sm text-amber-900 dark:text-amber-100">{imageSyncStatus}</p> : null}

        {imageReviewCandidates.length === 0 ? (
          <p className="mt-3 text-sm text-emerald-700 dark:text-emerald-300">Ingen mistenkelige produktbilder funnet akkurat nå.</p>
        ) : (
          <div className="mt-4 overflow-x-auto rounded-xl border border-amber-300/70 bg-white/80 dark:border-amber-900/40 dark:bg-slate-950/40">
            <table className="min-w-[56rem] w-full text-left text-xs">
              <thead className="bg-amber-100/70 dark:bg-amber-900/30">
                <tr>
                  <th className="px-3 py-2 font-semibold">Produkt</th>
                  <th className="px-3 py-2 font-semibold">Merke</th>
                  <th className="px-3 py-2 font-semibold">Kategori</th>
                  <th className="px-3 py-2 font-semibold">Årsak</th>
                  <th className="px-3 py-2 font-semibold">Handling</th>
                </tr>
              </thead>
              <tbody>
                {imageReviewCandidates.slice(0, 80).map((item) => (
                  <tr key={item.id} className="border-t border-amber-200/80 dark:border-amber-900/30">
                    <td className="px-3 py-2 font-medium">{item.name}</td>
                    <td className="px-3 py-2">{item.brand}</td>
                    <td className="px-3 py-2">{item.category}</td>
                    <td className="px-3 py-2">
                      {item.reason === "missing" ? "Mangler bilde" : item.reason === "invalid-url" ? "Ugyldig bildeadresse" : "Mulig feil produktbilde"}
                    </td>
                    <td className="px-3 py-2">
                      <a href={`/product/${item.id}`} className="font-semibold text-amber-700 hover:underline dark:text-amber-300">
                        Åpne produkt
                      </a>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <section className="rounded-3xl border border-cyan-200 bg-cyan-50/60 p-5 shadow-sm dark:border-cyan-900/60 dark:bg-cyan-950/20">
        <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
          <div>
            <h2 className="text-lg font-semibold">Tilbudsavis-scan mot pristrend</h2>
            <p className="mt-1 text-sm text-cyan-900/80 dark:text-cyan-100/80">
              Lim inn tekst fra tilbudsavis eller URL. Motoren matcher varer og sammenligner tilbudspris med historikk i samme kjede.
            </p>
          </div>
          <button
            type="button"
            onClick={runOfferScan}
            disabled={offerScanRunning}
            className="rounded-lg bg-cyan-700 px-4 py-2 text-white transition hover:bg-cyan-600 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {offerScanRunning ? "Scanner..." : "Scan tilbudsavis"}
          </button>
        </div>

        <div className="mt-4 grid gap-2 md:grid-cols-2">
          <input
            value={offerScanForm.chain}
            onChange={(e) => setOfferScanForm((prev) => ({ ...prev, chain: e.target.value }))}
            placeholder="Kjede, f.eks. Kiwi"
            className="rounded-lg border border-cyan-300 px-3 py-2 dark:border-cyan-900 dark:bg-slate-950"
          />
          <input
            value={offerScanForm.flyerUrl}
            onChange={(e) => setOfferScanForm((prev) => ({ ...prev, flyerUrl: e.target.value }))}
            placeholder="Valgfri URL til tilbudsavis"
            className="rounded-lg border border-cyan-300 px-3 py-2 dark:border-cyan-900 dark:bg-slate-950"
          />
          <input
            value={offerScanForm.maxItems}
            onChange={(e) => setOfferScanForm((prev) => ({ ...prev, maxItems: e.target.value }))}
            placeholder="Maks linjer, f.eks. 40"
            className="rounded-lg border border-cyan-300 px-3 py-2 dark:border-cyan-900 dark:bg-slate-950"
          />
          <div className="text-xs text-cyan-900/80 dark:text-cyan-100/80 md:self-center">
            Tips: Ved PDF-bilder lim inn OCR-tekst i feltet under for bedre treff.
          </div>
        </div>

        <textarea
          value={offerScanForm.flyerText}
          onChange={(e) => setOfferScanForm((prev) => ({ ...prev, flyerText: e.target.value }))}
          rows={7}
          placeholder="Lim inn tilbudstekst her (valgfritt hvis URL brukes)"
          className="mt-3 w-full rounded-lg border border-cyan-300 px-3 py-2 dark:border-cyan-900 dark:bg-slate-950"
        />

        {offerScanStatus ? <p className="mt-3 text-sm text-cyan-900 dark:text-cyan-100">{offerScanStatus}</p> : null}

        {offerScanRows.length > 0 ? (
          <div className="mt-4 overflow-x-auto rounded-xl border border-cyan-300/70 bg-white/90 dark:border-cyan-900/40 dark:bg-slate-950/40">
            <table className="min-w-[72rem] w-full text-left text-xs">
              <thead className="bg-cyan-100/80 dark:bg-cyan-900/30">
                <tr>
                  <th className="px-3 py-2 font-semibold">Tilbudslinje</th>
                  <th className="px-3 py-2 font-semibold">Tilbudspris</th>
                  <th className="px-3 py-2 font-semibold">Match</th>
                  <th className="px-3 py-2 font-semibold">Siste kjedepris</th>
                  <th className="px-3 py-2 font-semibold">Snitt 30d</th>
                  <th className="px-3 py-2 font-semibold">Avvik 30d</th>
                  <th className="px-3 py-2 font-semibold">Trend</th>
                  <th className="px-3 py-2 font-semibold">Dom</th>
                </tr>
              </thead>
              <tbody>
                {offerScanRows.map((row, index) => (
                  <tr key={`${row.label}-${index}`} className="border-t border-cyan-200/80 dark:border-cyan-900/30">
                    <td className="px-3 py-2">
                      <p className="font-medium">{row.label}</p>
                      <p className="text-[11px] text-slate-500 dark:text-slate-400">{row.productName ?? "Ingen sikker produktmatch"}</p>
                    </td>
                    <td className="px-3 py-2">{row.offerPrice.toFixed(2)} kr</td>
                    <td className="px-3 py-2">{row.matchScore !== null ? `${Math.round(row.matchScore * 100)}%` : "-"}</td>
                    <td className="px-3 py-2">{row.latestChainPrice !== null ? `${row.latestChainPrice.toFixed(2)} kr` : "-"}</td>
                    <td className="px-3 py-2">{row.avg30 !== null ? `${row.avg30.toFixed(2)} kr` : "-"}</td>
                    <td className="px-3 py-2">{row.deviationVs30Pct !== null ? `${row.deviationVs30Pct > 0 ? "+" : ""}${row.deviationVs30Pct}%` : "-"}</td>
                    <td className="px-3 py-2">{row.trendAction === "kjop-na" ? "Kjop-na" : row.trendAction === "vent" ? "Vent" : "Ukjent"}</td>
                    <td className="px-3 py-2">{row.verdict}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : null}
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
