import Link from "next/link";

import { prisma } from "@/lib/prisma";
import { formatNok } from "@/lib/utils";

export const dynamic = "force-dynamic";

type CandidateProduct = {
  id: string;
  name: string;
  brand: string;
  category: string;
  storePrices: Map<string, { storeName: string; chain: string; price: number }>;
};

type BasketResult = {
  id: string;
  name: string;
  items: number;
  leader: { storeName: string; chain: string; total: number } | null;
  spread: number;
  coverage: number;
  rows: Array<{ storeId: string; storeName: string; chain: string; total: number; covered: number }>;
};

function pickProductsForBasket(candidates: CandidateProduct[], size: number) {
  const byCategory = new Map<string, CandidateProduct[]>();
  for (const product of candidates) {
    const key = product.category || "Ukjent";
    const list = byCategory.get(key) ?? [];
    list.push(product);
    byCategory.set(key, list);
  }

  const orderedCategories = Array.from(byCategory.entries()).sort((left, right) => right[1].length - left[1].length);
  const picked: CandidateProduct[] = [];

  let categoryCursor = 0;
  while (picked.length < size && orderedCategories.length > 0) {
    const [category, products] = orderedCategories[categoryCursor % orderedCategories.length];
    const candidate = products.shift();
    if (candidate) picked.push(candidate);
    if (products.length === 0) {
      byCategory.delete(category);
    }
    categoryCursor += 1;
  }

  if (picked.length < size) {
    const fallback = candidates.filter((product) => !picked.some((entry) => entry.id === product.id));
    for (const product of fallback) {
      picked.push(product);
      if (picked.length >= size) break;
    }
  }

  return picked.slice(0, size);
}

function evaluateBasket(id: string, name: string, products: CandidateProduct[]): BasketResult {
  const totals = new Map<string, { storeName: string; chain: string; total: number; covered: number }>();

  for (const product of products) {
    for (const [storeId, entry] of Array.from(product.storePrices.entries())) {
      const row = totals.get(storeId);
      if (row) {
        row.total += entry.price;
        row.covered += 1;
      } else {
        totals.set(storeId, {
          storeName: entry.storeName,
          chain: entry.chain,
          total: entry.price,
          covered: 1,
        });
      }
    }
  }

  const rows = Array.from(totals.entries())
    .map(([storeId, row]) => ({
      storeId,
      storeName: row.storeName,
      chain: row.chain,
      total: Number(row.total.toFixed(2)),
      covered: row.covered,
    }))
    .filter((row) => row.covered >= Math.max(3, Math.ceil(products.length * 0.5)))
    .sort((left, right) => left.total - right.total);

  const leader = rows[0]
    ? { storeName: rows[0].storeName, chain: rows[0].chain, total: rows[0].total }
    : null;
  const spread = rows.length > 1 ? Number((rows[rows.length - 1].total - rows[0].total).toFixed(2)) : 0;
  const coverage = products.length > 0 && rows.length > 0
    ? Math.round((rows[0].covered / products.length) * 100)
    : 0;

  return {
    id,
    name,
    items: products.length,
    leader,
    spread,
    coverage,
    rows,
  };
}

export default async function BenchmarkPage() {
  const productsRaw = await prisma.product.findMany({
    where: {
      prices: {
        some: { isQuarantined: false },
      },
    },
    include: {
      prices: {
        where: { isQuarantined: false },
        orderBy: { date: "desc" },
        include: {
          store: {
            select: {
              id: true,
              name: true,
              chain: true,
            },
          },
        },
      },
    },
    take: 500,
  }).catch(() => []);

  const candidates: CandidateProduct[] = productsRaw
    .map((product) => {
      const latestByStore = new Map<string, { storeName: string; chain: string; price: number }>();
      for (const row of product.prices) {
        if (latestByStore.has(row.storeId)) continue;
        latestByStore.set(row.storeId, {
          storeName: row.store.name,
          chain: row.store.chain,
          price: Number(row.price),
        });
      }
      return {
        id: product.id,
        name: product.name,
        brand: product.brand,
        category: product.category,
        storePrices: latestByStore,
      };
    })
    .filter((product) => product.storePrices.size >= 2);

  const basicBasket = pickProductsForBasket(candidates, 12);
  const familyBasket = pickProductsForBasket(candidates.filter((product) => !basicBasket.some((entry) => entry.id === product.id)), 20);
  const weekendBasket = pickProductsForBasket(candidates, 16);

  const baskets = [
    evaluateBasket("basic", "Basiskurv", basicBasket),
    evaluateBasket("family", "Familiekurv", familyBasket),
    evaluateBasket("weekend", "Helgekurv", weekendBasket),
  ];

  const totalRows = baskets.flatMap((basket) => basket.rows);
  const distinctStores = new Set(totalRows.map((row) => row.storeId)).size;
  const avgSpread = baskets.length > 0 ? Number((baskets.reduce((sum, row) => sum + row.spread, 0) / baskets.length).toFixed(2)) : 0;

  return (
    <main className="mx-auto max-w-6xl px-4 py-10 pb-16">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Markedbenchmark</h1>
          <p className="mt-2 max-w-3xl text-slate-600 dark:text-slate-300">
            Standardkurver som synliggjor prisforskjeller mellom butikker og kjeder akkurat na.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Link href="/compare" className="rounded-xl border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:text-slate-200 dark:hover:bg-slate-800">
            Til sammenligning
          </Link>
          <Link href="/savings" className="rounded-xl bg-emerald-600 px-4 py-2 text-sm font-medium text-white hover:bg-emerald-500">
            Til sparehistorikk
          </Link>
        </div>
      </div>

      <section className="mt-6 grid gap-4 md:grid-cols-3">
        <article className="rounded-2xl border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900">
          <p className="text-xs uppercase tracking-wide text-slate-500">Kurver analysert</p>
          <p className="mt-1 text-2xl font-semibold">{baskets.length}</p>
        </article>
        <article className="rounded-2xl border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900">
          <p className="text-xs uppercase tracking-wide text-slate-500">Butikker i benchmark</p>
          <p className="mt-1 text-2xl font-semibold">{distinctStores}</p>
        </article>
        <article className="rounded-2xl border border-emerald-200 bg-emerald-50/80 p-4 dark:border-emerald-900 dark:bg-emerald-950/25">
          <p className="text-xs uppercase tracking-wide text-emerald-700 dark:text-emerald-300">Snitt spread</p>
          <p className="mt-1 text-2xl font-semibold text-emerald-900 dark:text-emerald-100">{formatNok(avgSpread)}</p>
        </article>
      </section>

      <section className="mt-8 space-y-6">
        {baskets.map((basket) => (
          <article key={basket.id} className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <h2 className="text-xl font-semibold">{basket.name}</h2>
                <p className="mt-1 text-sm text-slate-600 dark:text-slate-300">
                  {basket.items} varer · Dekning {basket.coverage}% · Prisforskjell topp/bunn {formatNok(basket.spread)}
                </p>
              </div>
              <div className="rounded-2xl border border-emerald-300 bg-emerald-50 px-4 py-2 text-right dark:border-emerald-900 dark:bg-emerald-950/30">
                <p className="text-xs uppercase tracking-wide text-emerald-700 dark:text-emerald-300">Ledende butikk</p>
                <p className="mt-1 text-sm font-semibold text-emerald-900 dark:text-emerald-100">
                  {basket.leader ? `${basket.leader.storeName} (${basket.leader.chain})` : "Ikke klart"}
                </p>
                <p className="mt-0.5 text-xs text-emerald-800 dark:text-emerald-200">
                  {basket.leader ? formatNok(basket.leader.total) : "-"}
                </p>
              </div>
            </div>

            {basket.rows.length === 0 ? (
              <p className="mt-4 text-sm text-slate-500 dark:text-slate-400">For lite datagrunnlag til robust benchmark for denne kurven.</p>
            ) : (
              <div className="mt-4 overflow-x-auto rounded-2xl border border-slate-200 dark:border-slate-800">
                <table className="min-w-[44rem] w-full text-left text-sm">
                  <thead className="bg-slate-50 dark:bg-slate-950/50">
                    <tr>
                      <th className="px-3 py-2 font-medium">Butikk</th>
                      <th className="px-3 py-2 font-medium">Kjede</th>
                      <th className="px-3 py-2 font-medium">Kurvtotal</th>
                      <th className="px-3 py-2 font-medium">Diff mot leder</th>
                      <th className="px-3 py-2 font-medium">Dekning</th>
                    </tr>
                  </thead>
                  <tbody>
                    {basket.rows.map((row, index) => (
                      <tr key={`${basket.id}-${row.storeId}`} className={`border-t border-slate-200 dark:border-slate-800 ${index === 0 ? "bg-emerald-50/70 dark:bg-emerald-950/20" : ""}`}>
                        <td className="px-3 py-2 font-medium">{row.storeName}</td>
                        <td className="px-3 py-2">{row.chain}</td>
                        <td className="px-3 py-2">{formatNok(row.total)}</td>
                        <td className="px-3 py-2">{index === 0 ? "0" : `+ ${formatNok(row.total - basket.rows[0].total)}`}</td>
                        <td className="px-3 py-2">{row.covered}/{basket.items}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </article>
        ))}
      </section>
    </main>
  );
}
