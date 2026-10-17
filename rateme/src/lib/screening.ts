// Automated screening for review text. Pure functions, no I/O, unit-tested.
// IMPORTANT: nothing here looks at the star rating. Positive and negative reviews pass
// through identical checks so screening can never become review gating.

export type HoldReason =
  | 'contact_details' | 'link' | 'abusive_language' | 'threat' | 'possible_conflict'
  | 'burst' | 'repeat_device' | 'reviewer_is_member' | 'reported';

export const HOLD_REASON_LABELS: Record<HoldReason, string> = {
  contact_details: 'Contains a phone number or email address (personal information)',
  link: 'Contains a web link',
  abusive_language: 'Possible abusive or hateful language',
  threat: 'Possible threat or harassment',
  possible_conflict: 'Reviewer email domain matches the business’s domain',
  burst: 'Unusual burst of reviews for this business',
  repeat_device: 'Several reviews for this business from the same network',
  reviewer_is_member: 'Reviewer is a registered member of this business',
  reported: 'Reported by a visitor',
};

const PHONE = /(?:\+353|\b0)\s?\(?\d{1,3}\)?[\s-]?\d{3}[\s-]?\d{3,4}\b|\b08[35-9][\s-]?\d{3}[\s-]?\d{4}\b/;
const EMAIL = /[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/i;
const LINK = /\bhttps?:\/\/|\bwww\.[a-z0-9-]+\.|\b[a-z0-9-]+\.(?:com|ie|net|org|co\.uk|io)\b/i;
const THREAT = /\b(i(?:'| a)?ll (?:kill|hurt|find) you|i know where you live|burn (?:it|the place) down|you(?:'| a)?re dead|watch your back)\b/i;
const ABUSE = /\b(c[u*]nt|f[a*]ggot|n[i*]gg(?:er|a)|retard(?:ed)?|kn[a*]cker|tinker scum|paki)\b/i;

export function screenText(title: string | null, body: string | null): HoldReason[] {
  const t = `${title ?? ''}\n${body ?? ''}`;
  const out: HoldReason[] = [];
  if (PHONE.test(t) || EMAIL.test(t)) out.push('contact_details');
  if (LINK.test(t)) out.push('link');
  if (THREAT.test(t)) out.push('threat');
  if (ABUSE.test(t)) out.push('abusive_language');
  return out;
}

export function isConflictDomain(reviewerEmail: string, businessDomain: string | null): boolean {
  if (!businessDomain) return false;
  const d = reviewerEmail.split('@').pop()!.toLowerCase();
  return d === businessDomain || d.endsWith(`.${businessDomain}`);
}
