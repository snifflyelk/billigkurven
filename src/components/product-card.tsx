import type { Product } from "@prisma/client";

export function ProductCard({ product, action }: { product: Product; action?: React.ReactNode }) {
  return (
    <article className="group rounded-2xl border border-slate-200 bg-white/90 p-4 shadow-sm transition hover:-translate-y-1 hover:shadow-md dark:border-slate-800 dark:bg-slate-900/70">
      <div className="mb-3 flex items-start justify-between gap-3">
        <div>
          <h3 className="font-semibold text-slate-900 dark:text-slate-100">{product.name}</h3>
          <p className="text-sm text-slate-500 dark:text-slate-400">{product.brand}</p>
        </div>
        <span className="rounded-full bg-emerald-100 px-2 py-1 text-xs text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300">
          {product.category}
        </span>
      </div>
      <p className="text-xs text-slate-400 dark:text-slate-500">EAN: {product.ean}</p>
      {action ? <div className="mt-4">{action}</div> : null}
    </article>
  );
}
