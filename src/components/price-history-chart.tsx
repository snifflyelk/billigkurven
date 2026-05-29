"use client";

import { useState } from "react";

import { Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { formatNok } from "@/lib/utils";

const palette = ["#ea580c", "#059669", "#0284c7", "#7c3aed", "#dc2626", "#ca8a04", "#0f766e", "#2563eb"];

export function PriceHistoryChart({
  data,
  series,
}: {
  data: Array<{ date: string; averagePrice?: number | null } & Record<string, number | string | null | undefined>>;
  series: { key: string; label: string }[];
}) {
  const [hiddenSeries, setHiddenSeries] = useState<string[]>([]);

  if (data.length === 0) {
    return (
      <div className="flex h-72 items-center justify-center rounded-2xl border border-dashed border-slate-300 bg-white/70 p-4 text-sm text-slate-500 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-400">
        Ingen historikk ennå. Kjør flere syncer for å bygge prisutvikling over tid.
      </div>
    );
  }

  const visibleSeries = series.filter((entry) => !hiddenSeries.includes(entry.key));

  const toggleSeries = (seriesKey: string) => {
    setHiddenSeries((current) =>
      current.includes(seriesKey) ? current.filter((entry) => entry !== seriesKey) : [...current, seriesKey],
    );
  };

  return (
    <div className="h-72 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-800 dark:bg-slate-900">
      <div className="mb-3 flex flex-wrap gap-2 text-xs">
        {series.map((entry, index) => {
          const active = !hiddenSeries.includes(entry.key);
          const color = palette[index % palette.length];

          return (
          <button
            key={entry.key}
            type="button"
            onClick={() => toggleSeries(entry.key)}
            aria-pressed={active}
            className={active
              ? "inline-flex items-center gap-2 rounded-full border px-3 py-1.5 font-semibold shadow-sm transition border-emerald-950 bg-emerald-900 text-emerald-50 dark:border-emerald-700 dark:bg-emerald-800 dark:text-emerald-100"
              : "inline-flex items-center gap-2 rounded-full border px-3 py-1.5 font-medium opacity-55 transition border-slate-200 bg-slate-50 text-slate-500 hover:opacity-80 dark:border-slate-700 dark:bg-slate-800/70 dark:text-slate-400"
            }
          >
            <span className="h-2.5 w-2.5 rounded-full ring-2 ring-white/70 dark:ring-slate-950/70" style={{ backgroundColor: color }} />
            <span>{entry.label}</span>
            <span className={active ? "text-emerald-200 dark:text-emerald-300" : "text-slate-400 dark:text-slate-500"}>{active ? "på" : "av"}</span>
          </button>
        );})}
      </div>
      {visibleSeries.length === 0 ? (
        <div className="flex h-[calc(100%-2.5rem)] items-center justify-center rounded-2xl border border-dashed border-slate-300 bg-slate-50/70 text-sm text-slate-500 dark:border-slate-700 dark:bg-slate-950/50 dark:text-slate-400">
          Alle butikkgrafer er skjult. Trykk på en butikk over for å vise den igjen.
        </div>
      ) : (
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={data}>
          <XAxis dataKey="date" tickFormatter={(v) => new Date(v).toLocaleDateString("nb-NO", { month: "short", day: "numeric" })} />
          <YAxis tickFormatter={(value) => `${Math.round(value)} kr`} width={50} />
          <Tooltip
            labelFormatter={(v) => new Date(v).toLocaleDateString("nb-NO")}
            formatter={(value, _name, item) => [formatNok(Number(value ?? 0)), item.dataKey === "averagePrice" ? "Snitt" : String(item.name ?? "Pris")]}
            contentStyle={{ borderRadius: 16, borderColor: "#d1d5db" }}
          />
          {visibleSeries.map((entry, index) => {
            const color = palette[index % palette.length];

            return (
              <Line
                key={entry.key}
                type="monotone"
                dataKey={entry.key}
                name={entry.label}
                stroke={color}
                strokeWidth={2.5}
                dot={{ r: 2.5, fill: color }}
                activeDot={{ r: 4 }}
                connectNulls
              />
            );
          })}
        </LineChart>
      </ResponsiveContainer>
      )}
    </div>
  );
}
