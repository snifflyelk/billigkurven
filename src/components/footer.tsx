import Link from "next/link";
import { MapPinIcon } from "@heroicons/react/24/outline";

export function Footer() {
  return (
    <footer className="mt-20 border-t border-slate-200 bg-white/80 py-16 dark:border-slate-800 dark:bg-slate-950/80">
      <div className="mx-auto max-w-6xl px-4 sm:px-6">
        <div className="grid gap-12 border-b border-slate-200 pb-10 sm:grid-cols-2 lg:grid-cols-3 dark:border-slate-800">

          {/* Column 1: Brand and tagline */}
          <div className="space-y-4">
            <p className="text-base font-semibold tracking-tight text-emerald-700 dark:text-emerald-300">Billigkurven</p>
            <p className="max-w-sm text-sm leading-relaxed text-slate-500 dark:text-slate-400">
              Smart matpris-sammenligning for norske husholdninger. Beslutning på 60 sekunder.
            </p>
          </div>

          {/* Column 2: Core navigation */}
          <nav aria-label="Navigasjon">
            <p className="mb-4 text-xs font-semibold uppercase tracking-widest text-slate-400 dark:text-slate-500">Kom i gang</p>
            <ul className="space-y-2">
              {[
                { href: "/", label: "Hjem" },
                { href: "/account", label: "Min konto" },
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
            <p className="mb-4 text-xs font-semibold uppercase tracking-widest text-slate-400 dark:text-slate-500">Data og verktoy</p>
            <ul className="space-y-2">
              {[
                { href: "/receipts", label: "Kvitteringer" },
                { href: "/savings/proof", label: "Sparebevis" },
                { href: "/confidence", label: "Data og metodikk" },
                { href: "/status", label: "Status" },
                { href: "/benchmark", label: "Benchmark" },
                { href: "/insights", label: "Innsikt by" },
                { href: "/distribution", label: "Partnerwidget" },
                { href: "/ops", label: "Ops" },
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

        <div className="mt-10 grid gap-5 rounded-2xl border border-slate-200 bg-slate-50/80 p-5 text-sm text-slate-600 dark:border-slate-800 dark:bg-slate-900/50 dark:text-slate-300 md:grid-cols-2 lg:grid-cols-4">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">Organisasjon</p>
            <p className="mt-1 font-medium text-slate-800 dark:text-slate-100">Org.nr publiseres ved full lansering</p>
          </div>
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">Kontakt</p>
            <a href="mailto:kontakt@billigkurven.no" className="mt-1 inline-block font-medium text-emerald-700 hover:underline dark:text-emerald-300">
              kontakt@billigkurven.no
            </a>
          </div>
          <div className="flex items-start gap-4">
            <Link href="/confidence" className="text-sm font-medium text-slate-700 hover:underline dark:text-slate-200">
              Personvern
            </Link>
            <Link href="/coverage" className="text-sm font-medium text-slate-700 hover:underline dark:text-slate-200">
              Datakilder
            </Link>
          </div>
          <div className="md:justify-self-end">
            <span className="inline-flex items-center gap-1.5 rounded-full border border-emerald-200 bg-emerald-50 px-3 py-1 text-xs font-semibold uppercase tracking-wide text-emerald-800 dark:border-emerald-900 dark:bg-emerald-950/40 dark:text-emerald-200">
              <MapPinIcon className="h-3.5 w-3.5" aria-hidden />
              Bygget i Norge
            </span>
          </div>
        </div>

        {/* Bottom bar: consistent muted text at smaller size */}
        <div className="mt-10 border-t border-slate-200 pt-6 text-xs text-slate-400 dark:border-slate-800 dark:text-slate-600">
          © {new Date().getFullYear()} Billigkurven · MVP
        </div>
      </div>
    </footer>
  );
}
