import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = { title: "Private demonstration · BusinessBooster.ie" };
export const dynamic = "force-dynamic";

const MESSAGES: Record<string, string> = {
  invalid: "That access code wasn't recognised. Check it and try again, or contact the person who sent it.",
  rate: "Too many attempts. Please wait a few minutes before trying again.",
  unavailable: "Demonstrations are temporarily unavailable. Please try again later.",
};

export default async function AccessPage({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  const params = await searchParams;
  const error = params.error ? MESSAGES[params.error] : undefined;
  const signedOut = params["signed-out"] === "1";

  return (
    <main className="mx-auto flex min-h-dvh max-w-md flex-col justify-center px-6 py-16">
      <Link href="/" className="text-sm font-semibold tracking-tight">BusinessBooster.ie</Link>
      <h1 className="mt-10 font-serif text-3xl tracking-tight sm:text-4xl">Open your private demonstration</h1>
      <p className="mt-3 text-neutral-600">Enter the access code you received from BusinessBooster.ie.</p>

      {signedOut && (
        <p role="status" className="mt-6 rounded-md border border-neutral-300 bg-white px-4 py-3 text-sm">
          You&rsquo;ve been signed out of the demonstration.
        </p>
      )}
      {error && (
        <p role="alert" className="mt-6 rounded-md border border-red-300 bg-red-50 px-4 py-3 text-sm text-red-900">
          {error}
        </p>
      )}

      <form action="/access/enter" method="post" className="mt-8 space-y-4">
        <label htmlFor="code" className="block text-sm font-medium">Access code</label>
        <input
          id="code"
          name="code"
          type="password"
          required
          minLength={12}
          maxLength={200}
          autoComplete="off"
          spellCheck={false}
          className="block w-full rounded-md border border-neutral-300 bg-white px-4 py-3 text-base outline-none focus:border-neutral-900 focus:ring-2 focus:ring-neutral-900/10"
        />
        <button
          type="submit"
          className="w-full rounded-md bg-[var(--bb-ink)] px-4 py-3 text-sm font-medium text-white transition hover:bg-black"
        >
          Continue
        </button>
      </form>
      <p className="mt-10 text-xs text-neutral-500">
        Demonstrations are confidential concepts prepared by BusinessBooster.ie (operated by Conjora) and are not
        official websites of the businesses shown.
      </p>
    </main>
  );
}
