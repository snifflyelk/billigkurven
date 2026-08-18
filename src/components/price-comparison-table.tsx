import { formatNok } from "@/lib/utils";

type Row = {
  storeName: string;
  totalPrice: number;
  isCheapest?: boolean;
};

export function PriceComparisonTable({ rows }: { rows: Row[] }) {
  if (rows.length === 0) {
    return (
      <div className="flex min-h-56 items-center justify-center rounded-2xl border border-dashed border-slate-300 bg-white/70 p-4 text-sm text-slate-500 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-400">
        Ingen butikkrader ennå. Sammenligningen blir sterkere når flere priser er tilgjengelige.
      </div>
    );
  }

  const cheapest = Math.min(...rows.map((row) => row.totalPrice));
  const mostExpensive = Math.max(...rows.map((row) => row.totalPrice));

  return (
    <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm dark:border-slate-800 dark:bg-slate-900">
      <div className="overflow-x-auto">
        <table className="min-w-[40rem] w-full text-left text-sm">
        <thead className="sticky top-0 z-10 bg-slate-100/95 backdrop-blur dark:bg-slate-800/95">
          <tr>
            <th className="px-4 py-3.5 font-semibold">Butikk</th>
            <th className="px-4 py-3.5 font-semibold">Totalpris</th>
            <th className="px-4 py-3.5 font-semibold">Differanse</th>
            <th className="px-4 py-3.5 font-semibold">Status</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={row.storeName} className={`border-t border-slate-200 dark:border-slate-800 ${row.isCheapest ? "bg-emerald-50/60 dark:bg-emerald-950/15" : row.totalPrice === mostExpensive ? "bg-rose-50/40 dark:bg-rose-950/10" : ""}`}>
              <td className="px-4 py-3.5 font-medium">{row.storeName}</td>
              <td className="px-4 py-3.5 font-semibold">{formatNok(row.totalPrice)}</td>
              <td className="px-4 py-3.5 text-slate-600 dark:text-slate-300">
                {row.totalPrice === cheapest
                  ? "0 kr (0%)"
                  : `+ ${formatNok(row.totalPrice - cheapest)} (${Math.round(((row.totalPrice - cheapest) / cheapest) * 100)}%)`}
              </td>
              <td className="px-4 py-3.5">
                {row.isCheapest ? (
                  <span className="rounded-full bg-emerald-100 px-2 py-1 text-xs font-medium text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300">
                    Billigst
                  </span>
                ) : row.totalPrice === mostExpensive ? (
                  <span className="rounded-full bg-rose-100 px-2 py-1 text-xs font-medium text-rose-700 dark:bg-rose-900/40 dark:text-rose-300">
                    Dyrest
                  </span>
                ) : (
                  <span className="text-slate-400">-</span>
                )}
              </td>
            </tr>
          ))}
        </tbody>
        </table>
      </div>
    </div>
  );
}
