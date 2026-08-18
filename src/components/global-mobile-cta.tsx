"use client";

import { usePathname } from "next/navigation";
import { TrackedLink } from "@/components/tracked-link";

const hiddenOnPaths = ["/compare", "/shopping-list", "/onboarding", "/account", "/login"];

export function GlobalMobileCta() {
  const pathname = usePathname();
  const isHidden = hiddenOnPaths.some((path) => pathname === path || pathname.startsWith(`${path}/`));

  if (isHidden) return null;

  return (
    <div className="fixed inset-x-0 bottom-3 z-40 px-4 sm:hidden">
      <TrackedLink
        href="/compare"
        eventName="global_mobile_sticky_cta_clicked"
        eventProps={{ location: "global_mobile_sticky" }}
        className="inline-flex w-full items-center justify-center rounded-2xl bg-orange-500 px-5 py-3 text-sm font-semibold text-white shadow-xl shadow-orange-900/30 ring-1 ring-orange-400/60"
      >
        Se billigste butikk i mitt område
      </TrackedLink>
    </div>
  );
}