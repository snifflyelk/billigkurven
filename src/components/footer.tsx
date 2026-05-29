import Link from "next/link";

const footerLinks = [
  { href: "/", label: "Hjem" },
  { href: "/onboarding", label: "Onboarding" },
  { href: "/shopping-list", label: "Handleliste" },
  { href: "/compare", label: "Sammenlign" },
  { href: "/benchmark", label: "Benchmark" },
  { href: "/receipts", label: "Kvitteringer" },
  { href: "/savings/proof", label: "Sparebevis" },
  { href: "/confidence", label: "Data" },
  { href: "/admin", label: "Admin" },
];

export function Footer() {
  return (
    <footer className="mt-16 border-t border-slate-200 bg-white/75 py-10 dark:border-slate-800 dark:bg-slate-950/75">
      <div className="mx-auto grid max-w-6xl gap-6 px-4 sm:px-6 md:grid-cols-[1fr_auto] md:items-end">
        <div className="space-y-2">
          <p className="text-base font-semibold tracking-tight text-emerald-700 dark:text-emerald-300">Billigkurven</p>
          <p className="text-sm text-slate-500 dark:text-slate-400">MVP - Smart matpris sammenligning for norske husholdninger.</p>
        </div>

        <nav className="flex flex-wrap gap-2 text-sm text-slate-500 dark:text-slate-400">
          {footerLinks.map((link) => (
            <Link key={link.href} href={link.href} className="rounded-lg px-2.5 py-1.5 transition hover:bg-slate-100 hover:text-slate-700 dark:hover:bg-slate-900 dark:hover:text-slate-200">
              {link.label}
            </Link>
          ))}
        </nav>
      </div>
    </footer>
  );
}
