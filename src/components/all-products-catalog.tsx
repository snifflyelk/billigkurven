"use client";

import Link from "next/link";
import { useState } from "react";

import { formatNok } from "@/lib/utils";

export type CatalogProduct = {
  id: string;
  name: string;
  brand: string;
  category: string;
  packageLabel: string;
  latestPrice: number;
  lowestPrice: number;
  highestPrice: number;
  priceSpread: number;
  storeCount: number;
  dataPoints: number;
  lastObservedAt: string;
};

type SortOption = "updated" | "price-low" | "price-high" | "stores" | "spread" | "name";

function formatObserved(value: string) {
  return new Intl.DateTimeFormat("nb-NO", {
    day: "2-digit",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(value));
}

export function AllProductsCatalog({ products }: { products: CatalogProduct[] }) {
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState("all");
  const [brand, setBrand] = useState("all");
  const [minStores, setMinStores] = useState("all");
  const [sortBy, setSortBy] = useState<SortOption>("updated");

  const categories = Array.from(new Set(products.map((product) => product.category).filter(Boolean))).sort((a, b) => a.localeCompare(b, "nb"));
  const brands = Array.from(new Set(products.map((product) => product.brand).filter(Boolean))).sort((a, b) => a.localeCompare(b, "nb"));

  const normalizedQuery = query.trim().toLowerCase();
  const minStoreCount = minStores === "all" ? 0 : Number(minStores);

  const filtered = products.filter((product) => {
    const textMatch =
      normalizedQuery.length === 0 ||
      product.name.toLowerCase().includes(normalizedQuery) ||
      product.brand.toLowerCase().includes(normalizedQuery) ||
      product.category.toLowerCase().includes(normalizedQuery);
    const categoryMatch = category === "all" || product.category === category;
    const brandMatch = brand === "all" || product.brand === brand;
    const storeMatch = minStoreCount === 0 || product.storeCount >= minStoreCount;

    return textMatch && categoryMatch && brandMatch && storeMatch;
  });

  const sorted = [...filtered].sort((left, right) => {
    if (sortBy === "price-low") return left.lowestPrice - right.lowestPrice;
    if (sortBy === "price-high") return right.highestPrice - left.highestPrice;
    if (sortBy === "stores") return right.storeCount - left.storeCount;
    if (sortBy === "spread") return right.priceSpread - left.priceSpread;
    if (sortBy === "name") return left.name.localeCompare(right.name, "nb");
    return new Date(right.lastObservedAt).getTime() - new Date(left.lastObservedAt).getTime();
  });

  return (
    <>
      <section className="rounded-2xl border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900">
        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-5">
          <label className="xl:col-span-2">
            <span className="mb-1 block text-xs font-semibold uppercase tracking-wide text-slate-500">Søk</span>
            <input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Søk på vare, merke eller kategori"
              className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm outline-none transition focus:border-emerald-500 dark:border-slate-700 dark:bg-slate-950"
            />
          </label>

          <label>
            <span className="mb-1 block text-xs font-semibold uppercase tracking-wide text-slate-500">Kategori</span>
            <select
              value={category}
              onChange={(event) => setCategory(event.target.value)}
              className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm outline-none transition focus:border-emerald-500 dark:border-slate-700 dark:bg-slate-950"
            >
              <option value="all">Alle kategorier</option>
              {categories.map((item) => (
                <option key={item} value={item}>
                  {item}
                </option>
              ))}
            </select>
          </label>

          <label>
            <span className="mb-1 block text-xs font-semibold uppercase tracking-wide text-slate-500">Merke</span>
            <select
              value={brand}
              onChange={(event) => setBrand(event.target.value)}
              className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm outline-none transition focus:border-emerald-500 dark:border-slate-700 dark:bg-slate-950"
            >
              <option value="all">Alle merker</option>
              {brands.map((item) => (
                <option key={item} value={item}>
                  {item}
                </option>
              ))}
            </select>
          </label>

          <label>
            <span className="mb-1 block text-xs font-semibold uppercase tracking-wide text-slate-500">Min butikker</span>
            <select
              value={minStores}
              onChange={(event) => setMinStores(event.target.value)}
              className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm outline-none transition focus:border-emerald-500 dark:border-slate-700 dark:bg-slate-950"
            >
              <option value="all">Alle</option>
              <option value="2">2+</option>
              <option value="3">3+</option>
              <option value="4">4+</option>
            </select>
          </label>

          <label>
            <span className="mb-1 block text-xs font-semibold uppercase tracking-wide text-slate-500">Sorter etter</span>
            <select
              value={sortBy}
              onChange={(event) => setSortBy(event.target.value as SortOption)}
              className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm outline-none transition focus:border-emerald-500 dark:border-slate-700 dark:bg-slate-950"
            >
              <option value="updated">Sist oppdatert</option>
              <option value="price-low">Laveste pris</option>
              <option value="price-high">Høyeste pris</option>
              <option value="stores">Flest butikker</option>
              <option value="spread">Størst pris-spenn</option>
              <option value="name">Navn A-Å</option>
            </select>
          </label>
        </div>

        <p className="mt-3 text-sm text-slate-600 dark:text-slate-300">
          Viser {sorted.length} av {products.length} varer med prisstatistikk.
        </p>
      </section>

      <section className="mt-5 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {sorted.map((product) => (
          <Link
            key={product.id}
            href={`/product/${product.id}`}
            className="rounded-2xl border border-slate-200 bg-white p-4 transition hover:border-emerald-300 hover:shadow-sm dark:border-slate-800 dark:bg-slate-900 dark:hover:border-emerald-800"
          >
            <div className="flex items-start justify-between gap-3">
              <div>
                <h2 className="text-lg font-semibold leading-tight">{product.name}</h2>
                <p className="mt-1 text-sm text-slate-600 dark:text-slate-300">{product.brand} · {product.category}</p>
              </div>
              <span className="rounded-full bg-emerald-50 px-2 py-1 text-xs font-medium text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300">
                {product.packageLabel}
              </span>
            </div>

            <dl className="mt-4 grid grid-cols-2 gap-3 text-sm">
              <div>
                <dt className="text-xs uppercase tracking-wide text-slate-500">Siste pris</dt>
                <dd className="mt-1 font-semibold">{formatNok(product.latestPrice)}</dd>
              </div>
              <div>
                <dt className="text-xs uppercase tracking-wide text-slate-500">Pris-spenn</dt>
                <dd className="mt-1 font-semibold">{formatNok(product.priceSpread)}</dd>
              </div>
              <div>
                <dt className="text-xs uppercase tracking-wide text-slate-500">Laveste</dt>
                <dd className="mt-1 text-slate-700 dark:text-slate-200">{formatNok(product.lowestPrice)}</dd>
              </div>
              <div>
                <dt className="text-xs uppercase tracking-wide text-slate-500">Høyeste</dt>
                <dd className="mt-1 text-slate-700 dark:text-slate-200">{formatNok(product.highestPrice)}</dd>
              </div>
              <div>
                <dt className="text-xs uppercase tracking-wide text-slate-500">Butikker</dt>
                <dd className="mt-1 text-slate-700 dark:text-slate-200">{product.storeCount}</dd>
              </div>
              <div>
                <dt className="text-xs uppercase tracking-wide text-slate-500">Datapunkter</dt>
                <dd className="mt-1 text-slate-700 dark:text-slate-200">{product.dataPoints}</dd>
              </div>
            </dl>

            <p className="mt-3 text-xs text-slate-500 dark:text-slate-400">Sist observert {formatObserved(product.lastObservedAt)}</p>
          </Link>
        ))}
      </section>
    </>
  );
}
