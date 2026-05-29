import { NextResponse } from "next/server";
import { evaluateAndDispatchAlerts } from "@/lib/alerts/engine";
import { serverError } from "@/lib/api-response";

export async function POST() {
  try {
    const result = await evaluateAndDispatchAlerts();
    return NextResponse.json(result);
  } catch (error) {
    return serverError(error, "Kunne ikke kjore alert-jobb.");
  }
}
