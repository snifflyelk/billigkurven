import Link from "next/link";
import { redirect } from "next/navigation";
import { getAuthenticatedSessionUserId } from "@/lib/user-session";
import { loginAction, registerAction } from "@/app/login/actions";

export const dynamic = "force-dynamic";

export default async function LoginPage({
  searchParams,
}: {
  searchParams?: { next?: string; error?: string };
}) {
  const currentUserId = await getAuthenticatedSessionUserId();
  const next = searchParams?.next && searchParams.next.startsWith("/") ? searchParams.next : "/account";

  if (currentUserId) {
    redirect(next);
  }

  const error = searchParams?.error?.trim() || null;

  return (
    <main className="mx-auto flex min-h-[70vh] max-w-2xl flex-col items-center justify-center px-4 py-10">
      <section className="w-full max-w-md rounded-3xl border border-slate-200 bg-white p-6 shadow-sm dark:border-slate-800 dark:bg-slate-900">
        <p className="text-xs font-semibold uppercase tracking-wide text-emerald-700 dark:text-emerald-300">Konto</p>
        <h1 className="mt-2 text-3xl font-bold tracking-tight">Logg inn</h1>
        <p className="mt-2 text-sm text-slate-600 dark:text-slate-300">
          Logg inn for å lagre preferanser, område og handleliste.
        </p>
        {error ? (
          <p className="mt-4 rounded-xl border border-rose-300 bg-rose-50 px-3 py-2 text-sm text-rose-800 dark:border-rose-900 dark:bg-rose-950/30 dark:text-rose-200">
            {error}
          </p>
        ) : null}

        <form action={loginAction} className="mt-4">
          <input type="hidden" name="next" value={next} />

          <label className="mt-4 block text-sm font-medium">E-post</label>
          <input
            type="email"
            name="email"
            required
            autoComplete="email"
            className="mt-2 w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-950"
          />

          <label className="mt-4 block text-sm font-medium">Passord</label>
          <input
            type="password"
            name="password"
            required
            minLength={8}
            autoComplete="current-password"
            className="mt-2 w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-950"
          />

          <button className="mt-5 w-full rounded-xl bg-emerald-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-emerald-500" type="submit">
            Logg inn
          </button>

          <button
            formAction={registerAction}
            className="mt-3 w-full rounded-xl bg-orange-500 px-4 py-2.5 text-sm font-semibold text-white hover:bg-orange-400"
            type="submit"
          >
            Opprett konto
          </button>

          <p className="mt-3 text-xs text-slate-500 dark:text-slate-400">
            Ved opprettelse godtar du bruksvilkår. Du kan oppdatere innstillinger senere under konto.
          </p>
        </form>
      </section>

      <div className="mt-5 w-full max-w-md">
        <Link href="/" className="text-sm font-medium text-emerald-700 hover:underline dark:text-emerald-300">
          Tilbake til forsiden
        </Link>
      </div>
    </main>
  );
}
