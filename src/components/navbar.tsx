"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { cn } from "@/lib/utils";

const directLinks = [
  { href: "/", label: "Hjem" },
  { href: "/shopping-list", label: "Handleliste" },
  { href: "/compare", label: "Dagens kjøp" },
  { href: "/alerts", label: "Prisvarsler" },
];

const groupedLinks = [
  {
    label: "Innsikt",
    items: [
      { href: "/varer", label: "Alle varer" },
      { href: "/pricing", label: "Priser" },
      { href: "/savings", label: "Sparing" },
      { href: "/confidence", label: "Metodikk" },
      { href: "/benchmark", label: "Benchmark" },
    ],
  },
];

function DesktopDropdownGroup({
  label,
  items,
  active,
  isActive,
}: {
  label: string;
  items: { href: string; label: string }[];
  active: boolean;
  isActive: (href: string) => boolean;
}) {
  const [isOpen, setIsOpen] = useState(false);
  const closeTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const clearCloseTimer = () => {
    if (closeTimerRef.current) {
      clearTimeout(closeTimerRef.current);
      closeTimerRef.current = null;
    }
  };

  const scheduleClose = () => {
    clearCloseTimer();

    closeTimerRef.current = setTimeout(() => {
      setIsOpen(false);
    }, 160);
  };

  useEffect(() => () => clearCloseTimer(), []);

  return (
    <div
      className="relative"
      onMouseEnter={() => {
        clearCloseTimer();
        setIsOpen(true);
      }}
      onMouseLeave={scheduleClose}
      onFocus={() => {
        clearCloseTimer();
        setIsOpen(true);
      }}
      onBlur={(event) => {
        if (!event.currentTarget.contains(event.relatedTarget as Node | null)) {
          scheduleClose();
        }
      }}
    >
      <button
        type="button"
        aria-haspopup="menu"
        aria-expanded={isOpen}
        className={cn(
          "list-none cursor-pointer rounded-xl px-3 py-2 font-medium transition",
          "hover:bg-emerald-100/80 hover:text-emerald-900 dark:hover:bg-emerald-900/35 dark:hover:text-emerald-200",
          active
            ? "bg-emerald-600 text-white shadow-sm ring-1 ring-emerald-500/60 dark:bg-emerald-500 dark:text-emerald-950 dark:ring-emerald-300/70"
            : "text-slate-600 dark:text-slate-300",
        )}
      >
        {label}
      </button>

      {isOpen ? (
        <div className="absolute right-0 top-12 z-50 min-w-52 rounded-2xl border border-slate-200 bg-white p-2 shadow-xl dark:border-slate-800 dark:bg-slate-900">
          {items.map((item) => {
            const itemActive = isActive(item.href);

            return (
              <Link
                key={item.href}
                href={item.href}
                className={cn(
                  "block rounded-lg px-3 py-2 text-sm transition",
                  itemActive
                    ? "bg-emerald-100 text-emerald-900 dark:bg-emerald-900/40 dark:text-emerald-200"
                    : "text-slate-700 hover:bg-slate-100 dark:text-slate-200 dark:hover:bg-slate-800",
                )}
              >
                {item.label}
              </Link>
            );
          })}
        </div>
      ) : null}
    </div>
  );
}

export function Navbar() {
  const pathname = usePathname();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [hasActiveShoppingList, setHasActiveShoppingList] = useState(false);
  const ctaLink = !isLoggedIn
    ? { href: "/login", label: "Logg inn" }
    : hasActiveShoppingList
      ? { href: "/savings/proof", label: "Sparebevis" }
      : { href: "/account", label: "Kontooppsett" };

  const isActive = (href: string) => {
    if (href === "/") {
      return pathname === "/";
    }

    return pathname === href || pathname.startsWith(`${href}/`);
  };

  const isGroupActive = (hrefs: string[]) => hrefs.some((href) => isActive(href));

  const mobilePrimaryLinks = [...directLinks, ctaLink];
  const mobileInsightLinks = groupedLinks.flatMap((group) => group.items);

  useEffect(() => {
    setMobileOpen(false);
  }, [pathname]);

  useEffect(() => {
    let mounted = true;

    async function loadActiveShoppingList() {
      try {
        const response = await fetch("/api/user/active-shopping-list", { cache: "no-store" });
        if (!response.ok) return;
        const payload = (await response.json()) as { isLoggedIn?: boolean; hasActiveShoppingList?: boolean };
        if (!mounted) return;
        setIsLoggedIn(Boolean(payload.isLoggedIn));
        setHasActiveShoppingList(Boolean(payload.hasActiveShoppingList));
      } catch {
      }
    }

    void loadActiveShoppingList();
    return () => {
      mounted = false;
    };
  }, []);

  return (
    <header className="sticky top-0 z-50 border-b-4 border-[#D95D39] bg-[#F7F8F6]">
      <div className="mx-auto flex max-w-7xl items-center justify-between gap-3 px-4 py-5 sm:px-8">
        <Link href="/" className="shrink-0 text-xl font-bold tracking-tight text-[#17212B] transition hover:text-[#D95D39]">
          Billigkurven
        </Link>

        <div className="flex min-w-0 items-center justify-end gap-2">
          <nav className="hidden items-center gap-1 text-sm text-slate-600 md:flex dark:text-slate-300">
            {directLinks.map((link) => {
              const active = isActive(link.href);

              return (
                <Link
                  key={link.href}
                  href={link.href}
                  aria-current={active ? "page" : undefined}
                  className={cn(
                    "rounded-none px-3 py-2 font-medium transition",
                    "hover:bg-[#F2B880] hover:text-[#17212B]",
                    active
                      ? "bg-[#17212B] text-white"
                      : "text-[#17212B]",
                  )}
                >
                  {link.label}
                </Link>
              );
            })}

            {groupedLinks.map((group) => {
              const active = isGroupActive(group.items.map((item) => item.href));

              return (
                <DesktopDropdownGroup
                  key={group.label}
                  label={group.label}
                  items={group.items}
                  active={active}
                  isActive={isActive}
                />
              );
            })}

            <Link
              href={ctaLink.href}
              aria-current={isActive(ctaLink.href) ? "page" : undefined}
              className={cn(
                "ml-3 rounded-none px-3 py-2 font-medium transition",
                isActive(ctaLink.href)
                  ? "bg-[#D95D39] text-white"
                  : "border border-[#D95D39] text-[#D95D39] hover:bg-[#D95D39] hover:text-white",
              )}
            >
              {ctaLink.label}
            </Link>
          </nav>

          <div className="relative md:hidden">
            <button
              type="button"
              onClick={() => setMobileOpen((prev) => !prev)}
              aria-expanded={mobileOpen}
              className="rounded-xl border border-slate-300 px-3 py-2 text-sm font-semibold text-slate-700 dark:border-slate-700 dark:text-slate-200"
            >
              Meny
            </button>
            {mobileOpen ? (
              <div className="absolute right-0 top-12 z-50 min-w-64 rounded-2xl border border-slate-200 bg-white p-2 shadow-xl dark:border-slate-800 dark:bg-slate-900">
                <p className="px-3 pb-1 pt-1 text-[11px] font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">Hovedvalg</p>
                {mobilePrimaryLinks.map((link) => {
                  const active = isActive(link.href);

                  return (
                    <Link
                      key={link.href}
                      href={link.href}
                      className={cn(
                        "block rounded-xl px-3 py-2.5 text-sm font-medium transition",
                        active
                          ? "bg-[#F2B880] text-[#17212B]"
                          : "text-[#17212B] hover:bg-[#F7F8F6]",
                      )}
                    >
                      {link.label}
                    </Link>
                  );
                })}

                <div className="my-2 h-px bg-slate-200 dark:bg-slate-800" />
                <p className="px-3 pb-1 pt-1 text-[11px] font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">Innsikt</p>
                {mobileInsightLinks.map((link) => {
                  const active = isActive(link.href);

                  return (
                    <Link
                      key={link.href}
                      href={link.href}
                      className={cn(
                        "block rounded-xl px-3 py-2.5 text-sm font-medium transition",
                        active
                          ? "bg-[#F2B880] text-[#17212B]"
                          : "text-[#17212B] hover:bg-[#F7F8F6]",
                      )}
                    >
                      {link.label}
                    </Link>
                  );
                })}
              </div>
            ) : null}
          </div>
        </div>
      </div>
    </header>
  );
}
