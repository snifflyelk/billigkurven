import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { notFound, serverError } from "@/lib/api-response";

export async function GET(
  _request: Request,
  { params }: { params: { id: string } },
) {
  try {
    const product = await prisma.product.findUnique({
      where: { id: params.id },
      include: {
        prices: {
          where: { isQuarantined: false },
          include: { store: true },
          orderBy: { date: "desc" },
        },
      },
    });

    if (!product) {
      return notFound("Fant ikke produkt.", "Kontroller produkt-ID eller hent produktlisten pa nytt.");
    }

    const latestByStore = new Map<string, (typeof product.prices)[number]>();
    for (const price of product.prices) {
      if (!latestByStore.has(price.storeId)) {
        latestByStore.set(price.storeId, price);
      }
    }

    const now = Date.now();
    const weekMs = 7 * 24 * 60 * 60 * 1000;
    const historyBuckets = new Map<number, number[]>();
    for (const price of product.prices) {
      const ageWeeks = Math.floor((now - price.date.getTime()) / weekMs);
      if (ageWeeks < 0 || ageWeeks > 7) continue;
      const bucketIndex = 7 - ageWeeks;
      const current = historyBuckets.get(bucketIndex) ?? [];
      current.push(Number(price.price));
      historyBuckets.set(bucketIndex, current);
    }

    const latest = Number(product.prices[0]?.price ?? 0);
    const priceHistory = Array.from({ length: 8 }).map((_, i) => {
      const date = new Date(now - (7 - i) * weekMs).toISOString();
      const values = historyBuckets.get(i) ?? [];
      const averagePrice =
        values.length > 0 ? Number((values.reduce((sum, value) => sum + value, 0) / values.length).toFixed(2)) : latest;
      return {
        date,
        averagePrice,
      };
    });

    const last7 = product.prices
      .filter((row) => now - row.date.getTime() <= 7 * 24 * 60 * 60 * 1000)
      .map((row) => Number(row.price));
    const prev7 = product.prices
      .filter((row) => {
        const age = now - row.date.getTime();
        return age > 7 * 24 * 60 * 60 * 1000 && age <= 14 * 24 * 60 * 60 * 1000;
      })
      .map((row) => Number(row.price));

    const avg = (values: number[]) =>
      values.length > 0 ? values.reduce((sum, value) => sum + value, 0) / values.length : null;
    const last7Avg = avg(last7);
    const prev7Avg = avg(prev7);
    const changePct =
      last7Avg !== null && prev7Avg !== null && prev7Avg > 0
        ? Number((((last7Avg - prev7Avg) / prev7Avg) * 100).toFixed(1))
        : null;
    const timingSignal = changePct === null ? "ukjent" : changePct <= -3 ? "kjop-na" : changePct >= 3 ? "vent" : "noytral";

    return NextResponse.json({
      product,
      pricesByStore: Array.from(latestByStore.values()),
      priceHistory,
      timingSignal,
      changePct,
    });
  } catch (error) {
    return serverError(error, "Kunne ikke hente produktdata akkurat na.");
  }
}
