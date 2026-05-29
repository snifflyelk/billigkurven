import Link from "next/link";

export function Footer() {
  return (
    <footer className="mt-16 border-t border-slate-200 bg-white/75 py-12 dark:border-slate-800 dark:bg-slate-950/75">
      <div className="mx-auto max-w-6xl px-4 sm:px-6">
        <div className="grid gap-10 sm:grid-cols-2 lg:grid-cols-3">

          {/* Column 1: Brand and tagline */}
          <div className="space-y-3">
            <p className="text-base font-semibold tracking-tight text-emerald-700 dark:text-emerald-300">Billigkurven</p>
            <p className="text-sm leading-relaxed text-slate-500 dark:text-slate-400">
              Smart matpris-sammenligning for norske husholdninger. Beslutning pa 60 sekunder.
            </p>
          </div>

          {/* Column 2: Core navigation */}
          <nav aria-label="Navigasjon">
            <p className="mb-3 text-xs font-semibold uppercase tracking-widest text-slate-400 dark:text-slate-500">Kom i gang</p>
            <ul className="space-y-2">
              {[
                { href: "/", label: "Hjem" },
                { href: "/onboarding", label: "Onboarding" },
                { href: "/shopping-list", label: "Handleliste" },
                { href: "/compare", label: "Sammenlign" },
                { href: "/savings", label: "Sparing" },
              ].map((link) => (
                <li key={link.href}>
                  <Link
                    href={link.href}
                    className="text-sm text-slate-500 transition hover:text-slate-800 dark:text-slate-400 dark:hover:text-slate-200"
                  >
                    {link.label}
                  </Link>
                </li>
              ))}
            </ul>
          </nav>

          {/* Column 3: Data and tools */}
          <nav aria-label="Data og verktoy">
            <p className="mb-3 text-xs font-semibold uppercase tracking-widest text-slate-400 dark:text-slate-500">Data og verktoy</p>
            <ul className="space-y-2">
              {[
                { href: "/receipts", label: "Kvitteringer" },
                { href: "/savings/proof", label: "Sparebevis" },
                { href: "/confidence", label: "Data og metodikk" },
                { href: "/benchmark", label: "Benchmark" },
                { href: "/admin", label: "Admin" },
              ].map((link) => (
                <li key={link.href}>
                  <Link
                    href={link.href}
                    className="text-sm text-slate-500 transition hover:text-slate-800 dark:text-slate-400 dark:hover:text-slate-200"
                  >
                    {link.label}
                  </Link>
                </li>
              ))}
            </ul>
          </nav>
        </div>

        {/* Bottom bar: consistent muted text at smaller size */}
        <div className="mt-10 border-t border-slate-200 pt-6 text-xs text-slate-400 dark:border-slate-800 dark:text-slate-600">
          © {new Date().getFullYear()} Billigkurven · MVP
        </div>
      </div>
    </footer>
  );
}
