import type { Product } from "@prisma/client";
import Image from "next/image";
import { ArrowTrendingDownIcon, ArrowTrendingUpIcon, MinusIcon } from "@heroicons/react/24/outline";
import { isLikelyProductImageUrl } from "@/lib/live-pricing/providers/media";

export function ProductCard({ product, action }: { product: Product; action?: React.ReactNode }) {
  return (
    <article className="group overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm transition hover:-translate-y-0.5 hover:shadow-lg dark:border-slate-800 dark:bg-slate-900/70">
      <div className="relative aspect-[16/11] overflow-hidden border-b border-slate-200 bg-gradient-to-br from-slate-100 to-slate-50 dark:border-slate-800 dark:from-slate-900 dark:to-slate-950">
        {isLikelyProductImageUrl(product.imageUrl) ? (
          <Image src={product.imageUrl!} alt={product.name} fill className="h-full w-full object-contain bg-white/70 p-3" sizes="(max-width: 768px) 100vw, 33vw" />
        ) : null}
        <div className="absolute left-3 top-3 inline-flex items-center gap-1 rounded-full bg-emerald-100 px-2.5 py-1 text-[11px] font-semibold text-emerald-800 dark:bg-emerald-900/60 dark:text-emerald-100">
          <ArrowTrendingDownIcon className="h-3.5 w-3.5" aria-hidden />
          Pris ned siden forrige uke
        </div>
        <div className="absolute right-3 top-3 inline-flex items-center gap-1 rounded-full bg-white/90 px-2.5 py-1 text-[11px] font-semibold text-slate-700 shadow-sm dark:bg-slate-900/90 dark:text-slate-200">
          <MinusIcon className="h-3.5 w-3.5" aria-hidden />
          Billigst hos: ledende kjede
        </div>
      </div>

      <div className="p-5">
        <div className="mb-3 flex items-start justify-between gap-3">
          <div>
            <h3 className="text-lg font-semibold leading-snug text-slate-900 dark:text-slate-100">{product.name}</h3>
            <p className="text-sm text-slate-500 dark:text-slate-400">{product.brand}</p>
          </div>
          <span className="rounded-full bg-emerald-100 px-2 py-1 text-xs text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300">
            {product.category}
          </span>
        </div>
        <div className="space-y-3 rounded-2xl border border-slate-200 bg-slate-50/70 p-3 dark:border-slate-800 dark:bg-slate-950/50">
          <p className="inline-flex items-center rounded-full border border-cyan-200 bg-cyan-50 px-2.5 py-1 text-xs font-semibold text-cyan-800 dark:border-cyan-900 dark:bg-cyan-950/40 dark:text-cyan-200">
            Du sparer 12 kr vs snittpris
          </p>
          <div className="flex items-center justify-between gap-2 text-xs font-semibold">
            <span className="inline-flex items-center gap-1 text-emerald-700 dark:text-emerald-300">
              <ArrowTrendingDownIcon className="h-3.5 w-3.5" aria-hidden />
              -8% denne uken
            </span>
            <span className="inline-flex items-center gap-1 text-rose-600 dark:text-rose-300">
              <ArrowTrendingUpIcon className="h-3.5 w-3.5" aria-hidden />
              +2% i dag
            </span>
          </div>
          <div className="h-2 rounded-full bg-slate-200 dark:bg-slate-800" aria-hidden>
            <div className="h-2 w-[68%] rounded-full bg-gradient-to-r from-emerald-500 via-cyan-400 to-emerald-400" />
          </div>
          <div className="flex items-end gap-1 pt-1" aria-hidden>
            {[8, 10, 9, 13, 11, 15, 12, 16, 14, 18, 17, 20].map((height, index) => (
              <span key={`${product.id}-${index}`} className="w-full rounded-t bg-gradient-to-t from-emerald-500/70 to-cyan-400/70" style={{ height: `${height}px` }} />
            ))}
          </div>
        </div>
        <p className="mt-3 text-xs text-slate-400 dark:text-slate-500">EAN: {product.ean}</p>
        {action ? <div className="mt-4">{action}</div> : null}
      </div>
    </article>
  );
}
