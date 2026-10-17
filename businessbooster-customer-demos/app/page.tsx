import Link from "next/link";

export default function Home() {
  return (
    <main className="mx-auto flex min-h-dvh max-w-3xl flex-col justify-between px-6 py-10 sm:px-10">
      <p className="text-sm font-semibold tracking-tight">BusinessBooster.ie</p>
      <section className="py-16">
        <h1 className="font-serif text-4xl leading-[1.05] tracking-tight sm:text-6xl">
          Private website concepts for businesses we&rsquo;d like to work with.
        </h1>
        <p className="mt-6 max-w-xl text-lg text-neutral-600">
          This address hosts confidential, invitation-only demonstrations. If you&rsquo;ve received an access code
          from BusinessBooster.ie, you can open your concept below.
        </p>
        <Link
          href="/access"
          className="mt-10 inline-flex items-center gap-2 rounded-full bg-[var(--bb-ink)] px-6 py-3 text-sm font-medium text-white transition hover:bg-black"
        >
          Open your demonstration <span aria-hidden>→</span>
        </Link>
      </section>
      <footer className="text-xs text-neutral-500">BusinessBooster.ie is operated by Conjora.</footer>
    </main>
  );
}
