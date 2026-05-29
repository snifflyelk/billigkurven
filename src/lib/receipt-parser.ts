export type ParsedReceipt = {
  recognizedText: string;
  detectedStore: string | null;
  detectedTotal: number | null;
  recognizedItems: ParsedReceiptLineItem[];
};

export type ParsedReceiptLineItem = {
  label: string;
  amount: number;
  quantity?: number;
  unitPrice?: number;
  kind: "item" | "summary" | "tax" | "discount";
};

const STORE_PATTERNS = [
  "Kiwi",
  "Rema 1000",
  "Coop Extra",
  "Meny",
  "Bunnpris",
  "Oda",
  "Spar",
  "Jacobs",
];

const IGNORE_LINE_PATTERNS = [
  /^(kvittering|receipt|invoice|faktura)$/i,
  /^(subtotal|sub total|mva|vat|mom?s)$/i,
  /^(total|totalt|sum|beløp|kontant|kort|vipps|rabatt|tilbake|vekslepenger)$/i,
  /^(orgnr|org\.nr|butikk|butikknummer|terminal|kasse|dato|tid|klokke)$/i,
];

const SUMMARY_PATTERNS = [
  /^(subtotal|sub total|mellomsum)[:\s]*kr?\s*([0-9]+[.,][0-9]{2})$/i,
  /^(total|totalt|sum|beløp)[:\s]*kr?\s*([0-9]+[.,][0-9]{2})$/i,
  /^(mva|vat|moms)[:\s]*kr?\s*([0-9]+[.,][0-9]{2})$/i,
  /^(rabatt|avslag)[:\s]*-?kr?\s*([0-9]+[.,][0-9]{2})$/i,
];

function toNumber(value: string) {
  return Number(value.replace(",", "."));
}

function parseLineItem(line: string): ParsedReceiptLineItem | null {
  const normalized = line.replace(/\s+/g, " ").trim();
  if (normalized.length < 4) return null;
  if (IGNORE_LINE_PATTERNS.some((pattern) => pattern.test(normalized))) return null;

  const summaryMatch = SUMMARY_PATTERNS
    .map((pattern) => normalized.match(pattern))
    .find((match): match is RegExpMatchArray => Boolean(match?.[2]));

  if (summaryMatch?.[1] && summaryMatch[2]) {
    const label = summaryMatch[1].trim();
    const amount = toNumber(summaryMatch[2]);
    if (!Number.isNaN(amount)) {
      const kind: ParsedReceiptLineItem["kind"] = /^(mva|vat|moms)$/i.test(label) ? "tax" : /^(rabatt|avslag)$/i.test(label) ? "discount" : "summary";
      return { label, amount, kind };
    }
  }

  const quantityMatch = normalized.match(/^(.*?)\s+(\d+(?:[.,]\d+)?)\s*x\s*([0-9]+[.,][0-9]{2})$/i);
  if (quantityMatch?.[1] && quantityMatch[3]) {
    const label = quantityMatch[1].trim();
    const quantity = toNumber(quantityMatch[2]);
    const unitPrice = toNumber(quantityMatch[3]);
    if (!Number.isNaN(quantity) && !Number.isNaN(unitPrice)) {
      return { label, amount: Number((quantity * unitPrice).toFixed(2)), quantity, unitPrice, kind: "item" };
    }
  }

  const quantityTotalMatch = normalized.match(/^(.*?)\s+(\d+(?:[.,]\d+)?)\s+([0-9]+[.,][0-9]{2})$/i);
  if (quantityTotalMatch?.[1] && quantityTotalMatch[2] && quantityTotalMatch[3]) {
    const label = quantityTotalMatch[1].trim();
    const quantity = toNumber(quantityTotalMatch[2]);
    const total = toNumber(quantityTotalMatch[3]);
    if (!Number.isNaN(quantity) && !Number.isNaN(total) && /\b(stk|pcs|pk|pakke|pose|flaske|boks|kg|g|l|ml)\b/i.test(normalized)) {
      return { label, amount: total, quantity, kind: "item" };
    }
  }

  const unitPriceMatch = normalized.match(/^(.*?)\s+([0-9]+[.,][0-9]{2})\s+([0-9]+[.,][0-9]{2})$/i);
  if (unitPriceMatch?.[1] && unitPriceMatch[2] && unitPriceMatch[3]) {
    const label = unitPriceMatch[1].trim();
    const quantity = toNumber(unitPriceMatch[2]);
    const unitPrice = toNumber(unitPriceMatch[3]);
    if (!Number.isNaN(quantity) && !Number.isNaN(unitPrice) && /\b(stk|pcs|pk|pakke|pose|flaske|boks|kg|g|l|ml)\b/i.test(normalized)) {
      return { label, amount: Number((quantity * unitPrice).toFixed(2)), quantity, unitPrice, kind: "item" };
    }
  }

  const amountMatch = normalized.match(/^(.*?)([0-9]+[.,][0-9]{2})$/);
  if (!amountMatch?.[1] || !amountMatch[2]) return null;

  const label = amountMatch[1].trim().replace(/[\-–,:]$/, "");
  const amount = toNumber(amountMatch[2]);

  if (!label || Number.isNaN(amount)) return null;
  if (label.length < 2) return null;

  return { label, amount, kind: /^(rabatt|avslag|mva|vat|moms|subtotal|sub total|mellomsum|total|totalt|sum|beløp)$/i.test(label) ? "summary" : "item" };
}

export function parseReceiptText(recognizedText: string): ParsedReceipt {
  const lines = recognizedText
    .split(/\r?\n/)
    .map((line) => line.replace(/\s+/g, " ").trim())
    .filter(Boolean);

  const normalizedText = lines.join(" ").trim();

  const detectedStore =
    STORE_PATTERNS.find((store) => normalizedText.toLowerCase().includes(store.toLowerCase())) ?? null;

  const totalMatches = [
    /(?:total(?:t|beløp)?|sum|beløp)[:\s]*kr?\s*([0-9]+[.,][0-9]{2})/i,
    /(?:total(?:t|beløp)?|sum|beløp)[:\s]*([0-9]+[.,][0-9]{2})/i,
    /\b([0-9]+[.,][0-9]{2})\s*$/m,
  ];

  let detectedTotal: number | null = null;
  for (const pattern of totalMatches) {
    const match = normalizedText.match(pattern);
    if (match?.[1]) {
      detectedTotal = Number(match[1].replace(",", "."));
      if (!Number.isNaN(detectedTotal)) break;
    }
  }

  const recognizedItems = lines
    .map(parseLineItem)
    .filter((item): item is ParsedReceiptLineItem => Boolean(item))
    .filter((item) => item.amount > 0)
    .filter((item, index, array) => array.findIndex((candidate) => candidate.label === item.label && candidate.amount === item.amount && candidate.kind === item.kind) === index)
    .slice(0, 16);

  return {
    recognizedText: normalizedText,
    detectedStore,
    detectedTotal: detectedTotal !== null && !Number.isNaN(detectedTotal) ? detectedTotal : null,
    recognizedItems,
  };
}
