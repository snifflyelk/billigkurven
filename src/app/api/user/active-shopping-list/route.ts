import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getAuthenticatedSessionUserId } from "@/lib/user-session";

export async function GET() {
  try {
    const userId = await getAuthenticatedSessionUserId();
    if (!userId) {
      return NextResponse.json({ isLoggedIn: false, hasActiveShoppingList: false });
    }

    const activeShoppingList = await prisma.shoppingList.findFirst({
      where: { userId },
      select: { id: true },
      orderBy: { createdAt: "desc" },
    });

    return NextResponse.json({ isLoggedIn: true, hasActiveShoppingList: Boolean(activeShoppingList) });
  } catch {
    return NextResponse.json({ isLoggedIn: false, hasActiveShoppingList: false });
  }
}
