import Link from "next/link";
import { PageHeader } from "../_components/ui";
import { BASE, CONTACT, LOCATIONS, telHref } from "../_data/content";

export const metadata = { title: "Contact" };

export default function Contact() {
  return (
    <>
      <PageHeader eyebrow="Contact" title="We’d love to hear from you." />
      <section className="mx-auto grid max-w-7xl gap-px border border-rye/10 bg-rye/10 px-0 sm:mx-8 md:grid-cols-3 xl:mx-auto">
        <div className="bg-flour p-6">
          <h2 className="font-serif text-2xl">General enquiries</h2>
          <p className="mt-3 text-cocoa">Email</p>
          <p className="font-medium">{CONTACT.email}</p>
        </div>
        <div className="bg-flour p-6">
          <h2 className="font-serif text-2xl">Trade &amp; wholesale</h2>
          <p className="mt-3 text-cocoa">The Bakery, Ballymakenny Road, Drogheda</p>
          <a className="font-medium underline underline-offset-4" href={telHref(CONTACT.bakeryPhone)}>{CONTACT.bakeryPhone}</a>
          <p className="mt-3"><Link href={`${BASE}/trade#enquire`} className="text-sm underline underline-offset-4">Trade enquiry form</Link></p>
        </div>
        <div className="bg-flour p-6">
          <h2 className="font-serif text-2xl">Cafés &amp; shops</h2>
          <ul className="mt-3 space-y-1 text-sm">
            {LOCATIONS.filter((l) => l.kind !== "Bakery & trade office").map((l) => (
              <li key={l.slug}><Link href={`${BASE}/locations/${l.slug}`} className="hover:text-crust-deep">{l.name}, {l.town}</Link></li>
            ))}
          </ul>
        </div>
      </section>
    </>
  );
}
