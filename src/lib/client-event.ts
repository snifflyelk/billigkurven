"use client";

import { track } from "@vercel/analytics";

type EventProps = Record<string, string | number | boolean | null>;

function sendToLocalEventApi(eventName: string, eventProps?: EventProps) {
  const body = JSON.stringify({
    eventName,
    eventProps,
    pathname: typeof window !== "undefined" ? window.location.pathname : null,
  });

  if (typeof navigator !== "undefined" && typeof navigator.sendBeacon === "function") {
    const blob = new Blob([body], { type: "application/json" });
    navigator.sendBeacon("/api/events/track", blob);
    return;
  }

  fetch("/api/events/track", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body,
    keepalive: true,
  }).catch(() => undefined);
}

export function trackEvent(eventName: string, eventProps?: EventProps) {
  track(eventName, eventProps);
  sendToLocalEventApi(eventName, eventProps);
}
