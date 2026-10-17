import crypto from 'node:crypto';

export function sha256(s: string): string {
  return crypto.createHash('sha256').update(s).digest('hex');
}

export function randomToken(bytes = 32): string {
  return crypto.randomBytes(bytes).toString('base64url');
}

const ALNUM = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz23456789';
export function randomCode(len = 8): string {
  const out: string[] = [];
  const buf = crypto.randomBytes(len * 2);
  for (let i = 0; out.length < len && i < buf.length; i++) {
    const b = buf[i];
    if (b < 256 - (256 % ALNUM.length)) out.push(ALNUM[b % ALNUM.length]);
  }
  while (out.length < len) out.push(ALNUM[crypto.randomInt(ALNUM.length)]);
  return out.join('');
}

export function slugify(s: string): string {
  return s
    .normalize('NFD').replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/&/g, ' and ')
    .replace(/['’]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 70)
    .replace(/-+$/g, '');
}

/** Normalise an Eircode to "A65 F4E2" form, or null if it isn't one. */
export function normaliseEircode(input: string | null | undefined): string | null {
  if (!input) return null;
  const c = input.toUpperCase().replace(/\s+/g, '');
  if (!/^[A-Z][0-9][0-9W][0-9AC-FHKNPRTV-Y]{4}$/.test(c)) return null;
  return `${c.slice(0, 3)} ${c.slice(3)}`;
}

/** Bare host of a URL, lower-cased, without "www.". */
export function domainOf(url: string | null | undefined): string | null {
  if (!url) return null;
  try {
    const u = new URL(/^https?:\/\//i.test(url) ? url : `https://${url}`);
    const h = u.hostname.toLowerCase().replace(/^www\./, '');
    return h.includes('.') ? h : null;
  } catch {
    return null;
  }
}

export function normaliseUrl(url: string | null | undefined): string | null {
  if (!url) return null;
  const t = url.trim();
  if (!t) return null;
  try {
    const u = new URL(/^https?:\/\//i.test(t) ? t : `https://${t}`);
    if (!['http:', 'https:'].includes(u.protocol) || !u.hostname.includes('.')) return null;
    return u.toString();
  } catch {
    return null;
  }
}

export const FREE_EMAIL_DOMAINS = new Set([
  'gmail.com', 'googlemail.com', 'yahoo.com', 'yahoo.ie', 'yahoo.co.uk', 'hotmail.com', 'hotmail.co.uk', 'hotmail.ie',
  'outlook.com', 'outlook.ie', 'live.com', 'live.ie', 'msn.com', 'icloud.com', 'me.com', 'mac.com', 'aol.com',
  'eircom.net', 'proton.me', 'protonmail.com', 'gmx.com', 'mail.com', 'zoho.com', 'yandex.com', 'vodafone.ie',
]);

export function emailDomain(email: string): string {
  return email.split('@').pop()!.toLowerCase();
}
