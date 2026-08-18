import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { userPreferenceSchema } from "@/lib/validation";
import { badRequest, serverError } from "@/lib/api-response";
import { getAuthenticatedSessionUserId } from "@/lib/user-session";

export async function GET(request: Request) {
  try {
    const userId = await getAuthenticatedSessionUserId();

    if (!userId) {
      return NextResponse.json({ message: "Ikke innlogget." }, { status: 401 });
    }

    const preferences = await prisma.userPreference.findUnique({ where: { userId } });
    return NextResponse.json({ preferences });
  } catch (error) {
    return serverError(error, "Kunne ikke hente brukerpreferanser.");
  }
}

export async function POST(request: Request) {
  try {
    const userId = await getAuthenticatedSessionUserId();
    if (!userId) {
      return NextResponse.json({ message: "Ikke innlogget." }, { status: 401 });
    }

    const body = await request.json();
    const parsed = userPreferenceSchema.safeParse({ ...body, userId });

    if (!parsed.success) {
      return badRequest("Ugyldige preferanser.", "Send userId, primaryStore og priceSensitivity.", parsed.error.flatten());
    }

    const preferences = await prisma.userPreference.upsert({
      where: { userId: parsed.data.userId },
      update: {
        postalCode: parsed.data.postalCode ?? null,
        postalPrefix: parsed.data.postalPrefix ?? null,
        travelMode: parsed.data.travelMode ?? "DRIVE",
        maxTravelMinutes: parsed.data.maxTravelMinutes ?? null,
        maxTravelKm: parsed.data.maxTravelKm ?? null,
        primaryStore: parsed.data.primaryStore,
        priceSensitivity: parsed.data.priceSensitivity,
        useMembershipPricing: parsed.data.useMembershipPricing ?? true,
        shoppingTripBudget: parsed.data.shoppingTripBudget ?? null,
        weeklyGroceryBudget: parsed.data.weeklyGroceryBudget ?? null,
      },
      create: {
        ...parsed.data,
        postalCode: parsed.data.postalCode ?? null,
        postalPrefix: parsed.data.postalPrefix ?? null,
        travelMode: parsed.data.travelMode ?? "DRIVE",
        maxTravelMinutes: parsed.data.maxTravelMinutes ?? null,
        maxTravelKm: parsed.data.maxTravelKm ?? null,
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
