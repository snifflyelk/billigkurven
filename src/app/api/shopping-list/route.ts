import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { apiError, serverError } from "@/lib/api-response";
import { getAuthenticatedSessionUserId } from "@/lib/user-session";

export async function GET(request: Request) {
  try {
    const userId = await getAuthenticatedSessionUserId();
    if (!userId) {
      return apiError(401, {
        error: "Innlogging kreves.",
        hint: "Logg inn for a hente personlig handleliste.",
        code: "UNAUTHORIZED",
      });
    }

    const list = await prisma.shoppingList.findFirst({
      where: { userId },
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
    return serverError(error, "Kunne ikke hente handleliste akkurat nå.");
  }
}

export async function POST(request: Request) {
  try {
    const userId = await getAuthenticatedSessionUserId();
    if (!userId) {
      return apiError(401, {
        error: "Innlogging kreves.",
        hint: "Logg inn for a opprette personlig handleliste.",
        code: "UNAUTHORIZED",
      });
    }

    await request.json().catch(() => ({}));

    const shoppingList = await prisma.shoppingList.create({
      data: {
        userId,
      },
      include: {
        items: true,
      },
    });

    return NextResponse.json({ shoppingList }, { status: 201 });
  } catch (error) {
    return serverError(error, "Kunne ikke opprette handleliste akkurat nå.");
  }
}
