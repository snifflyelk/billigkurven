import { NextResponse } from "next/server";

import { badRequest, serverError } from "@/lib/api-response";
import { DEFAULT_USER_EMAIL } from "@/lib/constants";
import { prisma } from "@/lib/prisma";
import { dispatchWeeklySavingsReport, type WeeklyReportChannel } from "@/lib/weekly-report-dispatch";

export async function POST(request: Request) {
  try {
    const body = (await request.json().catch(() => ({}))) as {
      userId?: string;
      chain?: string | null;
      channel?: WeeklyReportChannel;
    };

    let userId = body.userId;
    if (!userId) {
      const defaultUser = await prisma.user.findUnique({ where: { email: DEFAULT_USER_EMAIL }, select: { id: true } });
      userId = defaultUser?.id;
    }

    if (!userId) {
      return badRequest("Mangler bruker.", "Send userId eller fullfor onboarding for standardbruker.");
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
