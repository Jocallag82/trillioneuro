import type { Category, County, Locality } from '@/lib/catalog';

export type BusinessDefaults = Partial<{
  name: string; category_id: number; county_id: number; locality_id: number | null; address_line1: string | null; address_line2: string | null;
  eircode: string | null; show_address: boolean; phone: string | null; public_email: string | null; website: string | null; description: string | null;
  cro_number: string | null; socials: Record<string, string>;
}>;

function Err({ e }: { e?: string }) { return e ? <span className="hint font-medium text-danger">{e}</span> : null; }

export function BusinessFormFields({ cats, counties, localities, d = {}, errors = {}, mode }: {
  cats: Category[]; counties: County[]; localities: Locality[]; d?: BusinessDefaults; errors?: Record<string, string>; mode: 'owner' | 'community';
}) {
  const tops = cats.filter((c) => !c.parent_id);
  return (
    <div className="space-y-5">
      <label className="field"><span className="label">Business name</span>
        <input name="name" className="input" required maxLength={120} defaultValue={d.name ?? ''} aria-invalid={!!errors.name} /><Err e={errors.name} /></label>
      <label className="field"><span className="label">Category</span>
        <select name="category_id" className="select" required defaultValue={d.category_id ?? ''} aria-invalid={!!errors.category_id}>
          <option value="" disabled>Choose the closest match</option>
          {tops.map((t) => (
            <optgroup key={t.id} label={t.name}>
              <option value={t.id}>{t.name} (general)</option>
              {cats.filter((c) => c.parent_id === t.id).map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
            </optgroup>
          ))}
        </select><Err e={errors.category_id} /></label>
      <div className="grid gap-5 sm:grid-cols-2">
        <label className="field"><span className="label">County</span>
          <select name="county_id" className="select" required defaultValue={d.county_id ?? ''} aria-invalid={!!errors.county_id}>
            <option value="" disabled>Choose a county</option>
            {counties.map((c) => <option key={c.id} value={c.id}>Co. {c.name}</option>)}
          </select><Err e={errors.county_id} /></label>
        <label className="field"><span className="label">Town or area <span className="font-normal text-muted">(optional)</span></span>
          <select name="locality_id" className="select" defaultValue={d.locality_id ?? ''}>
            <option value="">Not listed / county-wide</option>
            {counties.map((c) => (
              <optgroup key={c.id} label={`Co. ${c.name}`}>
                {localities.filter((l) => l.county_id === c.id).map((l) => <option key={l.id} value={l.id}>{l.name}</option>)}
              </optgroup>
            ))}
          </select></label>
      </div>
      {mode === 'owner' && (
        <>
          <div className="grid gap-5 sm:grid-cols-2">
            <label className="field"><span className="label">Address line 1 <span className="font-normal text-muted">(optional)</span></span><input name="address_line1" className="input" maxLength={120} defaultValue={d.address_line1 ?? ''} autoComplete="address-line1" /></label>
            <label className="field"><span className="label">Address line 2 <span className="font-normal text-muted">(optional)</span></span><input name="address_line2" className="input" maxLength={120} defaultValue={d.address_line2 ?? ''} autoComplete="address-line2" /></label>
          </div>
          <div className="grid gap-5 sm:grid-cols-2">
            <label className="field"><span className="label">Eircode <span className="font-normal text-muted">(optional)</span></span><input name="eircode" className="input uppercase" maxLength={10} defaultValue={d.eircode ?? ''} placeholder="D02 X285" /><Err e={errors.eircode} /></label>
            <label className="flex items-start gap-3 self-end rounded-xl border border-line bg-white p-3 text-sm">
              <input type="checkbox" name="show_address" defaultChecked={!!d.show_address} className="mt-0.5 h-4 w-4 accent-[#0d5c61]" />
              <span><strong>Show street address publicly.</strong> Leave unticked if you work from home — we’ll only show your town and county.</span>
            </label>
          </div>
          <div className="grid gap-5 sm:grid-cols-2">
            <label className="field"><span className="label">Public phone <span className="font-normal text-muted">(optional)</span></span><input name="phone" className="input" maxLength={30} defaultValue={d.phone ?? ''} inputMode="tel" /><Err e={errors.phone} /></label>
            <label className="field"><span className="label">Public email <span className="font-normal text-muted">(optional)</span></span><input name="public_email" type="email" className="input" maxLength={200} defaultValue={d.public_email ?? ''} /><Err e={errors.public_email} /></label>
          </div>
        </>
      )}
      <label className="field"><span className="label">Website <span className="font-normal text-muted">(optional)</span></span><input name="website" className="input" maxLength={300} defaultValue={d.website ?? ''} placeholder="https://" /><Err e={errors.website} /></label>
      {mode === 'owner' && (
        <>
          <div className="grid gap-5 sm:grid-cols-3">
            {(['facebook', 'instagram', 'linkedin'] as const).map((k) => (
              <label key={k} className="field"><span className="label capitalize">{k} <span className="font-normal text-muted">(optional)</span></span><input name={k} className="input" maxLength={300} defaultValue={d.socials?.[k] ?? ''} /><Err e={errors[k]} /></label>
            ))}
          </div>
          <label className="field"><span className="label">Description <span className="font-normal text-muted">(optional)</span></span>
            <textarea name="description" className="textarea" maxLength={1500} defaultValue={d.description ?? ''} placeholder="What you do, the areas you cover, and what customers can expect." />
            <span className="hint">Factual, no claims you can’t back up. Don’t mention or rebut individual reviews here.</span></label>
          <label className="field"><span className="label">CRO or registered business name number <span className="font-normal text-muted">(optional, not shown publicly)</span></span>
            <input name="cro_number" className="input" maxLength={20} defaultValue={d.cro_number ?? ''} /><span className="hint">Helps us verify you faster. Find it on core.cro.ie.</span><Err e={errors.cro_number} /></label>
        </>
      )}
    </div>
  );
}
