import Link from "next/link";
import { Prisma } from "@prisma/client";

import { AllProductsCatalog, type CatalogProduct, type CatalogSortOption } from "@/components/all-products-catalog";
import { prisma } from "@/lib/prisma";
import { unstable_cache } from "next/cache";

export const dynamic = "force-dynamic";
const PAGE_SIZE = 25;

const getCachedCatalogPage = unstable_cache(
  async (query: string, category: string, brand: string, sortBy: CatalogSortOption, skip: number) => {
    const baseWhere: Prisma.ProductWhereInput = {
      NOT: { name: { startsWith: "Vare " } },
      prices: { some: { isQuarantined: false } },
    };
    const filteredWhere: Prisma.ProductWhereInput = {
      ...baseWhere,
      ...(query
        ? { OR: [{ name: { contains: query, mode: "insensitive" } }, { brand: { contains: query, mode: "insensitive" } }, { category: { contains: query, mode: "insensitive" } }] }
        : {}),
      ...(category !== "all" ? { category } : {}),
      ...(brand !== "all" ? { brand } : {}),
    };

    const [totalAll, totalFiltered, categoryRows, brandRows, products] = await Promise.all([
      prisma.product.count({ where: baseWhere }),
      prisma.product.count({ where: filteredWhere }),
      prisma.product.findMany({ where: baseWhere, distinct: ["category"], select: { category: true }, orderBy: { category: "asc" } }),
      prisma.product.findMany({ where: baseWhere, distinct: ["brand"], select: { brand: true }, orderBy: { brand: "asc" } }),
      prisma.product.findMany({
        where: filteredWhere,
        select: { id: true, name: true, brand: true, category: true, packageQuantity: true, packageUnit: true, updatedAt: true },
        orderBy: sortBy === "name" ? { name: "asc" } : { updatedAt: "desc" },
        skip,
        take: PAGE_SIZE,
      }),
    ]);

    const priceRows = await prisma.price.findMany({
      where: { isQuarantined: false, productId: { in: products.map((product) => product.id) } },
      select: { productId: true, storeId: true, price: true, date: true },
    });

    return { totalAll, totalFiltered, categoryRows, brandRows, products, priceRows };
  },
  ["catalog-page-data-v1"],
  { revalidate: 300 },
);

function formatPackageLabel(quantity: number | null, unit: "G" | "ML" | "STK" | null) {
  if (!quantity || !unit) return "Ukjent pakning";

  if (unit === "ML") {
    return quantity >= 1000 ? `${Number((quantity / 1000).toFixed(2)).toString().replace(".", ",")} l` : `${quantity} ml`;
  }

  if (unit === "G") {
    return quantity >= 1000 ? `${Number((quantity / 1000).toFixed(2)).toString().replace(".", ",")} kg` : `${quantity} g`;
  }

  return `${quantity} stk`;
}

export default async function AllProductsPage({
  searchParams,
}: {
  searchParams: {
    page?: string;
    q?: string;
    category?: string;
    brand?: string;
    sort?: string;
  };
}) {
  const pageCandidate = Number(searchParams.page ?? "1");
  const currentPage = Number.isFinite(pageCandidate) && pageCandidate > 0 ? Math.floor(pageCandidate) : 1;
  const query = (searchParams.q ?? "").trim();
  const category = (searchParams.category ?? "all").trim() || "all";
  const brand = (searchParams.brand ?? "all").trim() || "all";
  const sortBy: CatalogSortOption = searchParams.sort === "name" ? "name" : "updated";

  const initialSkip = (currentPage - 1) * PAGE_SIZE;
  let cachedPage = await getCachedCatalogPage(query, category, brand, sortBy, initialSkip);
  const { totalAll, totalFiltered, categoryRows, brandRows } = cachedPage;
  const totalPages = Math.max(1, Math.ceil(totalFiltered / PAGE_SIZE));
  const safeCurrentPage = Math.min(currentPage, totalPages);
  if (safeCurrentPage !== currentPage) {
    cachedPage = await getCachedCatalogPage(query, category, brand, sortBy, (safeCurrentPage - 1) * PAGE_SIZE);
  }
  const { products, priceRows } = cachedPage;

  if (totalAll === 0) {
    return (
      <main className="mx-auto max-w-5xl px-4 py-10">
        <h1 className="text-3xl font-bold tracking-tight">Alle varer</h1>
        <p className="mt-3 text-slate-600 dark:text-slate-300">Ingen varer med prisstatistikk er tilgjengelig ennå.</p>
        <Link href="/admin" className="mt-4 inline-flex rounded-xl bg-emerald-600 px-4 py-2 text-white hover:bg-emerald-500">
          Kjør prissynk i admin
        </Link>
      </main>
    );
  }

  const stats = new Map<
    string,
    {
      latestPrice: number;
      latestDate: Date;
      lowestPrice: number;
      highestPrice: number;
      dataPoints: number;
      stores: Set<string>;
    }
  >();

  for (const row of priceRows) {
    const numericPrice = Number(row.price);
    const existing = stats.get(row.productId);

    if (!existing) {
      stats.set(row.productId, {
        latestPrice: numericPrice,
        latestDate: row.date,
        lowestPrice: numericPrice,
        highestPrice: numericPrice,
        dataPoints: 1,
        stores: new Set([row.storeId]),
      });
      continue;
    }

    existing.dataPoints += 1;
    existing.stores.add(row.storeId);
    existing.lowestPrice = Math.min(existing.lowestPrice, numericPrice);
    existing.highestPrice = Math.max(existing.highestPrice, numericPrice);

    if (row.date > existing.latestDate) {
      existing.latestDate = row.date;
      existing.latestPrice = numericPrice;
    }
  }

  const catalogProducts: CatalogProduct[] = products
    .map((product) => {
      const productStats = stats.get(product.id);
      if (!productStats) return null;

      return {
        id: product.id,
        name: product.name,
        brand: product.brand,
        category: product.category,
        packageLabel: formatPackageLabel(product.packageQuantity, product.packageUnit),
        latestPrice: productStats.latestPrice,
        lowestPrice: productStats.lowestPrice,
        highestPrice: productStats.highestPrice,
        priceSpread: Number((productStats.highestPrice - productStats.lowestPrice).toFixed(2)),
        storeCount: productStats.stores.size,
        dataPoints: productStats.dataPoints,
        lastObservedAt: productStats.latestDate.toISOString(),
      };
    })
    .filter((product): product is CatalogProduct => Boolean(product));

  const categories = categoryRows.map((item) => item.category).filter((item): item is string => Boolean(item));
  const brands = brandRows.map((item) => item.brand).filter((item): item is string => Boolean(item));

  return (
    <main className="mx-auto max-w-6xl px-4 py-10 pb-24 md:pb-10">
      <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Alle varer</h1>
          <p className="mt-2 text-slate-600 dark:text-slate-300">
            Her ligger alle produkter vi faktisk har hentet inn prisstatistikk for, med logisk filtrering og sortering.
          </p>
        </div>
        <Link href="/compare" className="rounded-xl border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:text-slate-200 dark:hover:bg-slate-800">
          Gå til sammenligning
        </Link>
      </div>

      <AllProductsCatalog
        products={catalogProducts}
        categories={categories}
        brands={brands}
        filters={{ query, category, brand, sortBy }}
        currentPage={safeCurrentPage}
        totalPages={totalPages}
        totalFiltered={totalFiltered}
        totalAll={totalAll}
        pageSize={PAGE_SIZE}
      />
    </main>
  );
}
