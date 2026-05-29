"use client";

import { useState } from "react";
import { Bar, BarChart, CartesianGrid, Line, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { formatNok } from "@/lib/utils";

export function SavingsHistoryChart({
  weeklyData,
  monthlyData,
}: {
  weeklyData: { date: string; receiptSavings: number; cumulativeSavings: number }[];
  monthlyData: { date: string; receiptSavings: number; cumulativeSavings: number }[];
}) {
  const [mode, setMode] = useState<"week" | "month">("week");
  const data = mode === "week" ? weeklyData : monthlyData;

  if (data.length === 0) {
    return (
      <div className="flex h-72 items-center justify-center rounded-2xl border border-dashed border-slate-300 bg-white/70 p-4 text-sm text-slate-500 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-400">
        Ingen sparehistorikk ennå. Godkjente kvitteringer vil bygge grafen automatisk.
      </div>
    );
  }

  return (
    <div className="flex h-[22rem] flex-col rounded-2xl border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-800 dark:bg-slate-900">
      <div className="mb-3 flex flex-wrap gap-2">
        <button type="button" onClick={() => setMode("week")} className={`rounded-xl px-3 py-1.5 text-sm font-medium ${mode === "week" ? "bg-emerald-600 text-white" : "border border-slate-300 text-slate-700 dark:border-slate-700 dark:text-slate-200"}`}>
          Per uke
        </button>
        <button type="button" onClick={() => setMode("month")} className={`rounded-xl px-3 py-1.5 text-sm font-medium ${mode === "month" ? "bg-emerald-600 text-white" : "border border-slate-300 text-slate-700 dark:border-slate-700 dark:text-slate-200"}`}>
          Per måned
        </button>
      </div>
      <div className="min-h-0 flex-1">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={data}>
            <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
            <XAxis dataKey="date" tickFormatter={(value) => mode === "week" ? new Date(value).toLocaleDateString("nb-NO", { month: "short", day: "numeric" }) : value} />
            <YAxis tickFormatter={(value) => `${Math.round(value)} kr`} width={56} />
            <Tooltip
              labelFormatter={(value) => mode === "week" ? new Date(value).toLocaleDateString("nb-NO") : String(value)}
              formatter={(value, name) => [formatNok(Number(value ?? 0)), name === "cumulativeSavings" ? "Akkumulert spart" : "Spart på kvittering"]}
              contentStyle={{ borderRadius: 16, borderColor: "#d1d5db" }}
            />
            <Bar dataKey="receiptSavings" fill="#22c55e" radius={[8, 8, 0, 0]} />
            <Line type="monotone" dataKey="cumulativeSavings" stroke="#0891b2" strokeWidth={3} dot={{ r: 3, fill: "#0891b2" }} activeDot={{ r: 5 }} />
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}