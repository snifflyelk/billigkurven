import Link from "next/link";

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

export type CatalogSortOption = "updated" | "name";

function formatObserved(value: string) {
  return new Intl.DateTimeFormat("nb-NO", {
    day: "2-digit",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(value));
}

type CatalogFilters = {
  query: string;
  category: string;
  brand: string;
  sortBy: CatalogSortOption;
};

type CatalogProps = {
  products: CatalogProduct[];
  categories: string[];
  brands: string[];
  filters: CatalogFilters;
  currentPage: number;
  totalPages: number;
  totalFiltered: number;
  totalAll: number;
  pageSize: number;
};

export function AllProductsCatalog({
  products,
  categories,
  brands,
  filters,
  currentPage,
  totalPages,
  totalFiltered,
  totalAll,
  pageSize,
}: CatalogProps) {
  const visibleFrom = totalFiltered === 0 ? 0 : (currentPage - 1) * pageSize + 1;
  const visibleTo = Math.min(totalFiltered, (currentPage - 1) * pageSize + products.length);

  const pageNumbers = Array.from(
    { length: Math.max(0, Math.min(totalPages, currentPage + 2) - Math.max(1, currentPage - 2) + 1) },
    (_, index) => Math.max(1, currentPage - 2) + index,
  );

  const buildPageHref = (page: number) => {
    const params = new URLSearchParams();
    if (filters.query) params.set("q", filters.query);
    if (filters.category !== "all") params.set("category", filters.category);
    if (filters.brand !== "all") params.set("brand", filters.brand);
    if (filters.sortBy !== "updated") params.set("sort", filters.sortBy);
    if (page > 1) params.set("page", String(page));
    const query = params.toString();
    return query ? `/varer?${query}` : "/varer";
  };

  return (
    <>
      <section className="rounded-2xl border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900">
        <form method="get" action="/varer" className="grid gap-3 md:grid-cols-2 xl:grid-cols-5">
          <label className="xl:col-span-2">
            <span className="mb-1 block text-xs font-semibold uppercase tracking-wide text-slate-500">Søk</span>
            <input
              name="q"
              defaultValue={filters.query}
              placeholder="Søk på vare, merke eller kategori"
              className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm outline-none transition focus:border-emerald-500 dark:border-slate-700 dark:bg-slate-950"
            />
          </label>

          <label>
            <span className="mb-1 block text-xs font-semibold uppercase tracking-wide text-slate-500">Kategori</span>
            <select
              name="category"
              defaultValue={filters.category}
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
              name="brand"
              defaultValue={filters.brand}
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
            <span className="mb-1 block text-xs font-semibold uppercase tracking-wide text-slate-500">Sorter etter</span>
            <select
              name="sort"
              defaultValue={filters.sortBy}
              className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm outline-none transition focus:border-emerald-500 dark:border-slate-700 dark:bg-slate-950"
            >
              <option value="updated">Sist oppdatert</option>
              <option value="name">Navn A-Å</option>
            </select>
          </label>

          <div className="md:col-span-2 xl:col-span-5">
            <button
              type="submit"
              className="rounded-xl bg-emerald-600 px-4 py-2 text-sm font-medium text-white hover:bg-emerald-500"
            >
              Oppdater liste
            </button>
          </div>
        </form>

        <p className="mt-3 text-sm text-slate-600 dark:text-slate-300">
          Viser {visibleFrom}-{visibleTo} av {totalFiltered} filtrerte varer ({totalAll} totalt).
        </p>
      </section>

      <section className="mt-5 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {products.map((product) => (
          <Link
            key={product.id}
            href={`/product/${product.id}`}
            className="rounded-2xl border border-slate-200 bg-white p-4 transition hover:border-emerald-300 hover:shadow-sm dark:border-slate-800 dark:bg-slate-900 dark:hover:border-emerald-800"
          >
            <div className="flex items-start justify-between gap-3">
              <div>
                <h2 className="text-lg font-semibold leading-tight">{product.name}</h2>
                <p className="mt-1 text-sm text-slate-600 dark:text-slate-300">
                  {product.brand} · {product.category}
                </p>
              </div>
              <span className="rounded-full bg-emerald-50 px-2 py-1 text-xs font-medium text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300">
                {product.packageLabel}
              </span>
            </div>

            <dl className="mt-4 grid grid-cols-2 gap-3 text-sm">
              <div>
                <dt className="text-xs uppercase tracking-wide text-slate-500">Laveste pris</dt>
                <dd className="mt-1 font-semibold">{formatNok(product.lowestPrice)}</dd>
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

        {products.length === 0 ? (
          <div className="md:col-span-2 xl:col-span-3 rounded-2xl border border-dashed border-slate-300 bg-slate-50/80 p-5 text-sm text-slate-600 dark:border-slate-700 dark:bg-slate-950/40 dark:text-slate-300">
            Ingen varer matcher filtrene dine. Prøv å nullstille søk eller velg bredere kategori/merke.
          </div>
        ) : null}
      </section>

      <section className="mt-5 flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-slate-200 bg-white px-4 py-3 dark:border-slate-800 dark:bg-slate-900">
        <p className="text-sm text-slate-600 dark:text-slate-300">Side {currentPage} av {totalPages}</p>

        <div className="flex items-center gap-2">
          {currentPage > 1 ? (
            <Link
              href={buildPageHref(currentPage - 1)}
              className="rounded-lg border border-slate-300 px-3 py-1.5 text-sm font-medium text-slate-700 transition hover:bg-slate-50 dark:border-slate-700 dark:text-slate-200 dark:hover:bg-slate-800"
            >
              Forrige
            </Link>
          ) : (
            <span className="rounded-lg border border-slate-200 px-3 py-1.5 text-sm font-medium text-slate-400 dark:border-slate-800 dark:text-slate-500">
              Forrige
            </span>
          )}

          {pageNumbers.map((page) => (
            <Link
              key={page}
              href={buildPageHref(page)}
              className={`rounded-lg px-3 py-1.5 text-sm font-medium transition ${
                page === currentPage
                  ? "bg-emerald-600 text-white"
                  : "border border-slate-300 text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:text-slate-200 dark:hover:bg-slate-800"
              }`}
            >
              {page}
            </Link>
          ))}

          {currentPage < totalPages ? (
            <Link
              href={buildPageHref(currentPage + 1)}
              className="rounded-lg border border-slate-300 px-3 py-1.5 text-sm font-medium text-slate-700 transition hover:bg-slate-50 dark:border-slate-700 dark:text-slate-200 dark:hover:bg-slate-800"
            >
              Neste
            </Link>
          ) : (
            <span className="rounded-lg border border-slate-200 px-3 py-1.5 text-sm font-medium text-slate-400 dark:border-slate-800 dark:text-slate-500">
              Neste
            </span>
          )}
        </div>
      </section>
    </>
  );
}
