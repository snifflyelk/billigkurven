import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { adminPriceSchema } from "@/lib/validation";
import { badRequest, serverError } from "@/lib/api-response";

export async function GET() {
  try {
    const prices = await prisma.price.findMany({
      include: { product: true, store: true },
      orderBy: { date: "desc" },
      take: 200,
    });
    return NextResponse.json({ prices });
  } catch (error) {
    return serverError(error, "Kunne ikke hente prislinjer i admin.");
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const parsed = adminPriceSchema.safeParse(body);

    if (!parsed.success) {
      return badRequest("Ugyldig prisdata.", "Kontroller productId, storeId, price og unitPrice.", parsed.error.flatten());
    }

    const price = await prisma.price.create({
      data: {
        productId: parsed.data.productId,
        storeId: parsed.data.storeId,
        price: parsed.data.price,
        unitPrice: parsed.data.unitPrice,
        promoPrice: parsed.data.promoPrice ?? null,
        loyaltyPrice: parsed.data.loyaltyPrice ?? null,
        promoLabel: parsed.data.promoLabel?.trim() || null,
        promoValidFrom: parsed.data.promoValidFrom ? new Date(parsed.data.promoValidFrom) : null,
        promoValidTo: parsed.data.promoValidTo ? new Date(parsed.data.promoValidTo) : null,
        requiresMembership: parsed.data.requiresMembership ?? false,
        date: parsed.data.date ? new Date(parsed.data.date) : new Date(),
      },
    });

    return NextResponse.json({ price }, { status: 201 });
  } catch (error) {
    return serverError(error, "Kunne ikke opprette prislinje.");
  }
}

export async function PATCH(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const id = searchParams.get("id");
    const body = await request.json();

    if (!id) {
      return badRequest("Mangler id.", "Send id som query parameter.");
    }

    const parsed = adminPriceSchema.safeParse(body);
    if (!parsed.success) {
      return badRequest("Ugyldig prisdata.", "Kontroller feltene i request body.", parsed.error.flatten());
    }

    const price = await prisma.price.update({
      where: { id },
      data: {
        productId: parsed.data.productId,
        storeId: parsed.data.storeId,
        price: parsed.data.price,
        unitPrice: parsed.data.unitPrice,
        promoPrice: parsed.data.promoPrice ?? null,
        loyaltyPrice: parsed.data.loyaltyPrice ?? null,
        promoLabel: parsed.data.promoLabel?.trim() || null,
        promoValidFrom: parsed.data.promoValidFrom ? new Date(parsed.data.promoValidFrom) : null,
        promoValidTo: parsed.data.promoValidTo ? new Date(parsed.data.promoValidTo) : null,
        requiresMembership: parsed.data.requiresMembership ?? false,
        date: parsed.data.date ? new Date(parsed.data.date) : new Date(),
      },
    });

    return NextResponse.json({ price });
  } catch (error) {
    return serverError(error, "Kunne ikke oppdatere prislinje.");
  }
}

export async function DELETE(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const id = searchParams.get("id");

    if (!id) {
      return badRequest("Mangler id.", "Send id som query parameter.");
    }

    await prisma.price.delete({ where: { id } });
    return NextResponse.json({ ok: true });
  } catch (error) {
    return serverError(error, "Kunne ikke slette prislinje.");
  }
}
