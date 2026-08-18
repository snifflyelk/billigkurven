import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { searchProductsSchema } from "@/lib/validation";
import { badRequest, serverError } from "@/lib/api-response";

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const parsed = searchProductsSchema.safeParse({ q: searchParams.get("q") ?? "" });

    if (!parsed.success) {
      return badRequest("Ugyldig sok.", "Bruk query-parameter q med minst 2 tegn.", parsed.error.flatten());
    }

    const q = parsed.data.q;
    const recentCutoff = new Date(Date.now() - 21 * 24 * 60 * 60 * 1000);
    const products = await prisma.product.findMany({
      where: {
        NOT: {
          name: {
            startsWith: "Vare ",
          },
        },
        prices: {
          some: {
            isQuarantined: false,
            date: { gte: recentCutoff },
          },
        },
        OR: [
          { name: { contains: q, mode: "insensitive" } },
          { brand: { contains: q, mode: "insensitive" } },
          { category: { contains: q, mode: "insensitive" } },
        ],
      },
      take: 20,
      orderBy: { name: "asc" },
    });

    return NextResponse.json({ products });
  } catch (error) {
    return serverError(error, "Søk kunne ikke fullføres akkurat nå.");
  }
}
