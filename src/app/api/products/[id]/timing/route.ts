import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { filterOutlierValues } from "@/lib/pricing-sanity";
import { notFound, serverError } from "@/lib/api-response";

function avg(values: number[]) {
  if (values.length === 0) return null;
  return values.reduce((sum, value) => sum + value, 0) / values.length;
}

function stddev(values: number[]) {
  if (values.length < 2) return 0;
  const mean = avg(values) ?? 0;
  const variance = values.reduce((sum, value) => sum + (value - mean) ** 2, 0) / values.length;
  return Math.sqrt(variance);
}

export async function GET(_request: Request, { params }: { params: { id: string } }) {
  try {
    const product = await prisma.product.findUnique({
      where: { id: params.id },
      select: {
        id: true,
        name: true,
        prices: {
          where: { isQuarantined: false },
          orderBy: { date: "desc" },
          take: 300,
          select: {
            price: true,
            date: true,
          },
        },
      },
    });

    if (!product) {
      return notFound("Fant ikke produkt.", "Kontroller produkt-ID.");
    }

    const nowMs = Date.now();
    const dayMs = 24 * 60 * 60 * 1000;
    const last7Raw = product.prices
      .filter((row) => nowMs - row.date.getTime() <= 7 * dayMs)
      .map((row) => Number(row.price));
    const previous7Raw = product.prices
      .filter((row) => {
        const ageMs = nowMs - row.date.getTime();
        return ageMs > 7 * dayMs && ageMs <= 14 * dayMs;
      })
      .map((row) => Number(row.price));
    const last30Raw = product.prices
      .filter((row) => nowMs - row.date.getTime() <= 30 * dayMs)
      .map((row) => Number(row.price));

    const last7 = filterOutlierValues(last7Raw).values;
    const previous7 = filterOutlierValues(previous7Raw).values;
    const last30 = filterOutlierValues(last30Raw).values;

    const last7Avg = avg(last7);
    const previous7Avg = avg(previous7);
    const last30Avg = avg(last30);
    const latest = product.prices[0] ? Number(product.prices[0].price) : null;
    const changePct =
      last7Avg !== null && previous7Avg !== null && previous7Avg > 0
        ? Number((((last7Avg - previous7Avg) / previous7Avg) * 100).toFixed(1))
        : null;

    const volatility = Number(stddev(last30).toFixed(2));
    const recommendation =
      changePct === null || latest === null
        ? "ukjent"
        : changePct <= -3
          ? "kjop-na"
          : changePct >= 3
            ? "vent"
            : "noytral";

    return NextResponse.json({
      productId: product.id,
      productName: product.name,
      datapoints: product.prices.length,
      latestPrice: latest,
      averages: {
        last7: last7Avg !== null ? Number(last7Avg.toFixed(2)) : null,
        previous7: previous7Avg !== null ? Number(previous7Avg.toFixed(2)) : null,
        last30: last30Avg !== null ? Number(last30Avg.toFixed(2)) : null,
      },
      changePct,
      volatility,
      recommendation,
      bestBuyWindow:
        recommendation === "kjop-na"
          ? "Prisene er fallende. Vindu for kjop ser gunstig ut na."
          : recommendation === "vent"
            ? "Prisene er stigende eller ustabile. Vent pa bedre tidspunkt hvis mulig."
            : "Prisbevegelsen er svak. Kjopevindu vurderes som nøytralt.",
    });
  } catch (error) {
    return serverError(error, "Kunne ikke beregne timing for produktet.");
  }
}
