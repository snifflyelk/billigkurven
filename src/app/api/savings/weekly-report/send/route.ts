import { NextResponse } from "next/server";

import { badRequest, serverError } from "@/lib/api-response";
import { getAuthenticatedSessionUserId } from "@/lib/user-session";
import { dispatchWeeklySavingsReport, type WeeklyReportChannel } from "@/lib/weekly-report-dispatch";

export async function POST(request: Request) {
  try {
    const body = (await request.json().catch(() => ({}))) as {
      chain?: string | null;
      channel?: WeeklyReportChannel;
    };

    const userId = await getAuthenticatedSessionUserId();

    if (!userId) {
      return badRequest("Innlogging kreves.", "Logg inn for a sende personlig ukesrapport.");
    }

    const channel: WeeklyReportChannel = body.channel === "push" ? "push" : "email";
    const result = await dispatchWeeklySavingsReport({
      userId,
      chain: body.chain ?? null,
      channel,
    });

    return NextResponse.json({
      ok: true,
      dispatchedAt: new Date().toISOString(),
      schedule: {
        day: process.env.WEEKLY_REPORT_DAY ?? "MONDAY",
        localHour: Number(process.env.WEEKLY_REPORT_HOUR ?? "8"),
      },
      ...result,
    });
  } catch (error) {
    return serverError(error, "Kunne ikke sende ukentlig sparerapport.");
  }
}
