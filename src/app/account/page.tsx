import { logoutAction } from "@/app/login/actions";
import { createListAction, createTemplateListAction, savePreferencesAction } from "@/app/onboarding/actions";
import { PriceSensitivitySlider } from "@/components/price-sensitivity-slider";
import { prisma } from "@/lib/prisma";
import { requireAuthenticatedSessionUserId } from "@/lib/user-session";

export const dynamic = "force-dynamic";

function cleanPostalCode(value: string | null | undefined) {
  return (value ?? "").replace(/\D/g, "").slice(0, 4);
}

export default async function AccountPage() {
  const currentUserId = await requireAuthenticatedSessionUserId("/account");

  const [user, products, stores] = await Promise.all([
    prisma.user.findUnique({ where: { id: currentUserId }, include: { preference: true } }),
    prisma.product.findMany({
      where: {
        NOT: [
          { name: { startsWith: "Vare " } },
          { name: { startsWith: "vare " } },
        ],
      },
      orderBy: { name: "asc" },
      take: 24,
    }).catch(() => []),
    prisma.store.findMany({ select: { id: true, chain: true, name: true }, orderBy: { chain: "asc" } }).catch(() => []),
  ]);

  const postalCode = cleanPostalCode(user?.preference?.postalCode);
  const weeklyBudget = user?.preference?.weeklyGroceryBudget ?? 1800;
  const shoppingTripBudget = user?.preference?.shoppingTripBudget ?? Math.round(weeklyBudget / 1.6);
  const uniqueChains = Array.from(new Set(stores.map((store) => (store.chain ?? "").trim()).filter(Boolean))).sort((a, b) => a.localeCompare(b, "nb"));
  const preferredStoreRaw = user?.preference?.primaryStore?.trim() ?? "";
  const preferredChain = uniqueChains.find((chain) => chain.toLowerCase() === preferredStoreRaw.toLowerCase())
    ?? uniqueChains.find((chain) => preferredStoreRaw.toLowerCase().startsWith(chain.toLowerCase()))
    ?? uniqueChains[0]
    ?? "";

  return (
    <main className="mx-auto max-w-6xl px-4 py-10 pb-24 md:pb-10">
      <section className="rounded-3xl border border-emerald-200 bg-gradient-to-br from-emerald-50 via-white to-cyan-50 p-6 shadow-sm dark:border-emerald-900 dark:from-emerald-950/20 dark:via-slate-950 dark:to-cyan-950/20">
        <p className="text-xs font-semibold uppercase tracking-wide text-emerald-700 dark:text-emerald-300">Min konto</p>
        <h1 className="mt-2 text-3xl font-bold tracking-tight">Konto, preferanser og område</h1>
        <p className="mt-2 text-sm text-slate-600 dark:text-slate-300">
          Du er innlogget som <span className="font-semibold">{user?.email ?? "ukjent"}</span>. Oppdater preferanser og handleliste her.
        </p>
        <form action={logoutAction} className="mt-4">
          <button type="submit" className="rounded-xl border border-slate-300 px-3 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:text-slate-200 dark:hover:bg-slate-800">
            Logg ut
          </button>
        </form>
      </section>

      <section className="mt-6 grid gap-6 lg:grid-cols-2">
        <form action={savePreferencesAction} className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm dark:border-slate-800 dark:bg-slate-900">
          <h2 className="text-2xl font-semibold">Preferanser</h2>

          <label className="mt-5 block text-sm font-medium">Postnummer (4 siffer)</label>
          <input
            name="postalCode"
            defaultValue={postalCode}
            maxLength={4}
            inputMode="numeric"
            pattern="[0-9]{4}"
            className="mt-2 w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-950"
          />

          <label className="mt-4 block text-sm font-medium">Reisemodus</label>
          <select
            name="travelMode"
            defaultValue={user?.preference?.travelMode ?? "DRIVE"}
            className="mt-2 w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-950"
          >
            <option value="DRIVE">Bil</option>
            <option value="WALK">Gå</option>
          </select>

          <label className="mt-4 block text-sm font-medium">Maks reisetid (minutter)</label>
          <input
            type="number"
            min={1}
            max={240}
            step={1}
            defaultValue={user?.preference?.maxTravelMinutes ?? 30}
            name="maxTravelMinutes"
            className="mt-2 w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-950"
          />

          <label className="mt-4 block text-sm font-medium">Maks avstand (km)</label>
          <input
            type="number"
            min={1}
            max={300}
            step={0.5}
            defaultValue={user?.preference?.maxTravelKm ?? 15}
            name="maxTravelKm"
            className="mt-2 w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-950"
          />

          <label className="mt-4 block text-sm font-medium">Primærbutikk</label>
          <select
            name="primaryStore"
            defaultValue={preferredChain}
            className="mt-2 w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-950"
            disabled={uniqueChains.length === 0}
          >
            {uniqueChains.length === 0 ? <option>Ingen kjeder registrert</option> : null}
            {uniqueChains.map((chain) => (
              <option key={chain} value={chain}>
                {chain}
              </option>
            ))}
          </select>

          <PriceSensitivitySlider initialValue={user?.preference?.priceSensitivity ?? 70} />

          <label className="mt-4 block text-sm font-medium">Ukentlig matbudsjett (kr)</label>
          <input
            type="number"
            min={0}
            step={50}
            defaultValue={weeklyBudget}
            name="weeklyGroceryBudget"
            className="mt-2 w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-950"
          />

          <label className="mt-4 block text-sm font-medium">Budsjett per handletur (kr)</label>
          <input
            type="number"
            min={0}
            step={50}
            defaultValue={shoppingTripBudget}
            name="shoppingTripBudget"
            className="mt-2 w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-950"
          />

          <label className="mt-4 flex items-center gap-2 rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-700 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-200">
            <input type="checkbox" name="useMembershipPricing" defaultChecked={user?.preference?.useMembershipPricing ?? true} />
            Bruk medlemspriser i anbefalingene
          </label>

          <button
            className="mt-5 w-full rounded-xl bg-emerald-600 px-4 py-3 text-sm font-semibold text-white hover:bg-emerald-500 disabled:cursor-not-allowed disabled:opacity-60"
            type="submit"
            disabled={uniqueChains.length === 0}
          >
            Lagre innstillinger
          </button>
        </form>

        <form action={createListAction} className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm dark:border-slate-800 dark:bg-slate-900">
          <h2 className="text-2xl font-semibold">Handleliste</h2>
          <p className="mt-2 text-sm text-slate-600 dark:text-slate-300">Velg varer for å lage eller oppdatere listen din.</p>

          <div className="mt-5 grid max-h-80 gap-2 overflow-y-auto pr-1">
            {products.length === 0 ? (
              <p className="text-sm text-slate-500 dark:text-slate-400">Ingen produkter registrert ennå.</p>
            ) : null}
            {products.map((product) => (
              <label key={product.id} className="flex items-center gap-3 rounded-xl border border-slate-200 p-3 text-sm dark:border-slate-700">
                <input type="checkbox" name="productIds" value={product.id} className="h-4 w-4" />
                <span>
                  {product.name} - {product.brand}
                </span>
              </label>
            ))}
          </div>

          <button
            className="mt-5 w-full rounded-xl bg-orange-500 px-4 py-3 text-sm font-semibold text-white hover:bg-orange-400 disabled:cursor-not-allowed disabled:opacity-60"
            type="submit"
            disabled={products.length === 0}
          >
            Lagre handleliste og gå til dashboard
          </button>

          <div className="mt-4 flex flex-wrap gap-2">
            {["student", "familie", "budsjett", "sunn"].map((preset) => (
              <form key={preset} action={createTemplateListAction}>
                <input type="hidden" name="template" value={preset} />
                <button
                  className="rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:bg-transparent dark:text-slate-200 dark:hover:bg-slate-800"
                  type="submit"
                >
                  Hurtigstart: {preset}
                </button>
              </form>
            ))}
          </div>
        </form>
      </section>
    </main>
  );
}
