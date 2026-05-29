import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { DEFAULT_USER_EMAIL } from "@/lib/constants";
import { badRequest, notFound, serverError } from "@/lib/api-response";

async function getDefaultUserId() {
  const existing = await prisma.user.findUnique({ where: { email: DEFAULT_USER_EMAIL } });
  if (existing) return existing.id;
  const created = await prisma.user.create({ data: { email: DEFAULT_USER_EMAIL } });
  return created.id;
}

export async function PATCH(request: Request, { params }: { params: { id: string } }) {
  try {
    const userId = await getDefaultUserId();
    const body = await request.json();

    const existing = await prisma.priceAlert.findUnique({ where: { id: params.id } });
    if (!existing || existing.userId !== userId) {
      return notFound("Varsel ikke funnet.", "Kontroller varsel-ID.");
    }

    const data: {
      targetPrice?: number | null;
      targetDropPct?: number | null;
      notifyOnBuyNow?: boolean;
      isActive?: boolean;
      lastTriggeredAt?: Date | null;
    } = {};

    if ("targetPrice" in body) {
      const targetPrice = body.targetPrice === null || body.targetPrice === "" ? null : Number(body.targetPrice);
      if (targetPrice !== null && (!Number.isFinite(targetPrice) || targetPrice <= 0)) {
        return badRequest("Ugyldig targetPrice.", "Bruk et positivt tall.");
      }
      data.targetPrice = targetPrice;
    }

    if ("targetDropPct" in body) {
      const targetDropPct = body.targetDropPct === null || body.targetDropPct === "" ? null : Number(body.targetDropPct);
      if (targetDropPct !== null && (!Number.isFinite(targetDropPct) || targetDropPct <= 0 || targetDropPct > 90)) {
        return badRequest("Ugyldig targetDropPct.", "Bruk prosent mellom 0 og 90.");
      }
      data.targetDropPct = targetDropPct;
    }

    if ("notifyOnBuyNow" in body) {
      data.notifyOnBuyNow = Boolean(body.notifyOnBuyNow);
    }

    if ("isActive" in body) {
      data.isActive = Boolean(body.isActive);
    }

    if ("lastTriggeredAt" in body) {
      data.lastTriggeredAt = body.lastTriggeredAt ? new Date(body.lastTriggeredAt) : null;
    }

    const alert = await prisma.priceAlert.update({
      where: { id: params.id },
      data,
      include: {
        product: true,
      },
    });

    return NextResponse.json({ alert });
  } catch (error) {
    return serverError(error, "Kunne ikke oppdatere varsel.");
  }
}

export async function DELETE(_request: Request, { params }: { params: { id: string } }) {
  try {
    const userId = await getDefaultUserId();
    const existing = await prisma.priceAlert.findUnique({ where: { id: params.id } });

    if (!existing || existing.userId !== userId) {
      return notFound("Varsel ikke funnet.", "Kontroller varsel-ID.");
    }

    await prisma.priceAlert.delete({ where: { id: params.id } });
    return NextResponse.json({ ok: true });
  } catch (error) {
    return serverError(error, "Kunne ikke slette varsel.");
  }
}
