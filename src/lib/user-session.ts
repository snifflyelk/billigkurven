import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { createHash, randomBytes } from "crypto";

import { DEFAULT_USER_EMAIL } from "@/lib/constants";
import { prisma } from "@/lib/prisma";

const SESSION_TOKEN_COOKIE = "bk_session";
const LEGACY_SESSION_USER_COOKIE = "bk_user_id";
const SESSION_TTL_SECONDS = 60 * 60 * 24 * 30;
const SESSION_ROTATE_AFTER_SECONDS = 60 * 60 * 24 * 7;

function hashSessionToken(token: string) {
  return createHash("sha256").update(token).digest("hex");
}

function buildSessionToken() {
  return randomBytes(32).toString("hex");
}

function getSessionExpiry() {
  return new Date(Date.now() + SESSION_TTL_SECONDS * 1000);
}

function buildGuestEmail() {
  return `guest-${crypto.randomUUID()}@billigkurven.local`;
}

function isGuestLikeEmail(email: string) {
  return email.endsWith("@billigkurven.local") || email === DEFAULT_USER_EMAIL;
}

export async function setSessionUserId(userId: string) {
  const token = buildSessionToken();
  const tokenHash = hashSessionToken(token);
  const expiresAt = getSessionExpiry();

  await prisma.userSession.create({
    data: {
      userId,
      tokenHash,
      expiresAt,
    },
  });

  const cookieStore = cookies();
  cookieStore.set(SESSION_TOKEN_COOKIE, token, {
    path: "/",
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    maxAge: SESSION_TTL_SECONDS,
  });
  cookieStore.delete(LEGACY_SESSION_USER_COOKIE);
}

export async function clearSessionUserId() {
  const cookieStore = cookies();
  const token = cookieStore.get(SESSION_TOKEN_COOKIE)?.value;
  if (token) {
    const tokenHash = hashSessionToken(token);
    await prisma.userSession.updateMany({
      where: { tokenHash, revokedAt: null },
      data: { revokedAt: new Date() },
    }).catch(() => undefined);
  }

  cookieStore.delete(SESSION_TOKEN_COOKIE);
  cookieStore.delete(LEGACY_SESSION_USER_COOKIE);
}

async function rotateSessionIfNeeded(input: { token: string; sessionId: string; createdAt: Date; userId: string }) {
  const ageMs = Date.now() - input.createdAt.getTime();
  const rotateAfterMs = SESSION_ROTATE_AFTER_SECONDS * 1000;
  if (ageMs < rotateAfterMs) return;

  const nextToken = buildSessionToken();
  const nextTokenHash = hashSessionToken(nextToken);
  const nextExpiresAt = getSessionExpiry();

  await prisma.$transaction([
    prisma.userSession.update({
      where: { id: input.sessionId },
      data: {
        revokedAt: new Date(),
        rotatedAt: new Date(),
      },
    }),
    prisma.userSession.create({
      data: {
        userId: input.userId,
        tokenHash: nextTokenHash,
        expiresAt: nextExpiresAt,
      },
    }),
  ]);

  const cookieStore = cookies();
  cookieStore.set(SESSION_TOKEN_COOKIE, nextToken, {
    path: "/",
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    maxAge: SESSION_TTL_SECONDS,
  });
}

async function upgradeLegacyCookieIfPresent() {
  const cookieStore = cookies();
  const legacyUserId = cookieStore.get(LEGACY_SESSION_USER_COOKIE)?.value;
  if (!legacyUserId) return null;

  const user = await prisma.user.findUnique({
    where: { id: legacyUserId },
    select: { id: true },
  });

  if (!user?.id) {
    cookieStore.delete(LEGACY_SESSION_USER_COOKIE);
    return null;
  }

  await setSessionUserId(user.id);
  return user.id;
}

export async function getOrCreateSessionUserId() {
  const sessionUserId = await getSessionUserId();
  if (sessionUserId) {
    return sessionUserId;
  }

  const created = await prisma.user.create({
    data: {
      email: buildGuestEmail(),
    },
    select: { id: true },
  });

  await setSessionUserId(created.id);

  return created.id;
}

export async function getSessionUserId() {
  const cookieStore = cookies();
  const token = cookieStore.get(SESSION_TOKEN_COOKIE)?.value;

  if (!token) {
    return upgradeLegacyCookieIfPresent();
  }

  const tokenHash = hashSessionToken(token);
  const now = new Date();

  const session = await prisma.userSession.findFirst({
    where: {
      tokenHash,
      revokedAt: null,
      expiresAt: { gt: now },
    },
    select: {
      id: true,
      userId: true,
      createdAt: true,
      user: { select: { id: true } },
    },
  });

  if (!session?.user?.id) {
    cookieStore.delete(SESSION_TOKEN_COOKIE);
    return upgradeLegacyCookieIfPresent();
  }

  await rotateSessionIfNeeded({
    token,
    sessionId: session.id,
    createdAt: session.createdAt,
    userId: session.userId,
  }).catch(() => undefined);

  return session.userId;
}

export async function getSessionUser() {
  const userId = await getSessionUserId();
  if (!userId) return null;

  return prisma.user.findUnique({
    where: { id: userId },
    select: { id: true, email: true, passwordHash: true },
  });
}

export async function getAuthenticatedSessionUser() {
  const user = await getSessionUser();
  if (!user) return null;
  if (!user.passwordHash) return null;
  if (isGuestLikeEmail(user.email)) return null;
  return user;
}

export async function getAuthenticatedSessionUserId() {
  const user = await getAuthenticatedSessionUser();
  return user?.id ?? null;
}

export async function requireAuthenticatedSessionUserId(nextPath = "/account") {
  const userId = await getAuthenticatedSessionUserId();
  if (!userId) {
    redirect(`/login?next=${encodeURIComponent(nextPath)}`);
  }
  return userId;
}

export async function getCurrentUserId() {
  const sessionUserId = await getSessionUserId();
  if (sessionUserId) return sessionUserId;

  const existingDefault = await prisma.user.findUnique({
    where: { email: DEFAULT_USER_EMAIL },
    select: { id: true },
  });

  if (existingDefault?.id) return existingDefault.id;

  const createdDefault = await prisma.user.create({
    data: { email: DEFAULT_USER_EMAIL },
    select: { id: true },
  });

  return createdDefault.id;
}
