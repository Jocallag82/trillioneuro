import { getCounties } from '@/lib/catalog';

export async function SearchForm({ q = '', where = '', county = '', compact = false }: { q?: string; where?: string; county?: string; compact?: boolean }) {
  const counties = await getCounties();
  return (
    <form action="/search" method="get" role="search" className={`card flex flex-col gap-2 p-2 shadow-[0_18px_50px_-30px_rgba(16,32,43,.45)] sm:flex-row sm:items-stretch ${compact ? '' : 'sm:p-2.5'}`}>
      <label className="flex flex-1 items-center gap-2 rounded-xl px-3 focus-within:bg-paper">
        <span className="sr-only">Business name or service</span>
        <svg aria-hidden="true" width="20" height="20" viewBox="0 0 24 24" className="shrink-0 text-muted"><path fill="currentColor" d="M10 3a7 7 0 0 1 5.6 11.2l4.6 4.6-1.4 1.4-4.6-4.6A7 7 0 1 1 10 3Zm0 2a5 5 0 1 0 0 10 5 5 0 0 0 0-10Z"/></svg>
        <input name="q" defaultValue={q} placeholder="Business name or service, e.g. plumber" className="h-12 w-full bg-transparent text-base outline-none placeholder:text-muted/80" autoComplete="off" />
      </label>
      <label className="flex items-center gap-2 rounded-xl px-3 focus-within:bg-paper sm:w-56 sm:border-l sm:border-line">
        <span className="sr-only">Town, county or Eircode</span>
        <svg aria-hidden="true" width="18" height="18" viewBox="0 0 24 24" className="shrink-0 text-muted"><path fill="currentColor" d="M12 2a7 7 0 0 1 7 7c0 5-7 13-7 13S5 14 5 9a7 7 0 0 1 7-7Zm0 4.5A2.5 2.5 0 1 0 12 11.5 2.5 2.5 0 0 0 12 6.5Z"/></svg>
        <input name="where" defaultValue={where} placeholder="Town or Eircode" className="h-12 w-full bg-transparent text-base outline-none placeholder:text-muted/80" list="rm-counties" autoComplete="off" />
      </label>
      <datalist id="rm-counties">{counties.map((c) => <option key={c.id} value={c.name} />)}</datalist>
      <label className="flex items-center rounded-xl px-2 sm:w-40 sm:border-l sm:border-line">
        <span className="sr-only">County</span>
        <select name="county" defaultValue={county} className="h-12 w-full bg-transparent text-base outline-none">
          <option value="">All counties</option>
          {counties.map((c) => <option key={c.id} value={c.slug}>Co. {c.name}</option>)}
        </select>
      </label>
      <button className="btn btn-primary h-12 px-6 text-base">Search</button>
    </form>
  );
}
