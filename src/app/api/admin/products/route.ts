import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { derivePackageMetadata } from "@/lib/package-metadata";
import { adminProductSchema } from "@/lib/validation";
import { badRequest, serverError } from "@/lib/api-response";

export async function GET() {
  try {
    const products = await prisma.product.findMany({
      orderBy: { createdAt: "desc" },
      take: 100,
    });
    return NextResponse.json({ products });
  } catch (error) {
    return serverError(error, "Kunne ikke hente produkter i admin.");
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const parsed = adminProductSchema.safeParse(body);

    if (!parsed.success) {
      return badRequest("Ugyldig produktdata.", "Kontroller navn, merke, EAN og kategori.", parsed.error.flatten());
    }

    const derivedPackage = derivePackageMetadata(parsed.data.name);

    const product = await prisma.product.create({
      data: {
        ...parsed.data,
        imageUrl: parsed.data.imageUrl || null,
        packageQuantity: parsed.data.packageQuantity ?? derivedPackage.packageQuantity,
        packageUnit: parsed.data.packageUnit ?? derivedPackage.packageUnit,
      },
    });

    return NextResponse.json({ product }, { status: 201 });
  } catch (error) {
    return serverError(error, "Kunne ikke opprette produkt.");
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

    const parsed = adminProductSchema.safeParse(body);
    if (!parsed.success) {
      return badRequest("Ugyldig produktdata.", "Kontroller feltene i request body.", parsed.error.flatten());
    }

    const derivedPackage = derivePackageMetadata(parsed.data.name);

    const product = await prisma.product.update({
      where: { id },
      data: {
        ...parsed.data,
        imageUrl: parsed.data.imageUrl || null,
        packageQuantity: parsed.data.packageQuantity ?? derivedPackage.packageQuantity,
        packageUnit: parsed.data.packageUnit ?? derivedPackage.packageUnit,
      },
    });

    return NextResponse.json({ product });
  } catch (error) {
    return serverError(error, "Kunne ikke oppdatere produkt.");
  }
}

export async function DELETE(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const id = searchParams.get("id");

    if (!id) {
      return badRequest("Mangler id.", "Send id som query parameter.");
    }

    await prisma.product.delete({ where: { id } });
    return NextResponse.json({ ok: true });
  } catch (error) {
    return serverError(error, "Kunne ikke slette produkt.");
  }
}
