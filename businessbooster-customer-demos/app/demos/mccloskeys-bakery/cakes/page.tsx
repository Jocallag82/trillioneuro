import Link from "next/link";
import { Art } from "../_components/Art";
import { PageHeader, TbcBadge } from "../_components/ui";
import { BASE, CAKE_PROMISE, CAKES } from "../_data/content";

export const metadata = { title: "Celebration cakes" };

const categories = Array.from(new Set(CAKES.map((c) => c.category)));

export default function Cakes() {
  return (
    <>
      <PageHeader
        eyebrow="Celebration cakes"
        title="Cakes for every occasion."
        intro="Baked fresh in Drogheda with fresh Irish cream and delivered the same day to the McCloskey’s store you choose. Order online, collect in store."
      />
      <section className="mx-auto max-w-7xl px-5 sm:px-8">
        <ul className="grid gap-px border border-rye/10 bg-rye/10 sm:grid-cols-2 lg:grid-cols-4">
          {CAKE_PROMISE.map((p, i) => (
            <li key={p} className="flex items-baseline gap-3 bg-flour px-5 py-5 text-sm">
              <span className="font-serif text-crust tabular-nums">0{i + 1}</span>
              {p}
            </li>
          ))}
        </ul>

        <nav aria-label="Cake categories" className="mt-12 flex flex-wrap gap-2">
          {categories.map((c) => (
            <a key={c} href={`#${c.toLowerCase().replace(/\s+/g, "-")}`} className="rounded-full border border-rye/20 px-4 py-2 text-sm hover:border-rye hover:bg-cream">
              {c}
            </a>
          ))}
        </nav>

        {categories.map((cat) => (
          <section key={cat} id={cat.toLowerCase().replace(/\s+/g, "-")} className="mt-14 scroll-mt-24">
            <h2 className="border-b border-rye/10 pb-4 font-serif text-3xl">{cat}</h2>
            <ul className="mt-8 grid gap-10 sm:grid-cols-2 lg:grid-cols-3">
              {CAKES.filter((c) => c.category === cat).map((c) => (
                <li key={c.slug}>
                  <Link href={`${BASE}/cakes/${c.slug}`} className="group block">
                    <div className="overflow-hidden">
                      <Art kind={c.art} label={`Illustration of a ${c.name}`} className="aspect-[5/4] w-full transition-transform duration-700 group-hover:scale-[1.03]" />
                    </div>
                    <div className="mt-5 flex items-start justify-between gap-4">
                      <h3 className="font-serif text-2xl group-hover:text-crust-deep">{c.name}</h3>
                      <span aria-hidden className="pt-2 text-crust transition-transform group-hover:translate-x-1">→</span>
                    </div>
                    <p className="mt-2 text-sm leading-relaxed text-cocoa">{c.summary}</p>
                    <p className="mt-3 flex items-center gap-3 text-sm">
                      <span className="text-cocoa">Price on confirmation</span>
                      {c.placeholder && <TbcBadge />}
                    </p>
                  </Link>
                </li>
              ))}
            </ul>
          </section>
        ))}
      </section>
    </>
  );
}
