"use server";

import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { requireAuthenticatedSessionUserId } from "@/lib/user-session";
import { appendLocalEvent } from "@/lib/local-event-log";

export async function savePreferencesAction(formData: FormData) {
  const userId = await requireAuthenticatedSessionUserId("/account");
  const experimentVariant = String(formData.get("experimentVariant") ?? "unknown");
  const primaryStore = String(formData.get("primaryStore") ?? "");
  const postalCodeRaw = String(formData.get("postalCode") ?? "");
  const postalCode = postalCodeRaw.replace(/\D/g, "").slice(0, 4) || null;
  const postalPrefix = postalCode?.slice(0, 1) ?? null;
  const travelModeRaw = String(formData.get("travelMode") ?? "DRIVE").toUpperCase();
  const travelMode = travelModeRaw === "WALK" ? "WALK" : "DRIVE";
  const maxTravelMinutesValue = Number(formData.get("maxTravelMinutes") ?? 0);
  const maxTravelKmValue = Number(formData.get("maxTravelKm") ?? 0);
  const priceSensitivity = Number(formData.get("priceSensitivity") ?? 50);
  const weeklyGroceryBudgetValue = Number(formData.get("weeklyGroceryBudget") ?? 0);
  const shoppingTripBudgetValue = Number(formData.get("shoppingTripBudget") ?? 0);
  const useMembershipPricing = formData.get("useMembershipPricing") === "on";
  const weeklyGroceryBudget = Number.isFinite(weeklyGroceryBudgetValue) && weeklyGroceryBudgetValue > 0
    ? Math.round(weeklyGroceryBudgetValue)
    : null;
  const shoppingTripBudget = Number.isFinite(shoppingTripBudgetValue) && shoppingTripBudgetValue > 0
    ? Math.round(shoppingTripBudgetValue)
    : null;
  const maxTravelMinutes = Number.isFinite(maxTravelMinutesValue) && maxTravelMinutesValue > 0
    ? Math.round(maxTravelMinutesValue)
    : null;
  const maxTravelKm = Number.isFinite(maxTravelKmValue) && maxTravelKmValue > 0
    ? Number(maxTravelKmValue.toFixed(1))
    : null;

  await prisma.userPreference.upsert({
    where: { userId },
    update: {
      primaryStore,
      postalCode,
      postalPrefix,
      travelMode,
      maxTravelMinutes,
      maxTravelKm,
      priceSensitivity,
      useMembershipPricing,
      weeklyGroceryBudget,
      shoppingTripBudget,
    },
    create: {
      userId,
      primaryStore,
      postalCode,
      postalPrefix,
      travelMode,
      maxTravelMinutes,
      maxTravelKm,
      priceSensitivity,
      useMembershipPricing,
      weeklyGroceryBudget,
      shoppingTripBudget,
    },
  });

  await appendLocalEvent({
    at: new Date().toISOString(),
    eventName: "onboarding_preferences_saved",
    eventProps: {
      experiment: "onboarding_value_cards_v1",
      variant: experimentVariant,
      useMembershipPricing,
      hasWeeklyBudget: weeklyGroceryBudget !== null,
      hasTripBudget: shoppingTripBudget !== null,
    },
    pathname: "/account",
    source: "server-action",
  });

  redirect("/account?saved=preferences");
}

export async function createListAction(formData: FormData) {
  const userId = await requireAuthenticatedSessionUserId("/account");
  const experimentVariant = String(formData.get("experimentVariant") ?? "unknown");
  const productIds = formData.getAll("productIds").map(String).filter(Boolean);

  const list = await prisma.shoppingList.create({ data: { userId } });

  if (productIds.length > 0) {
    await prisma.shoppingListItem.createMany({
      data: productIds.map((productId) => ({
        shoppingListId: list.id,
        productId,
        quantity: 1,
      })),
    });
  }

  await appendLocalEvent({
    at: new Date().toISOString(),
    eventName: "onboarding_list_created",
    eventProps: {
      experiment: "onboarding_value_cards_v1",
      variant: experimentVariant,
      selectedProducts: productIds.length,
    },
    pathname: "/account",
    source: "server-action",
  });

  redirect("/shopping-list");
}

const TEMPLATE_KEYWORDS: Record<string, string[]> = {
  student: ["pasta", "tomat", "melk", "egg", "pizza", "gryn"],
  familie: ["brod", "melk", "egg", "kjott", "fisk", "ost"],
  budsjett: ["havre", "ris", "bøn", "tomat", "egg", "potet"],
  sunn: ["kylling", "yoghurt", "havre", "banan", "brokkoli", "laks"],
};

export async function createTemplateListAction(formData: FormData) {
  const userId = await requireAuthenticatedSessionUserId("/account");
  const template = String(formData.get("template") ?? "student").toLowerCase();
  const keywords = TEMPLATE_KEYWORDS[template] ?? TEMPLATE_KEYWORDS.student;

  const products = await prisma.product.findMany({
    where: {
      NOT: [
        { name: { startsWith: "Vare " } },
        { name: { startsWith: "vare " } },
      ],
      OR: keywords.map((word) => ({
        OR: [
          { name: { contains: word, mode: "insensitive" } },
          { category: { contains: word, mode: "insensitive" } },
        ],
      })),
    },
    take: 10,
    orderBy: { name: "asc" },
  });

  const fallbackProducts =
    products.length > 0
      ? products
      : await prisma.product.findMany({
          where: {
            NOT: [
              { name: { startsWith: "Vare " } },
              { name: { startsWith: "vare " } },
            ],
          },
          take: 8,
          orderBy: { createdAt: "asc" },
        });

  const list = await prisma.shoppingList.create({ data: { userId } });
  await prisma.shoppingListItem.createMany({
    data: fallbackProducts.map((product) => ({
      shoppingListId: list.id,
      productId: product.id,
      quantity: 1,
    })),
  });

  redirect("/shopping-list");
}
