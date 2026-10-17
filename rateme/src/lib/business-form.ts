import 'server-only';
import { z } from 'zod';
import { normaliseEircode, normaliseUrl, domainOf } from './util';

export const businessSchema = z.object({
  name: z.string().trim().min(2, 'Enter the business name.').max(120),
  category_id: z.coerce.number().int().positive('Choose a category.'),
  county_id: z.coerce.number().int().positive('Choose a county.'),
  locality_id: z.coerce.number().int().positive().optional().or(z.literal('').transform(() => undefined)),
  address_line1: z.string().trim().max(120).optional(),
  address_line2: z.string().trim().max(120).optional(),
  eircode: z.string().trim().max(10).optional(),
  show_address: z.string().optional(),
  phone: z.string().trim().max(30).regex(/^[+0-9 ()-]*$/, 'Use digits, spaces and + only.').optional(),
  public_email: z.string().trim().max(200).email('Enter a valid email.').optional().or(z.literal('')),
  website: z.string().trim().max(300).optional(),
  description: z.string().trim().max(1500).optional(),
  cro_number: z.string().trim().max(20).regex(/^[0-9A-Za-z]*$/, 'Letters and numbers only.').optional(),
  facebook: z.string().trim().max(300).optional(),
  instagram: z.string().trim().max(300).optional(),
  linkedin: z.string().trim().max(300).optional(),
});

export type BusinessFields = {
  name: string; category_id: number; county_id: number; locality_id: number | null; address_line1: string | null; address_line2: string | null;
  eircode: string | null; show_address: boolean; phone: string | null; public_email: string | null; website: string | null; website_domain: string | null;
  description: string | null; cro_number: string | null; socials: Record<string, string>;
};

export function parseBusinessForm(form: FormData): { ok: true; data: BusinessFields } | { ok: false; errors: Record<string, string> } {
  const parsed = businessSchema.safeParse(Object.fromEntries(form));
  const errors: Record<string, string> = {};
  if (!parsed.success) {
    for (const i of parsed.error.issues) errors[String(i.path[0])] ??= i.message;
    return { ok: false, errors };
  }
  const d = parsed.data;
  const eircode = d.eircode ? normaliseEircode(d.eircode) : null;
  if (d.eircode && !eircode) errors.eircode = 'That doesn’t look like a valid Eircode (e.g. D02 X285).';
  const website = d.website ? normaliseUrl(d.website) : null;
  if (d.website && !website) errors.website = 'Enter a full web address, e.g. https://example.ie';
  const socials: Record<string, string> = {};
  for (const k of ['facebook', 'instagram', 'linkedin'] as const) {
    const v = d[k] ? normaliseUrl(d[k]) : null;
    if (d[k] && !v) errors[k] = 'Enter a full link.';
    if (v) {
      const host = domainOf(v) ?? '';
      if (!host.endsWith(`${k}.com`)) errors[k] = `Use a ${k}.com link.`;
      else socials[k] = v;
    }
  }
  if (Object.keys(errors).length) return { ok: false, errors };
  return {
    ok: true,
    data: {
      name: d.name.replace(/\s+/g, ' '), category_id: d.category_id, county_id: d.county_id, locality_id: d.locality_id ?? null,
      address_line1: d.address_line1 || null, address_line2: d.address_line2 || null, eircode, show_address: d.show_address === 'on',
      phone: d.phone || null, public_email: d.public_email || null, website, website_domain: domainOf(website),
      description: d.description || null, cro_number: d.cro_number ? d.cro_number.toUpperCase() : null, socials,
    },
  };
}
