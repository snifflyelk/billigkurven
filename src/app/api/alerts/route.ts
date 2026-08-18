import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { apiError, badRequest, notFound, serverError } from "@/lib/api-response";
import { buildAlertUrgency, buildTimingSignal } from "@/lib/alerts/signal";
import { getAuthenticatedSessionUserId } from "@/lib/user-session";

async function requireAlertUserId() {
  const userId = await getAuthenticatedSessionUserId();
  if (!userId) {
    return null;
  }
  return userId;
}

export async function GET() {
  try {
    const userId = await requireAlertUserId();
    if (!userId) {
      return apiError(401, {
        error: "Innlogging kreves.",
        hint: "Logg inn for a hente personlige varsler.",
        code: "UNAUTHORIZED",
      });
    }

    const alerts = await prisma.priceAlert.findMany({
      where: { userId },
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
        targetDropPct: alert.targetDropPct,
        dropFromLast7Pct: timing.dropFromLast7Pct,
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
    return serverError(error, "Kunne ikke hente varsler akkurat nå.");
  }
}

export async function POST(request: Request) {
  try {
    const userId = await requireAlertUserId();
    if (!userId) {
      return apiError(401, {
        error: "Innlogging kreves.",
        hint: "Logg inn for a opprette personlige varsler.",
        code: "UNAUTHORIZED",
      });
    }

    const body = await request.json();
    const productId = typeof body.productId === "string" ? body.productId.trim() : "";

    if (!productId) {
      return badRequest("Mangler productId.", "Send gyldig productId i payload.");
    }

    const product = await prisma.product.findUnique({ where: { id: productId }, select: { id: true } });
    if (!product) {
      return notFound("Produkt ikke funnet.", "Kontroller productId.");
    }

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
          userId,
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
        userId,
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
