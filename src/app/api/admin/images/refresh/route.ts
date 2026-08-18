import { NextResponse } from "next/server";

import { apiError, serverError } from "@/lib/api-response";
import { runProductImageRefreshJob } from "@/lib/product-image-quality";

export async function POST(request: Request) {
  try {
    const configuredSecret = process.env.IMAGE_RECHECK_CRON_SECRET;
    const providedSecret = request.headers.get("x-image-recheck-secret");

    if (configuredSecret && providedSecret !== configuredSecret) {
      return apiError(401, {
        error: "Ugyldig scheduler-secret.",
        hint: "Send riktig x-image-recheck-secret header.",
        code: "UNAUTHORIZED",
      });
    }

    const body = (await request.json().catch(() => ({}))) as { limit?: number };
    const limit = Number.isFinite(body.limit) ? Math.max(10, Math.min(200, Number(body.limit))) : 80;

    const result = await runProductImageRefreshJob(limit);

    return NextResponse.json({
      ok: true,
      executedAt: new Date().toISOString(),
      ...result,
    });
  } catch (error) {
    return serverError(error, "Kunne ikke kjore bildeforbedringsjobb.");
  }
}
