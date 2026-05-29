import { NextResponse } from "next/server";

type ApiErrorPayload = {
  error: string;
  hint?: string;
  code?: string;
  details?: unknown;
};

export function apiError(status: number, payload: ApiErrorPayload) {
  return NextResponse.json(payload, { status });
}

export function badRequest(error: string, hint?: string, details?: unknown) {
  return apiError(400, {
    error,
    hint,
    code: "BAD_REQUEST",
    details,
  });
}

export function notFound(error: string, hint?: string) {
  return apiError(404, {
    error,
    hint,
    code: "NOT_FOUND",
  });
}

export function serverError(error: unknown, hint?: string) {
  return apiError(500, {
    error: error instanceof Error ? error.message : "Ukjent serverfeil.",
    hint,
    code: "INTERNAL_ERROR",
  });
}
