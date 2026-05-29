import { prisma } from "@/lib/prisma";
import {
  createListAction,
  createTemplateListAction,
  savePreferencesAction,
} from "@/app/onboarding/actions";

export const dynamic = "force-dynamic";

export default async function OnboardingPage() {
  const [products, stores] = await Promise.all([
    prisma.product.findMany({ orderBy: { name: "asc" }, take: 20 }).catch(() => []),
    prisma.store.findMany({ orderBy: { name: "asc" } }).catch(() => []),
  ]);

  const starterSavings = Math.max(59, products.length * 4);

  return (
    <main className="mx-auto max-w-6xl px-4 py-10 pb-24 md:pb-10">
      <h1 className="text-3xl font-bold tracking-tight">Onboarding</h1>
      <p className="mt-2 text-slate-600 dark:text-slate-300">
        Start med pseudo-personalisering: favorittbutikk, prisfokus og en rask startkurv.
      </p>

      <section className="mt-5 rounded-3xl border border-emerald-200 bg-gradient-to-br from-emerald-50 via-white to-cyan-50 p-5 fade-rise dark:border-emerald-900 dark:from-emerald-950/20 dark:via-slate-950 dark:to-cyan-950/20">
        <p className="text-xs font-semibold uppercase tracking-wide text-emerald-700 dark:text-emerald-300">Kom i gang raskt</p>
        <div className="mt-2 grid gap-4 md:grid-cols-[1.2fr_0.8fr] md:items-end">
          <div>
            <h2 className="text-3xl font-bold tracking-tight">Bygg en nyttig profil pa under ett minutt</h2>
            <p className="mt-2 max-w-2xl text-sm text-slate-700 dark:text-slate-200">
              Vi trenger bare tre signaler for a gi deg en første anbefaling: foretrukket butikk, prisfølsomhet og noen vanlige varer.
            </p>
          </div>
          <div className="rounded-2xl border border-white/80 bg-white/90 p-4 shadow-sm dark:border-slate-800 dark:bg-slate-900/80">
            <p className="text-xs uppercase tracking-wide text-slate-500">Forventet startverdi</p>
            <p className="mt-1 text-3xl font-semibold text-emerald-700 dark:text-emerald-300">{starterSavings} kr</p>
            <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">Potensiell ukesparing når første handleliste er klar.</p>
          </div>
        </div>
      </section>

      <section className="mt-5 grid gap-4 sm:grid-cols-3 fade-rise-delayed">
        <article className="rounded-2xl border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900">
          <p className="text-xs uppercase tracking-wide text-slate-500">Steg 1</p>
          <p className="mt-1 font-semibold">Velg favorittbutikk</p>
          <p className="mt-1 text-sm text-slate-600 dark:text-slate-300">Brukes for å lage et relevant utgangspunkt.</p>
        </article>
        <article className="rounded-2xl border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900">
          <p className="text-xs uppercase tracking-wide text-slate-500">Steg 2</p>
          <p className="mt-1 font-semibold">Sett prisprofil</p>
          <p className="mt-1 text-sm text-slate-600 dark:text-slate-300">Juster hvor hardt motoren skal optimalisere pris mot merke.</p>
        </article>
        <article className="rounded-2xl border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900">
          <p className="text-xs uppercase tracking-wide text-slate-500">Steg 3</p>
          <p className="mt-1 font-semibold">Velg startvarer</p>
          <p className="mt-1 text-sm text-slate-600 dark:text-slate-300">Gi oss nok signal til å foreslå første butikkvalg.</p>
        </article>
      </section>

      <section className="mt-6 rounded-2xl border border-emerald-200 bg-emerald-50/70 p-4 text-sm dark:border-emerald-900 dark:bg-emerald-950/30">
        <p className="font-semibold text-emerald-800 dark:text-emerald-300">Start uten brukere - men med verdi fra dag 1</p>
        <p className="mt-1 text-emerald-700 dark:text-emerald-200">
          Velg en ferdig kurv for rask AHA-opplevelse, eller bygg din egen handleliste under.
        </p>
        <div className="mt-3 flex flex-wrap gap-2">
          {[
            { key: "student", label: "Student" },
            { key: "familie", label: "Familie" },
            { key: "budsjett", label: "Budsjett" },
            { key: "sunn", label: "Sunn" },
          ].map((preset) => (
            <form key={preset.key} action={createTemplateListAction}>
              <input type="hidden" name="template" value={preset.key} />
              <button
                className="rounded-lg border border-emerald-300 bg-white px-3 py-1.5 font-medium text-emerald-700 hover:bg-emerald-100 dark:border-emerald-700 dark:bg-transparent dark:text-emerald-200 dark:hover:bg-emerald-900/40"
                type="submit"
              >
                Start med {preset.label}kurv
              </button>
            </form>
          ))}
        </div>
      </section>

      {stores.length === 0 || products.length === 0 ? (
        <section className="mt-6 rounded-2xl border border-amber-200 bg-amber-50/70 p-4 text-sm dark:border-amber-900 dark:bg-amber-950/30">
          <p className="font-semibold text-amber-800 dark:text-amber-300">Vi mangler grunnlag for onboarding akkurat nå</p>
          <p className="mt-1 text-amber-700 dark:text-amber-200">
            Legg inn produkter og butikker i adminpanelet for å få fullt utbytte av onboardingflyten.
          </p>
        </section>
      ) : null}

      <div className="mt-8 grid gap-6 lg:grid-cols-2 fade-rise-slow">
        <form action={savePreferencesAction} className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900">
          <h2 className="text-lg font-semibold">1) Preferanser</h2>
          <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">Lagrer grunnlaget for første anbefaling.</p>
          <label className="mt-4 block text-sm font-medium">Butikk du handler mest i</label>
          <select
            name="primaryStore"
            className="mt-2 w-full rounded-xl border border-slate-300 bg-white px-3 py-2 dark:border-slate-700 dark:bg-slate-950"
            disabled={stores.length === 0}
          >
            {stores.length === 0 ? <option>Ingen butikker registrert</option> : null}
            {stores.map((store) => (
              <option key={store.id} value={store.name}>
                {store.name}
              </option>
            ))}
          </select>

          <label className="mt-4 block text-sm font-medium">Hvor viktig er pris vs merke? (0-100)</label>
          <input
            type="range"
            min={0}
            max={100}
            defaultValue={70}
            name="priceSensitivity"
            className="mt-2 w-full"
          />

          <button
            className="mt-5 w-full rounded-xl bg-emerald-600 px-4 py-2.5 font-medium text-white hover:bg-emerald-500 disabled:cursor-not-allowed disabled:opacity-60"
            type="submit"
            disabled={stores.length === 0}
          >
            Lagre preferanser
          </button>
        </form>

        <form action={createListAction} className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900">
          <h2 className="text-lg font-semibold">2) Vanlige varer</h2>
          <p className="mt-1 text-sm text-slate-500">Velg varer for a opprette en personlig start-handleliste.</p>
          <div className="mt-4 grid max-h-80 gap-2 overflow-y-auto pr-1">
            {products.length === 0 ? (
              <p className="text-sm text-slate-500 dark:text-slate-400">Ingen produkter registrert ennå.</p>
            ) : null}
            {products.map((product) => (
              <label key={product.id} className="flex items-center gap-2 rounded-lg border border-slate-200 p-2 text-sm dark:border-slate-700">
                <input type="checkbox" name="productIds" value={product.id} />
                <span>
                  {product.name} - {product.brand}
                </span>
              </label>
            ))}
          </div>
          <button
            className="mt-5 w-full rounded-xl bg-slate-900 px-4 py-2.5 font-medium text-white hover:bg-slate-700 disabled:cursor-not-allowed disabled:opacity-60 dark:bg-emerald-600 dark:hover:bg-emerald-500"
            type="submit"
            disabled={products.length === 0}
          >
            Lag handleliste
          </button>
        </form>
      </div>

      <div className="mobile-bottom-bar fixed inset-x-0 bottom-0 z-40 border-t border-slate-200 bg-white/95 p-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] backdrop-blur md:hidden dark:border-slate-800 dark:bg-slate-950/90">
        <div className="mobile-bottom-actions mx-auto grid max-w-6xl grid-cols-2 gap-2">
          <form action={createTemplateListAction} className="flex-1">
            <input type="hidden" name="template" value="student" />
            <button className="mobile-bottom-action w-full min-w-0 rounded-xl border border-slate-300 px-2.5 py-2 text-center text-[13px] font-medium leading-tight sm:px-3 sm:text-sm dark:border-slate-700" type="submit">
              Hurtigstart
            </button>
          </form>
          <a href="#" className="mobile-bottom-action w-full min-w-0 rounded-xl bg-emerald-600 px-2.5 py-2 text-center text-[13px] font-medium leading-tight text-white sm:px-3 sm:text-sm">
            Fullfor steg
          </a>
        </div>
      </div>
    </main>
  );
}
