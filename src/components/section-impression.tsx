"use client";

import { trackEvent } from "@/lib/client-event";
import { useEffect } from "react";

type SectionImpressionProps = {
  sectionId: string;
  eventName?: string;
  eventProps?: Record<string, string | number | boolean | null>;
};

export function SectionImpression({
  sectionId,
  eventName = "section_impression",
  eventProps,
}: SectionImpressionProps) {
  useEffect(() => {
    const element = document.getElementById(sectionId);
    if (!element) return;

    let sent = false;
    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (!entry.isIntersecting || sent) continue;
          sent = true;
          trackEvent(eventName, {
            sectionId,
            ...(eventProps ?? {}),
          });
          observer.disconnect();
        }
      },
      { threshold: 0.45 },
    );

    observer.observe(element);

    return () => observer.disconnect();
  }, [eventName, eventProps, sectionId]);

  return null;
}
