import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { userPreferenceSchema } from "@/lib/validation";
import { badRequest, serverError } from "@/lib/api-response";

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const userId = searchParams.get("userId");

    if (!userId) {
      return badRequest("Mangler userId.", "Send userId som query parameter.");
    }

    const preferences = await prisma.userPreference.findUnique({ where: { userId } });
    return NextResponse.json({ preferences });
  } catch (error) {
    return serverError(error, "Kunne ikke hente brukerpreferanser.");
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const parsed = userPreferenceSchema.safeParse(body);

    if (!parsed.success) {
      return badRequest("Ugyldige preferanser.", "Send userId, primaryStore og priceSensitivity.", parsed.error.flatten());
    }

    const preferences = await prisma.userPreference.upsert({
      where: { userId: parsed.data.userId },
      update: {
        primaryStore: parsed.data.primaryStore,
        priceSensitivity: parsed.data.priceSensitivity,
        useMembershipPricing: parsed.data.useMembershipPricing ?? true,
        shoppingTripBudget: parsed.data.shoppingTripBudget ?? null,
        weeklyGroceryBudget: parsed.data.weeklyGroceryBudget ?? null,
      },
      create: {
        ...parsed.data,
        useMembershipPricing: parsed.data.useMembershipPricing ?? true,
        shoppingTripBudget: parsed.data.shoppingTripBudget ?? null,
        weeklyGroceryBudget: parsed.data.weeklyGroceryBudget ?? null,
      },
    });

    return NextResponse.json({ preferences });
  } catch (error) {
    return serverError(error, "Kunne ikke lagre brukerpreferanser.");
  }
}
