"use client";

import { useMemo, useState } from "react";

type PriceSensitivitySliderProps = {
  initialValue: number;
};

function clampValue(value: number) {
  if (!Number.isFinite(value)) return 70;
  return Math.max(0, Math.min(100, Math.round(value)));
}

export function PriceSensitivitySlider({ initialValue }: PriceSensitivitySliderProps) {
  const safeInitial = useMemo(() => clampValue(initialValue), [initialValue]);
  const [value, setValue] = useState(safeInitial);

  return (
    <div>
      <label className="mt-4 block text-sm font-medium" htmlFor="price-sensitivity-range">
        Prisfokus (0-100) ({value}%{value === 100 ? " - pris er ekstremt viktig" : ""})
      </label>
      <input
        id="price-sensitivity-range"
        type="range"
        min={0}
        max={100}
        value={value}
        name="priceSensitivity"
        onChange={(event) => setValue(clampValue(Number(event.target.value)))}
        className="mt-2 w-full"
      />
      <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">(100 vil si at pris er ekstremt viktig)</p>
    </div>
  );
}
