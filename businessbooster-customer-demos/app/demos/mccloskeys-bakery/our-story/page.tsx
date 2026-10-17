import { Art } from "../_components/Art";
import { ButtonLink, PageHeader } from "../_components/ui";
import { BASE, TIMELINE } from "../_data/content";

export const metadata = { title: "Our story" };

export default function Story() {
  return (
    <>
      <PageHeader
        eyebrow="Our story"
        title="Three generations, one Drogheda bakery."
        intro="McCloskey’s is a family-owned bakery. What began with a bakery on Trinity Street in 1940 now supplies our own bakery cafés and shops and supermarkets across the north-east — and frozen baked goods throughout Ireland, the UK and Europe."
      />
      <section className="mx-auto max-w-7xl px-5 sm:px-8">
        <Art kind="hero" label="Illustration of a loaf and coffee" className="aspect-[21/9] w-full" />
      </section>
      <section className="mx-auto mt-20 max-w-4xl px-5 sm:px-8">
        <ol className="relative border-l border-rye/15">
          {TIMELINE.map((t) => (
            <li key={t.year + t.title} className="relative pb-14 pl-8 sm:pl-14">
              <span aria-hidden className="absolute -left-[5px] top-3 h-[9px] w-[9px] rounded-full bg-crust" />
              <p className="font-serif text-4xl text-crust-deep sm:text-5xl">{t.year}</p>
              <h2 className="mt-2 font-serif text-2xl">{t.title}</h2>
              <p className="mt-2 max-w-2xl leading-relaxed text-cocoa">{t.body}</p>
            </li>
          ))}
        </ol>
        <div className="flex flex-wrap gap-3">
          <ButtonLink href={`${BASE}/locations`}>Visit a bakery café</ButtonLink>
          <ButtonLink href={`${BASE}/trade`} variant="ghost">Trade &amp; wholesale</ButtonLink>
        </div>
      </section>
    </>
  );
}
