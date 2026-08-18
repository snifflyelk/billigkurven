"use server";

import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { clearSessionUserId, setSessionUserId } from "@/lib/user-session";
import { hashPassword, verifyPassword } from "@/lib/password";

function sanitizeNext(value: FormDataEntryValue | null) {
  const next = String(value ?? "").trim();
  if (!next.startsWith("/")) return "/account";
  if (next.startsWith("//")) return "/account";
  return next;
}

function validateEmail(value: FormDataEntryValue | null) {
  const email = String(value ?? "").trim().toLowerCase();
  if (!email || !email.includes("@") || email.length > 255) return null;
  return email;
}

function validatePassword(value: FormDataEntryValue | null) {
  const password = String(value ?? "");
  if (password.length < 8) return null;
  return password;
}

export async function loginAction(formData: FormData) {
  const email = validateEmail(formData.get("email"));
  const password = validatePassword(formData.get("password"));
  const next = sanitizeNext(formData.get("next"));

  if (!email || !password) {
    redirect(`/login?error=${encodeURIComponent("Ugyldig e-post eller passord")}&next=${encodeURIComponent(next)}`);
  }

  const user = await prisma.user.findUnique({
    where: { email },
    select: { id: true, passwordHash: true },
  });

  if (!user?.passwordHash || !verifyPassword(password, user.passwordHash)) {
    redirect(`/login?error=${encodeURIComponent("Feil e-post eller passord")}&next=${encodeURIComponent(next)}`);
  }

  await setSessionUserId(user.id);
  redirect(next);
}

export async function registerAction(formData: FormData) {
  const email = validateEmail(formData.get("email"));
  const password = validatePassword(formData.get("password"));
  const next = sanitizeNext(formData.get("next"));

  if (!email || !password) {
    redirect(`/login?error=${encodeURIComponent("Bruk gyldig e-post og minst 8 tegn passord")}&next=${encodeURIComponent(next)}`);
  }

  const existing = await prisma.user.findUnique({
    where: { email },
    select: { id: true, passwordHash: true },
  });

  if (existing?.passwordHash) {
    redirect(`/login?error=${encodeURIComponent("Konto finnes allerede. Logg inn i stedet")}&next=${encodeURIComponent(next)}`);
  }

  const passwordHash = hashPassword(password);

  const user = existing
    ? await prisma.user.update({
        where: { id: existing.id },
        data: { passwordHash },
        select: { id: true },
      })
    : await prisma.user.create({
        data: { email, passwordHash },
        select: { id: true },
      });

  await setSessionUserId(user.id);
  redirect(next);
}

export async function logoutAction() {
  await clearSessionUserId();
  redirect("/");
}
