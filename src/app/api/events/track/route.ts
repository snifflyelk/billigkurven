import { NextRequest, NextResponse } from "next/server";
import { appendLocalEvent } from "@/lib/local-event-log";

export async function POST(request: NextRequest) {
  try {
    const payload = await request.json();
    const eventName = typeof payload?.eventName === "string" ? payload.eventName.trim() : "";
    const eventProps = payload?.eventProps && typeof payload.eventProps === "object" ? payload.eventProps : undefined;
    const pathname = typeof payload?.pathname === "string" ? payload.pathname : null;

    if (!eventName) {
      return NextResponse.json({ error: "Missing eventName" }, { status: 400 });
    }

    await appendLocalEvent({
      at: new Date().toISOString(),
      eventName,
      eventProps,
      pathname,
      source: "client",
      userAgent: request.headers.get("user-agent"),
    });

    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ error: "Unable to track event" }, { status: 500 });
  }
}
