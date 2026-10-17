import Link from 'next/link';
import type { Metadata } from 'next';
import { loadBusinessCtx } from '@/lib/dashboard';
import { getCategories, getCounties, getLocalities } from '@/lib/catalog';
import { BizNav } from '../BizNav';
import { BusinessFormFields } from '@/components/BusinessFormFields';
import { Initials } from '@/components/BusinessCard';
import { Notice } from '@/components/ui';
import { SubmitButton } from '@/components/SubmitButton';
import { saveBusiness, uploadLogo, removeLogo } from './actions';

export const dynamic = 'force-dynamic';
export const metadata: Metadata = { title: 'Edit profile' };

export default async function Edit({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ msg?: string; err?: string }> }) {
  const { id } = await params; const sp = await searchParams;
  const ctx = await loadBusinessCtx(id, `/dashboard/b/${id}/edit`);
  if (!ctx.verified || !ctx.ent.active) {
    return (<div><BizNav ctx={ctx} active="edit" />
      <Notice kind="info">Editing your profile is a member feature{ctx.verified ? '' : ' available after ownership verification'}.{' '}
        {ctx.verified ? <Link className="underline" href={`/dashboard/b/${id}/membership`}>Activate membership</Link> : <Link className="underline" href={`/dashboard/b/${id}/verify`}>Verify ownership</Link>}.
        {' '}If something on your listing is wrong right now, <Link className="underline" href={`/business/${ctx.business.slug}/correction`}>report a correction</Link> — that’s free.</Notice></div>);
  }
  const [cats, counties, localities] = await Promise.all([getCategories(), getCounties(), getLocalities()]);
  const b = ctx.business;
  return (
    <div>
      <BizNav ctx={ctx} active="edit" />
      <div className="space-y-3">{sp.msg && <Notice kind="ok">{sp.msg}</Notice>}{sp.err && <Notice kind="error">{sp.err}</Notice>}</div>
      <div className="mt-4 grid gap-6 lg:grid-cols-[1fr_18rem]">
        <form action={saveBusiness} className="card space-y-5 p-5 sm:p-7">
          <input type="hidden" name="id" value={id} />
          <input type="hidden" name="name" value={b.name} />
          <p className="text-sm text-muted">Business name: <strong className="text-ink">{b.name}</strong>. To change the name, <Link className="text-sea underline" href="/contact">contact us</Link> — we check name changes so reviews stay attached to the right business.</p>
          <BusinessFormFields cats={cats} counties={counties} localities={localities} d={b} mode="owner" />
          <SubmitButton pendingText="Saving…">Save changes</SubmitButton>
        </form>
        <aside className="card h-fit p-5">
          <h2 className="font-sans text-base font-bold tracking-normal">Logo</h2>
          <div className="mt-3"><Initials name={b.name} logoId={b.logo_id} size={96} /></div>
          <form action={uploadLogo} className="mt-4 space-y-2">
            <input type="hidden" name="id" value={id} />
            <input type="file" name="logo" accept="image/png,image/jpeg,image/webp" required className="block w-full text-sm" aria-label="Logo file" />
            <p className="text-xs text-muted">PNG, JPEG or WebP, up to 300 KB. Square works best.</p>
            <SubmitButton className="btn btn-ghost btn-sm" pendingText="Uploading…">Upload logo</SubmitButton>
          </form>
          {b.logo_id && <form action={removeLogo} className="mt-2"><input type="hidden" name="id" value={id} /><button className="text-sm text-danger underline">Remove logo</button></form>}
        </aside>
      </div>
    </div>
  );
}
