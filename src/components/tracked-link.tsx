"use client";

import Link, { type LinkProps } from "next/link";
import { trackEvent } from "@/lib/client-event";
import type { MouseEvent, ReactNode } from "react";

type TrackedLinkProps = LinkProps & {
  children: ReactNode;
  className?: string;
  eventName: string;
  eventProps?: Record<string, string | number | boolean | null>;
  onClick?: (event: MouseEvent<HTMLAnchorElement>) => void;
};

export function TrackedLink({
  children,
  className,
  eventName,
  eventProps,
  onClick,
  ...linkProps
}: TrackedLinkProps) {
  function handleClick(event: MouseEvent<HTMLAnchorElement>) {
    trackEvent(eventName, eventProps);
    onClick?.(event);
  }

  return (
    <Link {...linkProps} className={className} onClick={handleClick}>
      {children}
    </Link>
  );
}
