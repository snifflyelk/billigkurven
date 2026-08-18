import { NextResponse } from "next/server";

import { getWeeklySavingsReport } from "@/lib/savings-report";
import { badRequest, serverError } from "@/lib/api-response";
import { getAuthenticatedSessionUserId } from "@/lib/user-session";

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const userId = await getAuthenticatedSessionUserId();
    const chain = searchParams.get("chain");

    if (!userId) {
      return badRequest("Innlogging kreves.", "Logg inn for a hente personlig sparerapport.");
    }

    const report = await getWeeklySavingsReport(userId, { chain });
    return NextResponse.json({ report });
  } catch (error) {
    return serverError(error, "Kunne ikke hente ukentlig sparerapport.");
  }
}