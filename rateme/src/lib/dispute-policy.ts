// Pure dispute rules (no I/O) so they can be unit-tested and quoted in public policy pages.

export const DISPUTE_REASONS = {
  not_a_customer: 'We have no record of this customer or experience',
  conflict: 'We believe this was written by a competitor or someone connected to us',
  personal_info: 'It reveals private or personal information',
  false_facts: 'It states facts we can show are false',
  harassment: 'It is abusive or threatening',
  other: 'Other',
} as const;
export type DisputeReason = keyof typeof DISPUTE_REASONS;

/** Allegations that are policy breaches visible in the text itself: a moderator always checks these. */
const POLICY_REASONS: ReadonlySet<string> = new Set(['personal_info', 'harassment']);

export type DisputeStatus = 'open' | 'escalated' | 'upheld' | 'rejected' | 'withdrawn';

/**
 * What happens when the reviewer stands by their review.
 *  - Policy allegations (personal info, abuse) and disputes backed by business evidence go to a human.
 *  - Otherwise it's one person's word against an unsupported allegation: the review stays.
 */
export function afterReviewerStandsBy(d: { source: 'business' | 'reports'; reasonCode: string | null; evidence: string | null }):
  { status: 'rejected' | 'escalated'; escalationReason: string | null } {
  if (d.reasonCode && POLICY_REASONS.has(d.reasonCode)) return { status: 'escalated', escalationReason: 'policy_allegation' };
  if (d.source === 'business' && (d.evidence ?? '').trim().length >= 20) return { status: 'escalated', escalationReason: 'contested_evidence' };
  return { status: 'rejected', escalationReason: null };
}

/** What happens when the response window closes with no reply. Silence is never treated as proof. */
export function afterNoResponse(): { status: 'escalated'; escalationReason: 'no_response' } {
  return { status: 'escalated', escalationReason: 'no_response' };
}

/** Is a decision still appealable by a party? */
export function canAppeal(d: { status: string; appealUntil: Date | null }, now = new Date()): boolean {
  return (d.status === 'upheld' || d.status === 'rejected') && !!d.appealUntil && d.appealUntil.getTime() > now.getTime();
}

/** Outcome of granting an appeal: it reverses the dispute decision. */
export function appealGrantedReviewStatus(disputeStatus: 'upheld' | 'rejected'): 'published' | 'removed' {
  return disputeStatus === 'upheld' ? 'published' : 'removed';
}

export const ESCALATION_LABELS: Record<string, string> = {
  no_response: 'Reviewer did not respond in time',
  contested_evidence: 'Reviewer stands by it; business supplied evidence',
  policy_allegation: 'Alleged policy breach (personal info or abuse)',
};
