'use server';
import { redirect } from 'next/navigation';
import { sql } from '@/lib/db';
import { loadBusinessCtx } from '@/lib/dashboard';
import { parseBusinessForm } from '@/lib/business-form';
import { audit } from '@/lib/audit';

const back = (id: string, k: 'msg' | 'err', m: string) => `/dashboard/b/${id}/edit?${k}=${encodeURIComponent(m)}`;

async function memberCtx(form: FormData) {
  const id = String(form.get('id') ?? '');
  const ctx = await loadBusinessCtx(id, `/dashboard/b/${id}/edit`);
  if (!ctx.verified || !ctx.ent.active) redirect(`/dashboard/b/${id}/edit`);
  return ctx;
}

export async function saveBusiness(form: FormData) {
  const ctx = await memberCtx(form);
  const id = ctx.business.id;
  form.set('name', ctx.business.name); // name changes go through support
  const res = parseBusinessForm(form);
  if (!res.ok) redirect(back(id, 'err', Object.values(res.errors)[0]));
  const d = res.data;
  const changed = Object.entries(d).filter(([k, v]) => JSON.stringify((ctx.business as Record<string, unknown>)[k] ?? null) !== JSON.stringify(v ?? null)).map(([k]) => k);
  try {
    await sql`update businesses set category_id = ${d.category_id}, county_id = ${d.county_id}, locality_id = ${d.locality_id},
      address_line1 = ${d.address_line1}, address_line2 = ${d.address_line2}, eircode = ${d.eircode}, show_address = ${d.show_address},
      phone = ${d.phone}, public_email = ${d.public_email}, website = ${d.website}, website_domain = ${d.website_domain},
      description = ${d.description}, cro_number = ${d.cro_number}, socials = ${sql.json(d.socials)}, updated_at = now()
      where id = ${id}`;
  } catch (e) {
    if ((e as { code?: string }).code === '23505') redirect(back(id, 'err', 'Another business with the same name already exists in that area.'));
    throw e;
  }
  await audit(ctx.user.id, 'business.profile_updated', 'business', id, { fields: changed });
  redirect(back(id, 'msg', 'Saved.'));
}

function sniff(buf: Buffer): 'image/png' | 'image/jpeg' | 'image/webp' | null {
  if (buf.length > 8 && buf.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))) return 'image/png';
  if (buf.length > 3 && buf[0] === 0xff && buf[1] === 0xd8 && buf[2] === 0xff) return 'image/jpeg';
  if (buf.length > 12 && buf.subarray(0, 4).toString('ascii') === 'RIFF' && buf.subarray(8, 12).toString('ascii') === 'WEBP') return 'image/webp';
  return null;
}

export async function uploadLogo(form: FormData) {
  const ctx = await memberCtx(form);
  const id = ctx.business.id;
  const file = form.get('logo');
  if (!(file instanceof File) || file.size === 0) redirect(back(id, 'err', 'Choose an image file.'));
  if (file.size > 300 * 1024) redirect(back(id, 'err', 'That image is larger than 300 KB.'));
  const buf = Buffer.from(await file.arrayBuffer());
  const mime = sniff(buf); // trust the bytes, not the file name or browser-reported type
  if (!mime) redirect(back(id, 'err', 'Only PNG, JPEG or WebP images are accepted.'));
  await sql.begin(async (tx) => {
    const [l] = await tx<{ id: string }[]>`insert into logos (business_id, mime, bytes) values (${id}, ${mime}, ${buf}) returning id`;
    await tx`update businesses set logo_id = ${l.id}, updated_at = now() where id = ${id}`;
    await tx`delete from logos where business_id = ${id} and id <> ${l.id}`;
  });
  await audit(ctx.user.id, 'business.logo_updated', 'business', id);
  redirect(back(id, 'msg', 'Logo updated.'));
}

export async function removeLogo(form: FormData) {
  const ctx = await memberCtx(form);
  await sql`update businesses set logo_id = null where id = ${ctx.business.id}`;
  await sql`delete from logos where business_id = ${ctx.business.id}`;
  redirect(back(ctx.business.id, 'msg', 'Logo removed.'));
}
