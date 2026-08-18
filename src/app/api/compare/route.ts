import { NextResponse } from "next/server";
import { compareShoppingList } from "@/lib/compare";
import { compareSchema } from "@/lib/validation";
import { apiError, badRequest, notFound, serverError } from "@/lib/api-response";
import { getAuthenticatedSessionUserId } from "@/lib/user-session";
import { prisma } from "@/lib/prisma";

export async function POST(request: Request) {
  try {
    const userId = await getAuthenticatedSessionUserId();
    if (!userId) {
      return apiError(401, {
        error: "Innlogging kreves.",
        hint: "Logg inn for a hente personlig sammenligning.",
        code: "UNAUTHORIZED",
      });
    }

    const body = await request.json();
    const parsed = compareSchema.safeParse(body);

    if (!parsed.success) {
      return badRequest(
        "Ugyldig sammenligningsforesporsel.",
        "Send en gyldig shoppingListId i request body.",
        parsed.error.flatten(),
      );
    }

    const ownedList = await prisma.shoppingList.findFirst({
      where: { id: parsed.data.shoppingListId, userId },
      select: { id: true },
    });
    if (!ownedList) {
      return notFound("Handleliste ikke funnet.", "Kontroller at handlelisten tilhorer innlogget bruker.");
    }

    const result = await compareShoppingList(parsed.data.shoppingListId, {
      postalPrefix: parsed.data.postalPrefix ?? null,
      postalCode: parsed.data.postalCode ?? null,
      travelMode: parsed.data.travelMode ?? null,
      maxTravelMinutes: parsed.data.maxTravelMinutes ?? null,
      maxTravelKm: parsed.data.maxTravelKm ?? null,
    });
    return NextResponse.json(result);
  } catch (error) {
    return serverError(error, "Sjekk at handlelisten finnes og prøv igjen.");
  }
}
