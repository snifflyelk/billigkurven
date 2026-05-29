"use client";

import { Bar, BarChart, CartesianGrid, Cell, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { formatNok } from "@/lib/utils";

export function StoreComparisonChart({
  data,
}: {
  data: { storeName: string; totalPrice: number }[];
}) {
  if (data.length === 0) {
    return (
      <div className="flex h-80 items-center justify-center rounded-2xl border border-dashed border-slate-300 bg-white/70 p-4 text-sm text-slate-500 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-400">
        Ingen sammenligningsdata ennå. Legg til flere varer for å se butikkspennet.
      </div>
    );
  }

  const lowest = Math.min(...data.map((item) => item.totalPrice));
  const enriched = data.map((item) => ({ ...item, fill: item.totalPrice === lowest ? "#059669" : "#94a3b8" }));

  return (
    <div className="h-80 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-800 dark:bg-slate-900">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={enriched}>
          <CartesianGrid strokeDasharray="3 3" />
          <XAxis dataKey="storeName" />
          <YAxis tickFormatter={(value) => `${Math.round(value)} kr`} width={50} />
          <Tooltip formatter={(value) => [formatNok(Number(value ?? 0)), "Kurvpris"]} contentStyle={{ borderRadius: 16, borderColor: "#d1d5db" }} />
          <Bar dataKey="totalPrice" radius={[8, 8, 0, 0]}>
            {enriched.map((entry) => (
              <Cell key={entry.storeName} fill={entry.fill} />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
