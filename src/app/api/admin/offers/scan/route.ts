import { NextResponse } from "next/server";
import { z } from "zod";

import { badRequest, serverError } from "@/lib/api-response";
import { scanOfferFlyer } from "@/lib/offer-flyer-scan";

const offerScanSchema = z.object({
  chain: z.string().trim().min(2).max(80),
  flyerUrl: z.string().url().optional(),
  flyerText: z.string().trim().max(200000).optional(),
  maxItems: z.number().int().min(5).max(120).optional(),
}).refine((value) => Boolean(value.flyerUrl || value.flyerText), {
  message: "Send enten flyerUrl eller flyerText.",
  path: ["flyerText"],
});

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const parsed = offerScanSchema.safeParse(body);

    if (!parsed.success) {
      return badRequest(
        "Ugyldig tilbudsavis-foresporsel.",
        "Send chain + flyerUrl eller flyerText.",
        parsed.error.flatten(),
      );
    }

    const result = await scanOfferFlyer(parsed.data);

    return NextResponse.json({
      ok: true,
      scannedAt: new Date().toISOString(),
      ...result,
    });
  } catch (error) {
    return serverError(error, "Kunne ikke fullfore tilbudsavis-scan.");
  }
}
