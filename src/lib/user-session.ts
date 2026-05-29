import { cookies } from "next/headers";

import { prisma } from "@/lib/prisma";

const SESSION_USER_COOKIE = "bk_user_id";

function buildGuestEmail() {
  return `guest-${crypto.randomUUID()}@billigkurven.local`;
}

export async function getOrCreateSessionUserId() {
  const cookieStore = cookies();
  const sessionUserId = cookieStore.get(SESSION_USER_COOKIE)?.value;

  if (sessionUserId) {
    const existing = await prisma.user.findUnique({
      where: { id: sessionUserId },
      select: { id: true },
    });

    if (existing?.id) {
      return existing.id;
    }
  }

  const created = await prisma.user.create({
    data: {
      email: buildGuestEmail(),
    },
    select: { id: true },
  });

  cookieStore.set(SESSION_USER_COOKIE, created.id, {
    path: "/",
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    maxAge: 60 * 60 * 24 * 180,
  });

  return created.id;
}
