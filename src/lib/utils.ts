import { clsx, type ClassValue } from "clsx";

export function cn(...inputs: ClassValue[]) {
  return clsx(inputs);
}

export function formatNok(value: number) {
  return new Intl.NumberFormat("nb-NO", {
    style: "currency",
    currency: "NOK",
    maximumFractionDigits: 2,
  }).format(value);
}

export function confidenceLabel(score: number) {
  if (score >= 75) return "Høy";
  if (score >= 45) return "Medium";
  return "Lav";
}
