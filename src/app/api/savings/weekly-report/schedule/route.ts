import { NextResponse } from "next/server";

import { apiError, badRequest, serverError } from "@/lib/api-response";
import { DEFAULT_USER_EMAIL } from "@/lib/constants";
import { prisma } from "@/lib/prisma";
import { getWeeklyReportScheduleConfig, shouldRunWeeklyReportNow } from "@/lib/weekly-report-schedule";
import { dispatchWeeklySavingsReport, type WeeklyReportChannel } from "@/lib/weekly-report-dispatch";

export async function POST(request: Request) {
  try {
    const configuredSecret = process.env.WEEKLY_REPORT_CRON_SECRET;
    const providedSecret = request.headers.get("x-weekly-report-secret");

    if (configuredSecret && providedSecret !== configuredSecret) {
      return apiError(401, {
        error: "Ugyldig scheduler-secret.",
        hint: "Send riktig x-weekly-report-secret header.",
        code: "UNAUTHORIZED",
      });
    }

    const body = (await request.json().catch(() => ({}))) as {
      force?: boolean;
      userId?: string;
      chain?: string | null;
      channel?: WeeklyReportChannel;
    };

    const force = Boolean(body.force);
    if (!force && !shouldRunWeeklyReportNow(new Date())) {
      const schedule = getWeeklyReportScheduleConfig();
      return NextResponse.json({
        ok: true,
        skipped: true,
        reason: "outside-schedule-window",
        schedule,
      });
    }

    let userId = body.userId;
    if (!userId) {
      const defaultUser = await prisma.user.findUnique({ where: { email: DEFAULT_USER_EMAIL }, select: { id: true } });
      userId = defaultUser?.id;
    }

    if (!userId) {
      return badRequest("Mangler bruker for scheduler-jobb.", "Opprett standardbruker eller send userId i payload.");
    }

    const channel: WeeklyReportChannel = body.channel === "push" ? "push" : "email";
    const result = await dispatchWeeklySavingsReport({
      userId,
      chain: body.chain ?? null,
      channel,
    });

    return NextResponse.json({
      ok: true,
      skipped: false,
      executedAt: new Date().toISOString(),
      schedule: getWeeklyReportScheduleConfig(),
      ...result,
    });
  } catch (error) {
    return serverError(error, "Kunne ikke kjore ukentlig scheduler-jobb.");
  }
}
