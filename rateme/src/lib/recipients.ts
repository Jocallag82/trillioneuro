// Pure recipient rules (no I/O) — unit-tested. Conservative by design: anything that could be a
// named individual (sole trader, personal mailbox) is NOT eligible for unsolicited claim invitations.
export const FREE_MAIL = new Set(['gmail.com', 'googlemail.com', 'hotmail.com', 'hotmail.co.uk', 'outlook.com', 'outlook.ie', 'live.com', 'live.ie',
  'yahoo.com', 'yahoo.co.uk', 'yahoo.ie', 'icloud.com', 'me.com', 'eircom.net', 'gmx.com', 'aol.com', 'proton.me', 'protonmail.com', 'msn.com']);
const GENERIC = /^(info|hello|contact|office|admin|sales|enquiries|enquiry|bookings|booking|reception|accounts|team|support|mail|service|orders)$/;

export type RecipientClass = 'business_domain' | 'generic_mailbox' | 'unknown';

/** generic_mailbox = role address on the business's own domain (e.g. info@murphyelectrical.ie). */
export function classifyBusinessEmail(email: string | null | undefined, websiteDomain?: string | null): RecipientClass {
  const m = String(email ?? '').trim().toLowerCase().match(/^([^@\s]+)@([a-z0-9.-]+\.[a-z]{2,})$/);
  if (!m) return 'unknown';
  const [, local, domain] = m;
  if (FREE_MAIL.has(domain)) return 'unknown';
  if (websiteDomain && !domain.endsWith(websiteDomain.replace(/^www\./, '').toLowerCase())) return 'unknown';
  return GENERIC.test(local) ? 'generic_mailbox' : 'business_domain';
}

/** Only role mailboxes on a business domain are eligible for a claim invitation (pending legal sign-off). */
export const claimInviteEligible = (c: RecipientClass) => c === 'generic_mailbox';
