import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { DEFAULT_USER_EMAIL } from "@/lib/constants";
import { badRequest, notFound, serverError } from "@/lib/api-response";
import { buildAlertUrgency, buildTimingSignal } from "@/lib/alerts/signal";

async function getDefaultUser() {
  const existing = await prisma.user.findUnique({ where: { email: DEFAULT_USER_EMAIL } });
  if (existing) return existing;
  return prisma.user.create({ data: { email: DEFAULT_USER_EMAIL } });
}

export async function GET() {
  try {
    const user = await getDefaultUser();
    const alerts = await prisma.priceAlert.findMany({
      where: { userId: user.id },
      orderBy: [{ isActive: "desc" }, { updatedAt: "desc" }],
      include: {
        product: {
          include: {
            prices: {
              where: { isQuarantined: false },
              include: { store: true },
              orderBy: { date: "desc" },
              take: 30,
            },
          },
        },
      },
    });

    const enriched = alerts.map((alert) => {
      const timing = buildTimingSignal(
        alert.product.prices.map((row) => ({
          price: Number(row.price),
          date: row.date,
        })),
      );
      const latestPrice = alert.product.prices[0] ? Number(alert.product.prices[0].price) : null;
      const urgency = buildAlertUrgency({
        latestPrice,
        targetPrice: alert.targetPrice !== null ? Number(alert.targetPrice) : null,
        recommendation: timing.recommendation,
      });

      return {
        ...alert,
        latestPrice,
        timing,
        urgency,
      };
    });

    return NextResponse.json({ alerts: enriched });
  } catch (error) {
    return serverError(error, "Kunne ikke hente varsler akkurat na.");
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const productId = typeof body.productId === "string" ? body.productId.trim() : "";

    if (!productId) {
      return badRequest("Mangler productId.", "Send gyldig productId i payload.");
    }

    const product = await prisma.product.findUnique({ where: { id: productId }, select: { id: true } });
    if (!product) {
      return notFound("Produkt ikke funnet.", "Kontroller productId.");
    }

    const user = await getDefaultUser();

    const parsedTargetPrice =
      body.targetPrice === null || body.targetPrice === undefined || body.targetPrice === ""
        ? null
        : Number(body.targetPrice);
    const parsedDropPct =
      body.targetDropPct === null || body.targetDropPct === undefined || body.targetDropPct === ""
        ? null
        : Number(body.targetDropPct);

    if (parsedTargetPrice !== null && (!Number.isFinite(parsedTargetPrice) || parsedTargetPrice <= 0)) {
      return badRequest("Ugyldig targetPrice.", "Bruk et positivt tall.");
    }

    if (parsedDropPct !== null && (!Number.isFinite(parsedDropPct) || parsedDropPct <= 0 || parsedDropPct > 90)) {
      return badRequest("Ugyldig targetDropPct.", "Bruk prosent mellom 0 og 90.");
    }

    const notifyOnBuyNow = body.notifyOnBuyNow === undefined ? true : Boolean(body.notifyOnBuyNow);

    const alert = await prisma.priceAlert.upsert({
      where: {
        userId_productId: {
          userId: user.id,
          productId,
        },
      },
      update: {
        targetPrice: parsedTargetPrice,
        targetDropPct: parsedDropPct,
        notifyOnBuyNow,
        isActive: true,
      },
      create: {
        userId: user.id,
        productId,
        targetPrice: parsedTargetPrice,
        targetDropPct: parsedDropPct,
        notifyOnBuyNow,
        isActive: true,
      },
      include: {
        product: true,
      },
    });

    return NextResponse.json({ alert }, { status: 201 });
  } catch (error) {
    return serverError(error, "Kunne ikke opprette varsel.");
  }
}
