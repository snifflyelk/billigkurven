import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import {
  shoppingListItemCreateSchema,
  shoppingListItemUpdateSchema,
} from "@/lib/validation";
import { apiError, badRequest, notFound, serverError } from "@/lib/api-response";
import { getAuthenticatedSessionUserId } from "@/lib/user-session";

async function requireShoppingListUserId() {
  return getAuthenticatedSessionUserId();
}

export async function POST(request: Request) {
  try {
    const userId = await requireShoppingListUserId();
    if (!userId) {
      return apiError(401, {
        error: "Innlogging kreves.",
        hint: "Logg inn for a endre personlig handleliste.",
        code: "UNAUTHORIZED",
      });
    }

    const body = await request.json();
    const parsed = shoppingListItemCreateSchema.safeParse(body);

    if (!parsed.success) {
      return badRequest("Ugyldig varedata.", "Send shoppingListId, productId og quantity.", parsed.error.flatten());
    }

    const list = await prisma.shoppingList.findUnique({
      where: { id: parsed.data.shoppingListId },
      select: { userId: true },
    });

    if (!list || list.userId !== userId) {
      return notFound("Handleliste ikke funnet.", "Kontroller at handlelisten tilhorer innlogget bruker.");
    }

    const item = await prisma.shoppingListItem.upsert({
      where: {
        shoppingListId_productId: {
          shoppingListId: parsed.data.shoppingListId,
          productId: parsed.data.productId,
        },
      },
      update: {
        quantity: {
          increment: parsed.data.quantity,
        },
      },
      create: parsed.data,
    });

    return NextResponse.json({ item }, { status: 201 });
  } catch (error) {
    return serverError(error, "Kunne ikke legge til vare i handlelisten.");
  }
}

export async function PATCH(request: Request) {
  try {
    const userId = await requireShoppingListUserId();
    if (!userId) {
      return apiError(401, {
        error: "Innlogging kreves.",
        hint: "Logg inn for a endre personlig handleliste.",
        code: "UNAUTHORIZED",
      });
    }

    const body = await request.json();
    const parsed = shoppingListItemUpdateSchema.safeParse(body);

    if (!parsed.success) {
      return badRequest("Ugyldig oppdateringsdata.", "Send itemId og quantity i request body.", parsed.error.flatten());
    }

    const existingItem = await prisma.shoppingListItem.findUnique({
      where: { id: parsed.data.itemId },
      select: { shoppingList: { select: { userId: true } } },
    });

    if (!existingItem || existingItem.shoppingList.userId !== userId) {
      return notFound("Varelinje ikke funnet.", "Kontroller at varelinjen tilhorer innlogget bruker.");
    }

    const item = await prisma.shoppingListItem.update({
      where: { id: parsed.data.itemId },
      data: { quantity: parsed.data.quantity },
    });

    return NextResponse.json({ item });
  } catch (error) {
    return serverError(error, "Kunne ikke oppdatere vare i handlelisten.");
  }
}

export async function DELETE(request: Request) {
  try {
    const userId = await requireShoppingListUserId();
    if (!userId) {
      return apiError(401, {
        error: "Innlogging kreves.",
        hint: "Logg inn for a endre personlig handleliste.",
        code: "UNAUTHORIZED",
      });
    }

    const { searchParams } = new URL(request.url);
    const itemId = searchParams.get("itemId");

    if (!itemId) {
      return badRequest("Mangler itemId.", "Send itemId som query parameter.");
    }

    const existingItem = await prisma.shoppingListItem.findUnique({
      where: { id: itemId },
      select: { shoppingList: { select: { userId: true } } },
    });

    if (!existingItem || existingItem.shoppingList.userId !== userId) {
      return notFound("Varelinje ikke funnet.", "Kontroller at varelinjen tilhorer innlogget bruker.");
    }

    await prisma.shoppingListItem.delete({ where: { id: itemId } });
    return NextResponse.json({ ok: true });
  } catch (error) {
    return serverError(error, "Kunne ikke slette vare fra handlelisten.");
  }
}
