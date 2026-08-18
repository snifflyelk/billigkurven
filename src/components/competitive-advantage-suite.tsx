import {
  BellAlertIcon,
  ChartBarSquareIcon,
  CheckBadgeIcon,
  ClipboardDocumentListIcon,
  MapPinIcon,
  SparklesIcon,
  UserGroupIcon,
  UsersIcon,
} from "@heroicons/react/24/outline";

const uspCards = [
  {
    title: "Lokal handlekurv per postnummer",
    description: "Få et konkret svar på hvilken kjede som er billigst i ditt område akkurat nå.",
    icon: MapPinIcon,
    tone: "text-emerald-700 dark:text-emerald-300",
  },
  {
    title: "Medlemspris-motor (Trumf, Coop, Æ)",
    description: "Medlemsfordeler er tatt med i regnestykket, så du sammenligner reell sluttsum.",
    icon: UsersIcon,
    tone: "text-cyan-700 dark:text-cyan-300",
  },
  {
    title: "Smart bytteforslag (med eksempler)",
    description: "Bytt til rimeligere alternativer med tydelige kroneeksempler per vare.",
    icon: SparklesIcon,
    tone: "text-indigo-700 dark:text-indigo-300",
  },
  {
    title: "Min ukeplan på 20 sek",
    description: "Fra priser til enkel handleplan med tydelig prioritering på under et halvt minutt.",
    icon: ClipboardDocumentListIcon,
    tone: "text-orange-700 dark:text-orange-300",
  },
  {
    title: "Handlingsvarsler på faste varer",
    description: "Få beskjed når melk, ost, kaffe og andre hverdagsvarer er i riktig kjøpsvindu.",
    icon: BellAlertIcon,
    tone: "text-amber-700 dark:text-amber-300",
  },
  {
    title: "Datakvalitet som produkt (kvalitetsscore + sist oppdatert)",
    description: "Hver anbefaling bygges på sporbar data med synlig kvalitetsscore og ferskhet.",
    icon: CheckBadgeIcon,
    tone: "text-emerald-700 dark:text-emerald-300",
  },
  {
    title: "Familieprofiler (småbarn, singel, par osv.)",
    description: "Anbefalingene tilpasses husholdningstypen din i stedet for en standardkurv for alle.",
    icon: UserGroupIcon,
    tone: "text-rose-700 dark:text-rose-300",
  },
  {
    title: "Innsikt og analyser for ditt område",
    description: "Se lokale prisbevegelser, trender og hvilke kjeder som faktisk vinner i nærområdet.",
    icon: ChartBarSquareIcon,
    tone: "text-cyan-700 dark:text-cyan-300",
  },
  {
    title: "Bygget for norske husholdninger",
    description: "Billigkurven er laget for norske kjeder, norske vaner og norske budsjettprioriteringer.",
    icon: SparklesIcon,
    tone: "text-slate-700 dark:text-slate-300",
  },
];

export function CompetitiveAdvantageSuite() {
  return (
    <section className="mt-16 space-y-6">
      <header className="space-y-2">
        <h2 className="display-font text-3xl font-bold tracking-tight text-slate-900 dark:text-slate-100">Konkurransefortrinn bygd for Norge</h2>
        <p className="max-w-3xl text-sm leading-relaxed text-slate-600 dark:text-slate-300">
          Ni konkrete fordeler som gjør Billigkurven mer relevant for norske husholdninger fra første klikk.
        </p>
      </header>

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {uspCards.map((card) => {
          const Icon = card.icon;

          return (
            <article key={card.title} className="rounded-2xl border border-slate-200 bg-white/90 p-5 shadow-sm transition duration-300 hover:-translate-y-0.5 hover:shadow-md dark:border-slate-800 dark:bg-slate-900/80">
              <Icon className={`h-5 w-5 ${card.tone}`} aria-hidden />
              <h3 className="mt-3 text-base font-semibold text-slate-900 dark:text-slate-100">{card.title}</h3>
              <p className="mt-2 text-sm leading-relaxed text-slate-600 dark:text-slate-300">{card.description}</p>
            </article>
          );
        })}
      </div>
    </section>
  );
}
