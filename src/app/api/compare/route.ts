import { NextResponse } from "next/server";
import { compareShoppingList } from "@/lib/compare";
import { compareSchema } from "@/lib/validation";
import { badRequest, serverError } from "@/lib/api-response";

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const parsed = compareSchema.safeParse(body);

    if (!parsed.success) {
      return badRequest(
        "Ugyldig sammenligningsforesporsel.",
        "Send en gyldig shoppingListId i request body.",
        parsed.error.flatten(),
      );
    }

    const result = await compareShoppingList(parsed.data.shoppingListId);
    return NextResponse.json(result);
  } catch (error) {
    return serverError(error, "Sjekk at handlelisten finnes og prøv igjen.");
  }
}
