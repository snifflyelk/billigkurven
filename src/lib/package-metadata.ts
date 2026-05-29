export type PackageUnitCode = "G" | "ML" | "STK";

export function derivePackageMetadata(...values: Array<string | null | undefined>) {
  const text = values.filter(Boolean).join(" ").toLowerCase();

  const kgMatch = text.match(/(\d+(?:[.,]\d+)?)\s*kg\b/);
  if (kgMatch) {
    return { packageQuantity: Number(kgMatch[1].replace(",", ".")) * 1000, packageUnit: "G" as PackageUnitCode };
  }

  const gramMatch = text.match(/(\d+(?:[.,]\d+)?)\s*g\b/);
  if (gramMatch) {
    return { packageQuantity: Number(gramMatch[1].replace(",", ".")), packageUnit: "G" as PackageUnitCode };
  }

  const literMatch = text.match(/(\d+(?:[.,]\d+)?)\s*l\b/);
  if (literMatch) {
    return { packageQuantity: Number(literMatch[1].replace(",", ".")) * 1000, packageUnit: "ML" as PackageUnitCode };
  }

  const mlMatch = text.match(/(\d+(?:[.,]\d+)?)\s*ml\b/);
  if (mlMatch) {
    return { packageQuantity: Number(mlMatch[1].replace(",", ".")), packageUnit: "ML" as PackageUnitCode };
  }

  const piecesMatch = text.match(/(\d+(?:[.,]\d+)?)\s*(stk|pk|pakke|poser|pose)\b/);
  if (piecesMatch) {
    return { packageQuantity: Number(piecesMatch[1].replace(",", ".")), packageUnit: "STK" as PackageUnitCode };
  }

  return { packageQuantity: null, packageUnit: null as PackageUnitCode | null };
}