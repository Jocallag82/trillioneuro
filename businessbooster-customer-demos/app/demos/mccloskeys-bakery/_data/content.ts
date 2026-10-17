/**
 * McCloskey's Bakery concept content. Server-only: imported by server components inside the gated
 * /demos/mccloskeys-bakery route tree.
 *
 * Every fact is sourced from public material (see SOURCES). Anything not verified is either omitted
 * or marked `placeholder: true` and rendered with a visible "to be confirmed" treatment.
 */
import "server-only";

export const BASE = "/demos/mccloskeys-bakery";

export const SOURCES = [
  { label: "mccloskeysbakery.ie — Our Story", url: "https://www.mccloskeysbakery.ie/about-us" },
  { label: "mccloskeysbakery.ie — Locations", url: "https://www.mccloskeysbakery.ie/locations" },
  { label: "mccloskeysbakery.ie — Online Cakes", url: "https://www.mccloskeysbakery.ie/" },
  { label: "Irish Food & Drink — supplier profile", url: "https://www.irishfoodanddrink.com/suppliers/mccloskeys-bakery/" },
  { label: "Guild of Fine Food — producer directory", url: "https://gff.co.uk/directory/producer/?id=56196" },
  { label: "Wholesale Directory Ireland", url: "https://www.wholesaledirectory.ie/supplier/2193/McCloskey's" },
] as const;

export const CONTACT = {
  email: "info@mccloskeysbakery.ie",
  bakeryPhone: "041 983 8692",
};

/* ---------- Heritage (mccloskeysbakery.ie/about-us) ---------- */

export const TIMELINE = [
  {
    year: "1940",
    title: "Lyons Bakery, Trinity Street",
    body: "Paddy McCloskey Sr, in partnership with his brother Frank and Joe Shiels, purchases Lyons Bakery on Trinity Street, Drogheda.",
  },
  {
    year: "1940s",
    title: "The first bread shop & tea rooms",
    body: "Having bought out his partners, Paddy and his wife Vera open their first bread shop and tea rooms in the mid-1940s.",
  },
  {
    year: "1950s",
    title: "A second generation",
    body: "Paddy McCloskey Jr joins the family business in the late 1950s.",
  },
  {
    year: "1983",
    title: "The Moorland Café",
    body: "Paddy Jr purchases the Moorland Café — already an established home bakery and tea rooms — and renovates it into the 120-seat coffee shop on West Street.",
  },
  {
    year: "1985",
    title: "The third generation",
    body: "Patrick McCloskey, grandson of Paddy Sr, becomes involved in the company. He runs the business today.",
  },
  {
    year: "2007",
    title: "Ballymakenny",
    body: "Patrick relocates the bakery to a new, state-of-the-art facility in Ballymakenny, Drogheda — built to develop a range of bakery products for export.",
  },
] as const;

/* ---------- Celebration cakes ---------- */

export interface Cake {
  slug: string;
  name: string;
  category: "Fresh cream" | "Chocolate" | "Celebration";
  summary: string;
  /** Verified claims only. */
  details: string[];
  /** True when the listing itself is illustrative and must be confirmed with the bakery. */
  placeholder: boolean;
  art: "cream" | "chocolate" | "mandarin" | "celebration";
}

// Range statements verified from mccloskeysbakery.ie: "baked fresh", "same day delivery to store",
// "a cake for every occasion and celebration", "fresh Irish cream". Individual product names, sizes,
// flavours and prices are NOT verified, so each listing is flagged as a placeholder.
export const CAKE_PROMISE = [
  "Baked fresh",
  "Same-day delivery to your chosen store",
  "Made with fresh Irish cream",
  "A cake for every occasion",
] as const;

export const CAKES: Cake[] = [
  {
    slug: "fresh-cream-sponge",
    name: "Fresh Cream Sponge",
    category: "Fresh cream",
    summary: "A light sponge layered with fresh Irish cream — the centrepiece of any birthday table.",
    details: ["Made with fresh Irish cream", "Baked fresh and delivered same day to store"],
    placeholder: true,
    art: "cream",
  },
  {
    slug: "fresh-cream-mandarin",
    name: "Fresh Cream Mandarin",
    category: "Fresh cream",
    summary: "Fresh cream and mandarin — a long-standing customer favourite, frequently mentioned in public reviews.",
    details: ["Made with fresh Irish cream", "Baked fresh and delivered same day to store"],
    placeholder: true,
    art: "mandarin",
  },
  {
    slug: "chocolate-sponge",
    name: "Chocolate Sponge",
    category: "Chocolate",
    summary: "A deep chocolate sponge for chocolate lovers of every age.",
    details: ["Baked fresh and delivered same day to store"],
    placeholder: true,
    art: "chocolate",
  },
  {
    slug: "celebration-cake",
    name: "Personalised Celebration Cake",
    category: "Celebration",
    summary: "Proposed listing for milestone birthdays, christenings, communions and family occasions.",
    details: ["Baked fresh and delivered same day to store"],
    placeholder: true,
    art: "celebration",
  },
];

export function getCake(slug: string): Cake | undefined {
  return CAKES.find((c) => c.slug === slug);
}

/* ---------- Bread & bakery (Irish Food & Drink; Guild of Fine Food) ---------- */

export const BAKERY_RANGE = [
  {
    id: "loaves",
    title: "Loaves & brown breads",
    intro: "Everyday staples and Irish brown breads, baked daily in Drogheda.",
    items: [
      { name: "Cottage Brown", note: "Brown loaf" },
      { name: "Nutty Brown", note: "Brown loaf" },
      { name: "Tiger Bread", note: "Crackle-crust white" },
      { name: "Bloomers", note: "Crusty white" },
      { name: "Sandwich breads", note: "Sliced pan range" },
      { name: "Seeded breads", note: "Multi-seed range" },
    ],
  },
  {
    id: "soda",
    title: "Soda breads",
    intro: "Ireland’s own bread, a fixture of the McCloskey’s range.",
    items: [{ name: "Soda breads", note: "Range to be confirmed" }],
  },
  {
    id: "rolls",
    title: "Rolls, baps & bagels",
    intro: "For lunch counters, deli bars and the breakfast table.",
    items: [
      { name: "Rolls", note: "Range to be confirmed" },
      { name: "Baps", note: "Range to be confirmed" },
      { name: "Bagels", note: "Range to be confirmed" },
    ],
  },
  {
    id: "seasonal",
    title: "Seasonal & traditional",
    intro: "The bakes that mark the Irish year.",
    items: [
      { name: "Rich Fruit Brack", note: "Traditional fruit loaf" },
      { name: "Mince Pies", note: "Christmas" },
    ],
  },
] as const;

/* ---------- Locations (mccloskeysbakery.ie/locations) ---------- */

export type LocationKind = "Café" | "Bakery shop" | "Bakery & trade office";

export interface Location {
  slug: string;
  name: string;
  town: "Drogheda" | "Dundalk" | "Navan";
  kind: LocationKind;
  address: string[];
  eircode?: string;
  phone?: string;
  hours: { days: string; time: string }[];
  note?: string;
}

export const LOCATIONS: Location[] = [
  {
    slug: "moorland-cafe-drogheda",
    name: "Moorland Café",
    town: "Drogheda",
    kind: "Café",
    address: ["96/97 West Street", "Drogheda, Co. Louth"],
    eircode: "A92 P902",
    phone: "041 983 3951",
    hours: [
      { days: "Monday – Saturday", time: "9am – 5pm" },
      { days: "Sunday", time: "11am – 4pm" },
    ],
    note: "The family’s 120-seat coffee shop, owned since 1983.",
  },
  {
    slug: "trinity-street-drogheda",
    name: "Trinity Street",
    town: "Drogheda",
    kind: "Bakery shop",
    address: ["63 Trinity Street", "Drogheda, Co. Louth"],
    eircode: "A92 PC83",
    phone: "041 983 7643",
    hours: [
      { days: "Monday – Saturday", time: "9am – 4pm" },
      { days: "Sunday", time: "Closed" },
    ],
    note: "On the street where the story began in 1940.",
  },
  {
    slug: "marshes-dundalk",
    name: "Marshes Shopping Centre",
    town: "Dundalk",
    kind: "Café",
    address: ["Marshes Shopping Centre", "Dundalk, Co. Louth"],
    phone: "042 935 9292",
    hours: [
      { days: "Monday – Wednesday", time: "10am – 5pm" },
      { days: "Thursday – Saturday", time: "9am – 5pm" },
      { days: "Sunday", time: "12pm – 5pm" },
    ],
  },
  {
    slug: "clanbrassil-street-dundalk",
    name: "Clanbrassil Street",
    town: "Dundalk",
    kind: "Bakery shop",
    address: ["90 Clanbrassil Street", "Townparks, Dundalk, Co. Louth"],
    eircode: "A91 N727",
    hours: [
      { days: "Monday – Saturday", time: "9am – 5pm" },
      { days: "Sunday", time: "Closed" },
    ],
    // Public sources list two different numbers for this shop, so none is shown until confirmed.
  },
  {
    slug: "navan-shopping-centre",
    name: "Navan Shopping Centre",
    town: "Navan",
    kind: "Café",
    address: ["Navan Shopping Centre", "Navan, Co. Meath"],
    eircode: "C15 C861",
    phone: "046 909 3504",
    hours: [
      { days: "Monday – Saturday", time: "9am – 5pm" },
      { days: "Sunday", time: "11:30am – 5pm" },
    ],
  },
  {
    slug: "ballymakenny-bakery",
    name: "The Bakery, Ballymakenny",
    town: "Drogheda",
    kind: "Bakery & trade office",
    address: ["Ballymakenny Road", "Drogheda, Co. Louth"],
    eircode: "A92 YVR8",
    phone: "041 983 8692",
    hours: [],
    note: "Production bakery and head office since 2007. Trade enquiries.",
  },
];

export function getLocation(slug: string): Location | undefined {
  return LOCATIONS.find((l) => l.slug === slug);
}

export function mapsUrl(l: Location): string {
  const q = [`McCloskey's ${l.name}`, ...l.address, l.eircode ?? ""].join(", ");
  return "https://www.google.com/maps/search/?api=1&query=" + encodeURIComponent(q);
}

export function telHref(phone: string): string {
  return "tel:+353" + phone.replace(/\s/g, "").replace(/^0/, "");
}

/* ---------- Trade (Our Story; Irish Food & Drink; Wholesale Directory) ---------- */

export const TRADE = {
  proposition:
    "From our bakery in Drogheda, we supply shops and supermarkets along the north-eastern corridor with fresh goods every day — and frozen baked goods throughout Ireland, the UK and Europe.",
  capabilities: [
    { title: "Daily fresh delivery", body: "Fresh goods supplied to shops and supermarkets along the north-eastern corridor on a daily basis." },
    { title: "Frozen & par-baked", body: "Frozen and par-baked produce for operators who bake off on site." },
    { title: "Export", body: "Frozen baked goods supplied throughout Ireland, the UK and Europe." },
    { title: "Purpose-built facility", body: "A state-of-the-art bakery at Ballymakenny, Drogheda, built in 2007 to develop products for export." },
  ],
  customers: ["Shops & supermarkets", "Wholesalers", "Retailers", "Restaurateurs"],
  categories: ["Bagels", "Rolls & baps", "Soda breads", "Sandwich breads", "Bloomers", "Seeded breads"],
} as const;
