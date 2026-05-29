import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import {
  shoppingListItemCreateSchema,
  shoppingListItemUpdateSchema,
} from "@/lib/validation";
import { badRequest, serverError } from "@/lib/api-response";

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const parsed = shoppingListItemCreateSchema.safeParse(body);

    if (!parsed.success) {
      return badRequest("Ugyldig varedata.", "Send shoppingListId, productId og quantity.", parsed.error.flatten());
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
    const body = await request.json();
    const parsed = shoppingListItemUpdateSchema.safeParse(body);

    if (!parsed.success) {
      return badRequest("Ugyldig oppdateringsdata.", "Send itemId og quantity i request body.", parsed.error.flatten());
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
    const { searchParams } = new URL(request.url);
    const itemId = searchParams.get("itemId");

    if (!itemId) {
      return badRequest("Mangler itemId.", "Send itemId som query parameter.");
    }

    await prisma.shoppingListItem.delete({ where: { id: itemId } });
    return NextResponse.json({ ok: true });
  } catch (error) {
    return serverError(error, "Kunne ikke slette vare fra handlelisten.");
  }
}
