import Link from "next/link";
import { MapPinIcon } from "@heroicons/react/24/outline";

export function Footer() {
  return (
    <footer className="mt-20 border-t-8 border-[#E60000] bg-[#002B5C] py-20 text-white">
      <div className="mx-auto max-w-7xl px-4 sm:px-8">
        <div className="grid gap-16 border-b border-white/20 pb-12 sm:grid-cols-2 lg:grid-cols-3">

          {/* Column 1: Brand and tagline */}
          <div className="space-y-4">
            <p className="text-base font-semibold tracking-tight text-white">Billigkurven</p>
            <p className="max-w-sm text-sm leading-relaxed text-white/70">
              Smart matpris-sammenligning for norske husholdninger. Beslutning på 60 sekunder.
            </p>
          </div>

          {/* Column 2: Core navigation */}
          <nav aria-label="Navigasjon">
            <p className="mb-4 text-xs font-semibold uppercase tracking-widest text-white/60">Kom i gang</p>
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
                    className="text-sm text-white/75 transition hover:text-white"
                  >
                    {link.label}
                  </Link>
                </li>
              ))}
            </ul>
          </nav>

          {/* Column 3: Data and tools */}
          <nav aria-label="Data og verktoy">
            <p className="mb-4 text-xs font-semibold uppercase tracking-widest text-white/60">Data og verktoy</p>
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
                    className="text-sm text-white/75 transition hover:text-white"
                  >
                    {link.label}
                  </Link>
                </li>
              ))}
            </ul>
          </nav>
        </div>

        <div className="mt-12 grid gap-8 border-b border-white/20 p-0 pb-10 text-sm text-white/75 md:grid-cols-2 lg:grid-cols-4">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-white/60">Organisasjon</p>
            <p className="mt-1 font-medium text-white">Org.nr publiseres ved full lansering</p>
          </div>
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-white/60">Kontakt</p>
            <a href="mailto:kontakt@billigkurven.no" className="mt-1 inline-block font-medium text-white hover:text-[#E60000] hover:underline">
              kontakt@billigkurven.no
            </a>
          </div>
          <div className="flex items-start gap-4">
            <Link href="/confidence" className="text-sm font-medium text-white hover:underline">
              Personvern
            </Link>
            <Link href="/coverage" className="text-sm font-medium text-white hover:underline">
              Datakilder
            </Link>
          </div>
          <div className="md:justify-self-end">
            <span className="inline-flex items-center gap-1.5 border border-white/40 px-3 py-1 text-xs font-semibold uppercase tracking-wide text-white">
              <MapPinIcon className="h-3.5 w-3.5" aria-hidden />
              Bygget i Norge
            </span>
          </div>
        </div>

        {/* Bottom bar: consistent muted text at smaller size */}
        <div className="mt-10 pt-6 text-xs text-white/50">
          © {new Date().getFullYear()} Billigkurven · MVP
        </div>
      </div>
    </footer>
  );
}
