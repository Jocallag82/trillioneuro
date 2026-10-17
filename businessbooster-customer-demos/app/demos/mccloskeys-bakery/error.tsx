"use client";

export default function DemoError({ reset }: { error: Error; reset: () => void }) {
  return (
    <section className="mx-auto max-w-3xl px-5 py-28 text-center">
      <h1 className="font-serif text-4xl">Something went wrong.</h1>
      <p className="mt-3 text-cocoa">Please try again.</p>
      <button type="button" onClick={reset} className="mt-8 inline-flex min-h-12 items-center rounded-full bg-rye px-6 text-sm font-medium text-cream">
        Try again
      </button>
    </section>
  );
}
