"use server";

import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { getOrCreateSessionUserId } from "@/lib/user-session";

export async function savePreferencesAction(formData: FormData) {
  const userId = await getOrCreateSessionUserId();
  const primaryStore = String(formData.get("primaryStore") ?? "");
  const priceSensitivity = Number(formData.get("priceSensitivity") ?? 50);

  await prisma.userPreference.upsert({
    where: { userId },
    update: { primaryStore, priceSensitivity, useMembershipPricing: true },
    create: { userId, primaryStore, priceSensitivity, useMembershipPricing: true },
  });

  redirect("/shopping-list");
}

export async function createListAction(formData: FormData) {
  const userId = await getOrCreateSessionUserId();
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

  redirect("/shopping-list");
}

const TEMPLATE_KEYWORDS: Record<string, string[]> = {
  student: ["pasta", "tomat", "melk", "egg", "pizza", "gryn"],
  familie: ["brod", "melk", "egg", "kjott", "fisk", "ost"],
  budsjett: ["havre", "ris", "bøn", "tomat", "egg", "potet"],
  sunn: ["kylling", "yoghurt", "havre", "banan", "brokkoli", "laks"],
};

export async function createTemplateListAction(formData: FormData) {
  const userId = await getOrCreateSessionUserId();
  const template = String(formData.get("template") ?? "student").toLowerCase();
  const keywords = TEMPLATE_KEYWORDS[template] ?? TEMPLATE_KEYWORDS.student;

  const products = await prisma.product.findMany({
    where: {
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
