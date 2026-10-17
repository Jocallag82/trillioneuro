import { ButtonLink } from "./_components/ui";
import { DemoNotice } from "./_components/DemoNotice";
import { BASE } from "./_data/content";

export default function BakeryNotFound() {
  return (
    <section className="mx-auto max-w-3xl px-5 py-28 text-center sm:px-8">
      <p className="font-serif text-7xl text-crust">404</p>
      <h1 className="mt-4 font-serif text-4xl">This page has gone a bit stale.</h1>
      <p className="mt-3 text-cocoa">We couldn’t find what you were looking for.</p>
      <div className="mt-8 flex justify-center gap-3">
        <ButtonLink href={BASE}>Back to home</ButtonLink>
        <ButtonLink href={`${BASE}/cakes`} variant="ghost">Celebration cakes</ButtonLink>
      </div>
      <DemoNotice className="mt-12 text-cocoa" />
    </section>
  );
}
