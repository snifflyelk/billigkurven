import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { shoppingListSchema } from "@/lib/validation";
import { badRequest, serverError } from "@/lib/api-response";

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const userId = searchParams.get("userId") ?? "";
    const parsed = shoppingListSchema.safeParse({ userId });

    if (!parsed.success) {
      return badRequest("Ugyldig bruker.", "Send en gyldig userId i query parameter.", parsed.error.flatten());
    }

    const list = await prisma.shoppingList.findFirst({
      where: { userId: parsed.data.userId },
      include: {
        items: {
          include: {
            product: true,
          },
        },
      },
      orderBy: { createdAt: "desc" },
    });

    return NextResponse.json({ shoppingList: list });
  } catch (error) {
    return serverError(error, "Kunne ikke hente handleliste akkurat na.");
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const parsed = shoppingListSchema.safeParse(body);

    if (!parsed.success) {
      return badRequest("Ugyldig data for handleliste.", "Send userId i request body.", parsed.error.flatten());
    }

    const shoppingList = await prisma.shoppingList.create({
      data: {
        userId: parsed.data.userId,
      },
      include: {
        items: true,
      },
    });

    return NextResponse.json({ shoppingList }, { status: 201 });
  } catch (error) {
    return serverError(error, "Kunne ikke opprette handleliste akkurat na.");
  }
}
