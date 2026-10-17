import { DemoEnquiryForm } from "@/components/DemoEnquiryForm";
import { Art } from "../_components/Art";
import { DemoNotice } from "../_components/DemoNotice";
import { ButtonLink, Eyebrow } from "../_components/ui";
import { CONTACT, TRADE, telHref } from "../_data/content";

export const metadata = { title: "Trade & wholesale" };

const ENQUIRY_TYPES = ["Shop / supermarket", "Wholesaler", "Café / deli", "Restaurant", "Hotel", "Food-service / catering", "Other"];

export default function Trade() {
  return (
    <>
      <section className="mx-auto grid max-w-7xl gap-10 px-5 pb-16 pt-14 sm:px-8 sm:pt-20 lg:grid-cols-12 lg:items-center lg:gap-16">
        <div className="lg:col-span-6">
          <Eyebrow>Trade &amp; wholesale</Eyebrow>
          <h1 className="mt-4 font-serif text-[2.6rem] leading-[1.02] tracking-tight sm:text-6xl">Bake McCloskey’s quality into your business.</h1>
          <p className="mt-6 text-lg leading-relaxed text-cocoa">{TRADE.proposition}</p>
          <div className="mt-8 flex flex-wrap gap-3">
            <ButtonLink href="#enquire">Open a trade account <span aria-hidden>→</span></ButtonLink>
            <a href={telHref(CONTACT.bakeryPhone)} className="inline-flex min-h-12 items-center rounded-full border border-rye/25 px-6 text-sm font-medium hover:border-rye">
              Call the bakery {CONTACT.bakeryPhone}
            </a>
          </div>
        </div>
        <div className="lg:col-span-6">
          <Art kind="trade" label="Illustration of loaves in a bakery crate" className="aspect-[4/3] w-full" />
        </div>
      </section>

      <section className="mx-auto max-w-7xl px-5 sm:px-8">
        <ul className="grid gap-px border border-rye/10 bg-rye/10 sm:grid-cols-2 lg:grid-cols-4">
          {TRADE.capabilities.map((c, i) => (
            <li key={c.title} className="bg-flour p-6">
              <span className="font-serif text-crust tabular-nums">0{i + 1}</span>
              <h2 className="mt-6 font-serif text-2xl">{c.title}</h2>
              <p className="mt-2 text-sm leading-relaxed text-cocoa">{c.body}</p>
            </li>
          ))}
        </ul>
      </section>

      <section className="mx-auto mt-24 grid max-w-7xl gap-12 px-5 sm:px-8 lg:grid-cols-2">
        <div>
          <h2 className="font-serif text-4xl tracking-tight">Who we supply</h2>
          <ul className="mt-6 divide-y divide-rye/10 border-y border-rye/10">
            {TRADE.customers.map((c) => <li key={c} className="py-4 font-serif text-xl">{c}</li>)}
          </ul>
        </div>
        <div>
          <h2 className="font-serif text-4xl tracking-tight">Trade range</h2>
          <ul className="mt-6 grid grid-cols-2 gap-px border border-rye/10 bg-rye/10">
            {TRADE.categories.map((c) => <li key={c} className="bg-flour px-4 py-4">{c}</li>)}
          </ul>
          <p className="mt-4 text-sm text-cocoa">Fresh daily, frozen and par-baked formats. Full trade specifications on request.</p>
        </div>
      </section>

      <section id="enquire" className="mt-24 scroll-mt-20 bg-rye text-oat">
        <div className="mx-auto grid max-w-7xl gap-12 px-5 py-20 sm:px-8 lg:grid-cols-12">
          <div className="lg:col-span-4">
            <Eyebrow><span className="text-[#e3b98c]">Trade enquiry</span></Eyebrow>
            <h2 className="mt-4 font-serif text-4xl leading-tight text-cream">Tell us what your business needs.</h2>
            <p className="mt-4">Our trade team would come back to you with the range, pricing and delivery options for your area.</p>
          </div>
          <div className="lg:col-span-8">
            <DemoEnquiryForm businessTypes={ENQUIRY_TYPES} categories={[...TRADE.categories]} />
          </div>
        </div>
      </section>
      <div className="mx-auto max-w-7xl px-5 pt-6 text-cocoa sm:px-8"><DemoNotice /></div>
    </>
  );
}
