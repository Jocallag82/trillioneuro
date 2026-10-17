export function Faq({ items }: { items: { q: string; a: React.ReactNode }[] }) {
  return (
    <div className="divide-y divide-line rounded-[var(--radius-card)] border border-line bg-white">
      {items.map((it) => (
        <details key={it.q} className="group p-5 [&_summary::-webkit-details-marker]:hidden">
          <summary className="flex cursor-pointer list-none items-start justify-between gap-4 font-semibold">
            <span>{it.q}</span>
            <span aria-hidden="true" className="mt-0.5 text-xl leading-none text-sea transition group-open:rotate-45">+</span>
          </summary>
          <div className="mt-3 leading-relaxed text-ink-2">{it.a}</div>
        </details>
      ))}
    </div>
  );
}
