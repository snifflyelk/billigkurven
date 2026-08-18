import { getPublicPriceSnapshot } from "@/lib/market-intelligence";
import Link from "next/link";

export const revalidate = 300;

export default async function DistributionPage() {
  const snapshot = await getPublicPriceSnapshot();

  return (
    <main className="mx-auto max-w-6xl px-4 py-10 pb-16">
      <div>
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Distribusjon og partnerflater</h1>
          <p className="mt-2 text-slate-600 dark:text-slate-300">Offentlig API og embeddbar widget for ekstern distribusjon.</p>
        </div>
      </div>

      <section className="mt-6 rounded-3xl border border-slate-200 bg-white p-5 dark:border-slate-800 dark:bg-slate-900">
        <h2 className="text-xl font-semibold">Public snapshot API</h2>
        <p className="mt-2 text-sm text-slate-600 dark:text-slate-300">Endepunkt: /api/public/price-snapshot</p>
        <pre className="mt-3 overflow-x-auto rounded-xl border border-slate-200 bg-slate-50 p-3 text-xs dark:border-slate-800 dark:bg-slate-950/40">
{JSON.stringify(snapshot, null, 2)}
        </pre>
      </section>

      <section className="mt-6 rounded-3xl border border-slate-200 bg-white p-5 dark:border-slate-800 dark:bg-slate-900">
        <h2 className="text-xl font-semibold">Embeddbar widget</h2>
        <p className="mt-2 text-sm text-slate-600 dark:text-slate-300">Legg denne script-taggen på partnersider:</p>
        <pre className="mt-3 rounded-xl border border-slate-200 bg-slate-50 p-3 text-xs dark:border-slate-800 dark:bg-slate-950/40">{`<script src="/widget/price-snapshot" data-city="Oslo"></script>`}</pre>
      </section>
    </main>
  );
}
