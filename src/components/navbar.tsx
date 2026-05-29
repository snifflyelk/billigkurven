"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { ThemeToggle } from "@/components/theme-toggle";
import { cn } from "@/lib/utils";

const directLinks = [
  { href: "/", label: "Hjem" },
  { href: "/admin", label: "Admin" },
];

const groupedLinks = [
  {
    label: "Handle",
    items: [
      { href: "/shopping-list", label: "Handleliste" },
      { href: "/compare", label: "Sammenlign" },
      { href: "/varer", label: "Alle varer" },
      { href: "/onboarding", label: "Onboarding" },
    ],
  },
  {
    label: "Innsikt",
    items: [
      { href: "/benchmark", label: "Benchmark" },
      { href: "/alerts", label: "Varsler" },
      { href: "/receipts", label: "Kvitteringer" },
      { href: "/savings", label: "Sparing" },
      { href: "/data-quality", label: "Datakvalitet" },
    ],
  },
];

export function Navbar() {
  const pathname = usePathname();

  const isActive = (href: string) => {
    if (href === "/") {
      return pathname === "/";
    }

    return pathname === href || pathname.startsWith(`${href}/`);
  };

  const isGroupActive = (hrefs: string[]) => hrefs.some((href) => isActive(href));

  const mobileLinks = [...directLinks, ...groupedLinks.flatMap((group) => group.items)];

  return (
    <header className="sticky top-0 z-50 border-b border-slate-200/80 bg-white/80 backdrop-blur-xl dark:border-slate-800 dark:bg-slate-950/80">
      <div className="mx-auto flex max-w-6xl items-center justify-between gap-3 px-4 py-3.5 sm:px-6">
        <Link href="/" className="shrink-0 text-xl font-bold tracking-tight text-emerald-700 transition hover:text-emerald-600 dark:text-emerald-300 dark:hover:text-emerald-200">
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
                    "rounded-xl px-3 py-2 font-medium transition",
                    "hover:bg-emerald-100/80 hover:text-emerald-900 dark:hover:bg-emerald-900/35 dark:hover:text-emerald-200",
                    active
                      ? "bg-emerald-600 text-white shadow-sm ring-1 ring-emerald-500/60 dark:bg-emerald-500 dark:text-emerald-950 dark:ring-emerald-300/70"
                      : "text-slate-600 dark:text-slate-300",
                  )}
                >
                  {link.label}
                </Link>
              );
            })}

            {groupedLinks.map((group) => {
              const active = isGroupActive(group.items.map((item) => item.href));

              return (
                <details key={group.label} className="group relative">
                  <summary
                    className={cn(
                      "list-none cursor-pointer rounded-xl px-3 py-2 font-medium transition",
                      "hover:bg-emerald-100/80 hover:text-emerald-900 dark:hover:bg-emerald-900/35 dark:hover:text-emerald-200",
                      active
                        ? "bg-emerald-600 text-white shadow-sm ring-1 ring-emerald-500/60 dark:bg-emerald-500 dark:text-emerald-950 dark:ring-emerald-300/70"
                        : "text-slate-600 dark:text-slate-300",
                    )}
                  >
                    {group.label}
                  </summary>

                  <div className="absolute right-0 top-12 z-50 min-w-52 rounded-2xl border border-slate-200 bg-white p-2 shadow-xl dark:border-slate-800 dark:bg-slate-900">
                    {group.items.map((item) => {
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
                </details>
              );
            })}
          </nav>

          <details className="relative md:hidden">
            <summary className="list-none rounded-xl border border-slate-300 px-3 py-2 text-sm font-medium text-slate-700 dark:border-slate-700 dark:text-slate-200">
              Meny
            </summary>
            <div className="absolute right-0 top-12 z-50 min-w-56 rounded-2xl border border-slate-200 bg-white p-2 shadow-xl dark:border-slate-800 dark:bg-slate-900">
              {mobileLinks.map((link) => {
                const active = isActive(link.href);

                return (
                  <Link
                    key={link.href}
                    href={link.href}
                    className={cn(
                      "block rounded-lg px-3 py-2 text-sm transition",
                      active
                        ? "bg-emerald-100 text-emerald-900 dark:bg-emerald-900/40 dark:text-emerald-200"
                        : "text-slate-700 hover:bg-slate-100 dark:text-slate-200 dark:hover:bg-slate-800",
                    )}
                  >
                    {link.label}
                  </Link>
                );
              })}
            </div>
          </details>

          <div className="rounded-xl border border-slate-200 bg-white/80 p-1 dark:border-slate-800 dark:bg-slate-900/80">
            <ThemeToggle />
          </div>
        </div>
      </div>
    </header>
  );
}
