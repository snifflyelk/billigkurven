import Link from "next/link";
import { TrackedLink } from "@/components/tracked-link";

export const revalidate = 3600;

const plans = [
  {
    name: "Gratis",
    price: "0 kr",
    subtitle: "For deg som vil sammenligne raskt",
    features: [
      "Butikksammenligning per område",
      "Basis prisvarsler",
      "Månedlig spareoversikt",
    ],
    cta: { href: "/login?next=/account", label: "Start gratis" },
    tone: "border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-900",
  },
  {
    name: "Pluss",
    price: "79 kr/mnd",
    subtitle: "For husholdninger som vil optimalisere hver uke",
    features: [
      "Prediktive kjøpsvinduer",
      "Handlekurv-digest med prioritering",
      "Utvidet historikk og eksport",
    ],
    cta: { href: "/login?next=/account", label: "Aktiver Pluss" },
    tone: "border-emerald-300 bg-emerald-50/80 dark:border-emerald-900 dark:bg-emerald-950/25",
  },
  {
    name: "Familie",
    price: "129 kr/mnd",
    subtitle: "For flere brukere og dypere planlegging",
    features: [
      "Delte lister og felles varsler",
      "Ukesmål for hele husholdningen",
      "Prioritert support",
    ],
    cta: { href: "/login?next=/account", label: "Start Familie" },
    tone: "border-cyan-300 bg-cyan-50/80 dark:border-cyan-900 dark:bg-cyan-950/25",
  },
];

export default function PricingPage() {
  return (
    <main className="mx-auto max-w-6xl px-4 py-10 pb-16">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Priser og planer</h1>
          <p className="mt-2 max-w-3xl text-slate-600 dark:text-slate-300">
            Tydelig freemium-modell: gratis verdi først, avanserte beslutningsverktøy i premium.
          </p>
        </div>
        <Link href="/savings" className="rounded-xl border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:text-slate-200 dark:hover:bg-slate-800">
          Se min sparing
        </Link>
      </div>

      <section className="mt-6 grid gap-4 lg:grid-cols-3">
        {plans.map((plan) => (
          <article key={plan.name} className={`rounded-3xl border p-5 shadow-sm ${plan.tone}`}>
            <p className="text-xs uppercase tracking-wide text-slate-500 dark:text-slate-400">{plan.name}</p>
            <h2 className="mt-1 text-2xl font-bold tracking-tight">{plan.price}</h2>
            <p className="mt-1 text-sm text-slate-600 dark:text-slate-300">{plan.subtitle}</p>
            <ul className="mt-4 space-y-2 text-sm text-slate-700 dark:text-slate-200">
              {plan.features.map((feature) => (
                <li key={feature} className="rounded-xl border border-slate-200/80 bg-white/70 px-3 py-2 dark:border-slate-800 dark:bg-slate-900/70">
                  {feature}
                </li>
              ))}
            </ul>
            <TrackedLink
              href={plan.cta.href}
              eventName="pricing_cta_clicked"
              eventProps={{ plan: plan.name.toLowerCase(), location: "pricing" }}
              className="mt-5 inline-flex rounded-xl bg-orange-500 px-4 py-2 text-sm font-semibold text-white hover:bg-orange-400"
            >
              {plan.cta.label}
            </TrackedLink>
          </article>
        ))}
      </section>
    </main>
  );
}
