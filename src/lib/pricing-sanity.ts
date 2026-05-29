type Numeric = number | null | undefined;

type SanityContext = {
  category?: string | null;
  packageUnit?: string | null;
  packageQuantity?: Numeric;
};

function median(values: number[]) {
  if (values.length === 0) return null;
  const sorted = values.slice().sort((left, right) => left - right);
  const middle = Math.floor(sorted.length / 2);
  if (sorted.length % 2 === 0) {
    return (sorted[middle - 1] + sorted[middle]) / 2;
  }
  return sorted[middle];
}

export function filterOutlierValues(values: number[]) {
  if (values.length < 4) {
    return { values, removed: 0, median: median(values) };
  }

  const med = median(values);
  if (med === null || med <= 0) {
    return { values, removed: 0, median: med };
  }

  const lowerBound = med * 0.45;
  const upperBound = med * 2.2;
  const filtered = values.filter((value) => value >= lowerBound && value <= upperBound);

  return {
    values: filtered.length > 0 ? filtered : values,
    removed: Math.max(0, values.length - filtered.length),
    median: med,
  };
}

export function filterLogicalPriceEntries<T extends { storeId: string }>(
  entries: T[],
  pickPrice: (entry: T) => number,
  pickUnitPrice?: (entry: T) => Numeric,
  context?: SanityContext,
) {
  if (entries.length < 3) {
    return {
      validEntries: entries,
      outlierStoreIds: new Set<string>(),
      medianPrice: entries.length > 0 ? median(entries.map(pickPrice)) : null,
    };
  }

  const category = (context?.category ?? "").toLowerCase();
  const packageUnit = (context?.packageUnit ?? "").toUpperCase();
  const packageQuantity = typeof context?.packageQuantity === "number" ? context.packageQuantity : null;

  function clearlyInvalidByContext(price: number, unitPrice: Numeric) {
    const unit = typeof unitPrice === "number" && Number.isFinite(unitPrice) ? unitPrice : null;

    if (category.includes("meieri") && packageUnit === "ML") {
      if (unit !== null && unit > 80) return true;
      if (packageQuantity !== null && packageQuantity >= 700 && price > 140) return true;
    }

    if ((category.includes("drikke") || category.includes("juice") || category.includes("brus")) && packageUnit === "ML") {
      if (unit !== null && unit > 120) return true;
      if (packageQuantity !== null && packageQuantity >= 700 && price > 220) return true;
    }

    return false;
  }

  const hardFilteredEntries = entries.filter((entry) => {
    const price = pickPrice(entry);
    if (!Number.isFinite(price) || price <= 0) return false;
    const unitPrice = pickUnitPrice ? pickUnitPrice(entry) : null;
    return !clearlyInvalidByContext(price, unitPrice);
  });

  const prices = hardFilteredEntries.map(pickPrice).filter((value) => Number.isFinite(value) && value > 0);
  const medPrice = median(prices);
  if (medPrice === null || medPrice <= 0) {
    return {
      validEntries: hardFilteredEntries.length > 0 ? hardFilteredEntries : entries,
      outlierStoreIds: new Set<string>(),
      medianPrice: medPrice,
    };
  }

  const unitValues = pickUnitPrice
    ? hardFilteredEntries
        .map((entry) => {
          const value = pickUnitPrice(entry);
          return typeof value === "number" && Number.isFinite(value) && value > 0 ? value : null;
        })
        .filter((value): value is number => value !== null)
    : [];
  const medUnit = unitValues.length >= 3 ? median(unitValues) : null;

  const outlierStoreIds = new Set<string>();
  const validEntries = hardFilteredEntries.filter((entry) => {
    const value = pickPrice(entry);
    const priceOutlier = value < medPrice * 0.45 || value > medPrice * 2.2;

    let unitOutlier = false;
    if (pickUnitPrice && medUnit !== null && medUnit > 0) {
      const unit = pickUnitPrice(entry);
      if (typeof unit === "number" && Number.isFinite(unit) && unit > 0) {
        unitOutlier = unit < medUnit * 0.45 || unit > medUnit * 2.2;
      }
    }

    const isOutlier = priceOutlier || unitOutlier;
    if (isOutlier) outlierStoreIds.add(entry.storeId);
    return !isOutlier;
  });

  return {
    validEntries: validEntries.length > 0 ? validEntries : entries,
    outlierStoreIds,
    medianPrice: medPrice,
  };
}
