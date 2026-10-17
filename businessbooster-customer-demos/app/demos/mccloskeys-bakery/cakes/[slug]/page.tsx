import Link from "next/link";
import { notFound } from "next/navigation";
import { DemoOrderJourney } from "@/components/DemoOrderJourney";
import { Art } from "../../_components/Art";
import { DemoNotice } from "../../_components/DemoNotice";
import { Eyebrow, TbcBadge } from "../../_components/ui";
import { BASE, CAKES, LOCATIONS, getCake } from "../../_data/content";

type Props = { params: Promise<{ slug: string }> };

export async function generateMetadata({ params }: Props) {
  const cake = getCake((await params).slug);
  return { title: cake ? cake.name : "Cake not found" };
}

export default async function CakeDetail({ params }: Props) {
  const cake = getCake((await params).slug);
  if (!cake) notFound();

  const stores = LOCATIONS.filter((l) => l.kind !== "Bakery & trade office").map((l) => ({ value: l.slug, label: `${l.name}, ${l.town}` }));
  const others = CAKES.filter((c) => c.slug !== cake.slug).slice(0, 3);

  return (
    <>
      <nav aria-label="Breadcrumb" className="mx-auto max-w-7xl px-5 pt-8 text-sm text-cocoa sm:px-8">
        <ol className="flex gap-2">
          <li><Link href={`${BASE}/cakes`} className="hover:text-rye">Celebration cakes</Link></li>
          <li aria-hidden>/</li>
          <li aria-current="page" className="text-rye">{cake.name}</li>
        </ol>
      </nav>
      <section className="mx-auto grid max-w-7xl gap-10 px-5 pt-8 sm:px-8 lg:grid-cols-12 lg:gap-16">
        <div className="lg:col-span-7">
          <div className="overflow-hidden lg:sticky lg:top-24">
            <Art kind={cake.art} label={`Illustration of a ${cake.name}`} className="aspect-square w-full" />
          </div>
        </div>
        <div className="lg:col-span-5">
          <Eyebrow>{cake.category}</Eyebrow>
          <h1 className="mt-4 font-serif text-5xl leading-[1.02] tracking-tight sm:text-6xl">{cake.name}</h1>
          <p className="mt-5 text-lg leading-relaxed text-cocoa">{cake.summary}</p>
          <div className="mt-5 flex flex-wrap items-center gap-3 text-sm">
            <span className="font-medium">Price, sizes &amp; flavours on confirmation</span>
            {cake.placeholder && <TbcBadge />}
          </div>
          <ul className="mt-8 space-y-2 border-y border-rye/10 py-5 text-sm">
            {cake.details.map((d) => (
              <li key={d} className="flex gap-3"><span aria-hidden className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-crust" />{d}</li>
            ))}
            <li className="flex gap-3"><span aria-hidden className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-crust" />Collect from any McCloskey’s café or shop</li>
          </ul>
          <div className="mt-8">
            <h2 className="mb-3 text-sm font-semibold uppercase tracking-[0.18em]">Order for collection</h2>
            <DemoOrderJourney productName={cake.name} stores={stores} />
          </div>
          <p className="mt-6 text-xs leading-relaxed text-cocoa">
            Allergen and ingredient information would be published here from the bakery’s own product specifications.
          </p>
          <DemoNotice className="mt-6 text-cocoa" />
        </div>
      </section>

      <section className="mx-auto mt-24 max-w-7xl px-5 sm:px-8">
        <h2 className="font-serif text-3xl">More celebration cakes</h2>
        <ul className="mt-8 grid gap-8 sm:grid-cols-3">
          {others.map((c) => (
            <li key={c.slug}>
              <Link href={`${BASE}/cakes/${c.slug}`} className="group block">
                <Art kind={c.art} label={`Illustration of a ${c.name}`} className="aspect-[4/3] w-full" />
                <p className="mt-3 font-serif text-xl group-hover:text-crust-deep">{c.name}</p>
              </Link>
            </li>
          ))}
        </ul>
      </section>
    </>
  );
}
