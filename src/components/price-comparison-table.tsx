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

  return (
    <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm dark:border-slate-800 dark:bg-slate-900">
      <div className="overflow-x-auto">
        <table className="min-w-[38rem] w-full text-left text-sm">
        <thead className="bg-slate-100/80 dark:bg-slate-800/70">
          <tr>
            <th className="px-4 py-3 font-medium">Butikk</th>
            <th className="px-4 py-3 font-medium">Totalpris</th>
            <th className="px-4 py-3 font-medium">Differanse</th>
            <th className="px-4 py-3 font-medium">Status</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={row.storeName} className={`border-t border-slate-200 dark:border-slate-800 ${row.isCheapest ? "bg-emerald-50/60 dark:bg-emerald-950/15" : ""}`}>
              <td className="px-4 py-3">{row.storeName}</td>
              <td className="px-4 py-3 font-semibold">{formatNok(row.totalPrice)}</td>
              <td className="px-4 py-3 text-slate-600 dark:text-slate-300">
                {row.totalPrice === cheapest ? "0 kr" : `+ ${formatNok(row.totalPrice - cheapest)}`}
              </td>
              <td className="px-4 py-3">
                {row.isCheapest ? (
                  <span className="rounded-full bg-emerald-100 px-2 py-1 text-xs font-medium text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300">
                    Billigst
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
