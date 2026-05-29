import { NextResponse } from "next/server";

import { DEFAULT_USER_EMAIL } from "@/lib/constants";
import { prisma } from "@/lib/prisma";
import { getWeeklySavingsReport } from "@/lib/savings-report";
import { badRequest, serverError } from "@/lib/api-response";

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const userIdFromQuery = searchParams.get("userId");
    const chain = searchParams.get("chain");

    let userId = userIdFromQuery ?? undefined;
    if (!userId) {
      const user = await prisma.user.findUnique({ where: { email: DEFAULT_USER_EMAIL }, select: { id: true } });
      userId = user?.id;
    }

    if (!userId) {
      return badRequest("Mangler bruker.", "Send userId eller fullfor onboarding for standardbruker.");
    }

    const report = await getWeeklySavingsReport(userId, { chain });
    return NextResponse.json({ report });
  } catch (error) {
    return serverError(error, "Kunne ikke hente ukentlig sparerapport.");
  }
}