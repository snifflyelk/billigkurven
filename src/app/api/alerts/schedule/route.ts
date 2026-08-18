import { NextResponse } from "next/server";

import { apiError, serverError } from "@/lib/api-response";
import { evaluateAndDispatchAlerts } from "@/lib/alerts/engine";
import { getAlertDigestScheduleConfig, shouldRunAlertDigestNow } from "@/lib/alerts/schedule";

export async function POST(request: Request) {
  try {
    const configuredSecret = process.env.ALERT_DIGEST_CRON_SECRET;
    const providedSecret = request.headers.get("x-alert-digest-secret");

    if (configuredSecret && providedSecret !== configuredSecret) {
      return apiError(401, {
        error: "Ugyldig scheduler-secret.",
        hint: "Send riktig x-alert-digest-secret header.",
        code: "UNAUTHORIZED",
      });
    }

    const body = (await request.json().catch(() => ({}))) as { force?: boolean };
    const force = Boolean(body.force);

    if (!force && !shouldRunAlertDigestNow(new Date())) {
      return NextResponse.json({
        ok: true,
        skipped: true,
        reason: "outside-schedule-window",
        schedule: getAlertDigestScheduleConfig(),
      });
    }

    const result = await evaluateAndDispatchAlerts();

    return NextResponse.json({
      ok: true,
      skipped: false,
      executedAt: new Date().toISOString(),
      schedule: getAlertDigestScheduleConfig(),
      ...result,
    });
  } catch (error) {
    return serverError(error, "Kunne ikke kjore alert scheduler-jobb.");
  }
}
