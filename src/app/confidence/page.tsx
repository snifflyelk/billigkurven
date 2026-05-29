import { calculateReceiptConfidence } from "@/lib/receipt-confidence";
import { TransparencySnapshot } from "@/components/transparency-snapshot";
import { getTransparencyMetrics } from "@/lib/transparency";
import { formatNok } from "@/lib/utils";

export const dynamic = "force-dynamic";

const examples = [
  { name: "Lav", coverageRatio: 0.2, dataPoints: 2, userSignals: 0 },
  { name: "Medium", coverageRatio: 0.6, dataPoints: 6, userSignals: 2 },
  { name: "Høy", coverageRatio: 0.9, dataPoints: 12, userSignals: 4 },
];

export default async function ConfidencePage() {
  const transparencyMetrics = await getTransparencyMetrics();

  return (
    <main className="mx-auto max-w-6xl px-4 py-10">
      <h1 className="text-3xl font-bold tracking-tight">Prisgrunnlag og metodikk</h1>
      <p className="mt-2 max-w-3xl text-slate-600 dark:text-slate-300">
        Denne siden forklarer hvordan Billigkurven vurderer kvaliteten på prisdata, kvitteringer og butikk-sammenligninger. Målet er at brukeren alltid skal kunne se hva vi vet, hva vi antar, og hva vi holder tilbake.
      </p>

      <section className="mt-8 fade-rise">
        <TransparencySnapshot
          metrics={transparencyMetrics}
          title="Offentlig status for prisgrunnlaget"
          subtitle="Vi mener dette bor vaere synlig for alle brukere, ikke bare internt i admin."
        />
      </section>

      <section className="mt-8 grid gap-4 md:grid-cols-3">
        {examples.map((example) => {
          const confidence = calculateReceiptConfidence(example);
          return (
            <article key={example.name} className="rounded-2xl border border-slate-200 bg-white p-5 dark:border-slate-800 dark:bg-slate-900">
              <p className="text-sm text-slate-500">{example.name}</p>
              <h2 className="mt-1 text-2xl font-bold">{confidence.toUpperCase()}</h2>
              <p className="mt-2 text-sm text-slate-600 dark:text-slate-300">
                Coverage: {Math.round(example.coverageRatio * 100)}% · datapunkter: {example.dataPoints} · signaler: {example.userSignals}
              </p>
            </article>
          );
        })}
      </section>

      <section className="mt-8 grid gap-6 lg:grid-cols-[1.2fr_0.8fr]">
        <div className="rounded-3xl border border-emerald-200 bg-emerald-50/70 p-5 dark:border-emerald-900 dark:bg-emerald-950/30">
          <h2 className="text-xl font-semibold">Slik tenker vi</h2>
          <ol className="mt-3 space-y-3 text-sm text-emerald-800 dark:text-emerald-200">
            <li><span className="font-semibold">1.</span> Vi viser data selv om den er ufullstendig, men merker den tydelig med confidence.</li>
            <li><span className="font-semibold">2.</span> Flere prislinjer og flere butikker øker kvaliteten på anbefalingen.</li>
            <li><span className="font-semibold">3.</span> Brukerdata, manuelle justeringer og kvitteringer gir bedre matching over tid.</li>
            <li><span className="font-semibold">4.</span> Vi optimaliserer for en beslutningsmotor, ikke bare en rå dataliste.</li>
          </ol>
        </div>

        <div className="rounded-3xl border border-slate-200 bg-white p-5 dark:border-slate-800 dark:bg-slate-900">
          <h2 className="text-xl font-semibold">Praktisk bruk</h2>
          <p className="mt-3 text-sm text-slate-600 dark:text-slate-300">
            Når data er lav, bør appen være ærlig og hjelpe brukeren med å ta et godt valg likevel. Når data er høy, kan vi bli mer aggressive med automatiske anbefalinger og personlige forslag.
          </p>
          <div className="mt-4 rounded-2xl bg-slate-100 p-4 dark:bg-slate-800">
            <p className="text-sm text-slate-500">Eksempel på besparelse</p>
            <p className="mt-1 text-2xl font-bold text-emerald-600">{formatNok(187)}</p>
            <p className="mt-1 text-xs text-slate-500">Tydelig verdi er viktigere enn perfekt data i startfasen.</p>
          </div>
        </div>
      </section>

      <section className="mt-8 grid gap-6 lg:grid-cols-2">
        <article className="rounded-3xl border border-slate-200 bg-white p-5 dark:border-slate-800 dark:bg-slate-900">
          <h2 className="text-xl font-semibold">Dette viser vi pa prisniva</h2>
          <ul className="mt-4 space-y-3 text-sm text-slate-600 dark:text-slate-300">
            <li>Hvilken kilde prisen kommer fra, nar observasjonen sist ble gjort, og hvor mange butikker som er med i sammenligningen.</li>
            <li>Confidence og trust-score pa anbefalinger, slik at sterke og svake beslutninger skilles tydelig.</li>
            <li>Naer data blir for gammel eller for tynn, holder vi tilbake harde anbefalinger og sier det eksplisitt.</li>
          </ul>
        </article>

        <article className="rounded-3xl border border-slate-200 bg-white p-5 dark:border-slate-800 dark:bg-slate-900">
          <h2 className="text-xl font-semibold">Dette filtrerer vi bort</h2>
          <ul className="mt-4 space-y-3 text-sm text-slate-600 dark:text-slate-300">
            <li>Prisrader som ser feil ut, er mistenkelig matchet, eller scorer for svakt i kvalitetspipelinen blir satt i karantene.</li>
            <li>Karantenedata brukes ikke i sammenligning, timing-signaler eller anbefalte butikkvalg.</li>
            <li>Vi viser hvor mye som er filtrert bort fordi skjult opprydding svekker tilliten mer enn midlertidig svak dekning.</li>
          </ul>
        </article>
      </section>

      <section className="mt-8 rounded-3xl border border-amber-200 bg-amber-50/80 p-5 dark:border-amber-900 dark:bg-amber-950/25">
        <h2 className="text-xl font-semibold text-amber-900 dark:text-amber-100">Begrensninger vi er aapne om</h2>
        <ul className="mt-4 space-y-3 text-sm text-amber-900/90 dark:text-amber-100/90">
          <li>Produktet er bare sa sterkt som butikkdekningen i ditt omrade. Derfor viser vi dekning eksplisitt i sammenligningene.</li>
          <li>Noen varehistorikker er fortsatt tynne. I slike tilfeller skal timing-signalet leses som veiledning, ikke fasit.</li>
          <li>Verifiserte kvitteringer er fortsatt en viktig del av kvalitetssløyfen. Mer brukerbevis gir bedre sparerad over tid.</li>
        </ul>
      </section>
    </main>
  );
}
