import Link from "next/link";

export function Eyebrow({ children }: { children: React.ReactNode }) {
  return <p className="text-[0.7rem] font-semibold uppercase tracking-[0.24em] text-crust-deep">{children}</p>;
}

export function PageHeader({ eyebrow, title, intro }: { eyebrow: string; title: string; intro?: string }) {
  return (
    <section className="mx-auto max-w-7xl px-5 pb-10 pt-14 sm:px-8 sm:pt-20">
      <Eyebrow>{eyebrow}</Eyebrow>
      <h1 className="mt-4 max-w-4xl font-serif text-[2.6rem] leading-[1.02] tracking-tight sm:text-6xl lg:text-7xl">{title}</h1>
      {intro && <p className="mt-6 max-w-2xl text-lg leading-relaxed text-cocoa">{intro}</p>}
    </section>
  );
}

export function ButtonLink({ href, children, variant = "solid" }: { href: string; children: React.ReactNode; variant?: "solid" | "ghost" }) {
  const base = "inline-flex min-h-12 items-center justify-center gap-2 rounded-full px-6 text-sm font-medium transition-colors";
  const styles =
    variant === "solid"
      ? "bg-rye text-cream hover:bg-crust-deep"
      : "border border-rye/25 text-rye hover:border-rye hover:bg-cream";
  return (
    <Link href={href} className={`${base} ${styles}`}>
      {children}
    </Link>
  );
}

export function TbcBadge() {
  return (
    <span className="inline-flex items-center rounded-full border border-dashed border-cocoa/40 px-2.5 py-0.5 text-[0.68rem] font-medium uppercase tracking-wider text-cocoa">
      Details to be confirmed
    </span>
  );
}
