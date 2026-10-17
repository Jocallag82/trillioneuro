import { describe, it, expect } from 'vitest';
import { screenText, isConflictDomain } from '@/lib/screening';
import { decideEntitlement } from '@/lib/entitlement';
import { normaliseEircode, slugify, domainOf, normaliseUrl, randomCode } from '@/lib/util';
import { hashPassword, verifyPassword, passwordProblem } from '@/lib/password';

describe('screening (rating-blind)', () => {
  it('flags phone numbers, emails and links', () => {
    expect(screenText(null, 'Call me on 087 123 4567')).toContain('contact_details');
    expect(screenText(null, 'ring +353 1 234 5678 anytime')).toContain('contact_details');
    expect(screenText('x', 'email joe@example.com')).toContain('contact_details');
    expect(screenText(null, 'see www.competitor.ie instead')).toContain('link');
  });
  it('flags threats and slurs', () => {
    expect(screenText(null, 'I know where you live')).toContain('threat');
    expect(screenText(null, 'what a knacker')).toContain('abusive_language');
  });
  it('passes ordinary negative and positive reviews identically', () => {
    expect(screenText('Terrible', 'Waited two hours, food was cold and staff were rude.')).toEqual([]);
    expect(screenText('Brilliant', 'Fixed my boiler the same day, fair price.')).toEqual([]);
  });
  it('detects conflict domains', () => {
    expect(isConflictDomain('owner@murphys.ie', 'murphys.ie')).toBe(true);
    expect(isConflictDomain('x@mail.murphys.ie', 'murphys.ie')).toBe(true);
    expect(isConflictDomain('someone@gmail.com', 'murphys.ie')).toBe(false);
    expect(isConflictDomain('a@b.ie', null)).toBe(false);
  });
});

describe('entitlement policy', () => {
  const now = new Date('2026-10-17T12:00:00Z');
  const base = { id: 's', cancel_at_period_end: false, refunded_at: null, disputed_at: null, ended_at: null, stripe_customer_id: 'cus', amount_cents: 4999, plan_name: 'F' };
  const future = new Date('2027-10-17T00:00:00Z');
  const past = new Date('2026-09-01T00:00:00Z');
  it('none without a subscription', () => expect(decideEntitlement(undefined, 14, now).state).toBe('none'));
  it('active', () => expect(decideEntitlement({ ...base, status: 'active', current_period_end: future }, 14, now)).toMatchObject({ active: true, state: 'active' }));
  it('cancelling stays active until period end', () => expect(decideEntitlement({ ...base, status: 'active', cancel_at_period_end: true, current_period_end: future }, 14, now)).toMatchObject({ active: true, state: 'cancelling' }));
  it('past_due within grace is active', () => expect(decideEntitlement({ ...base, status: 'past_due', current_period_end: new Date('2026-10-10T00:00:00Z') }, 14, now)).toMatchObject({ active: true, state: 'grace' }));
  it('past_due after grace expires', () => expect(decideEntitlement({ ...base, status: 'past_due', current_period_end: past }, 14, now)).toMatchObject({ active: false, state: 'expired' }));
  it('canceled is expired', () => expect(decideEntitlement({ ...base, status: 'canceled', current_period_end: past }, 14, now).active).toBe(false));
  it('refund suspends', () => expect(decideEntitlement({ ...base, status: 'active', refunded_at: now, current_period_end: future }, 14, now).state).toBe('suspended'));
  it('dispute suspends', () => expect(decideEntitlement({ ...base, status: 'active', disputed_at: now, current_period_end: future }, 14, now).state).toBe('suspended'));
  it('active but long past period end (missed deletion) is expired', () => expect(decideEntitlement({ ...base, status: 'active', current_period_end: past }, 14, now).active).toBe(false));
});

describe('utils', () => {
  it('eircodes', () => {
    expect(normaliseEircode('d02x285')).toBe('D02 X285');
    expect(normaliseEircode('D6W 1234')).toBe('D6W 1234');
    expect(normaliseEircode('A65 F4E2')).toBe('A65 F4E2');
    expect(normaliseEircode('12345')).toBeNull();
    expect(normaliseEircode('D02 XB85')).toBeNull(); // B not allowed in unique identifier
  });
  it('slugs handle Irish fadas', () => expect(slugify('Ó Briain’s Café & Bar')).toBe('o-briains-cafe-and-bar'));
  it('domains', () => {
    expect(domainOf('https://www.Murphys.ie/contact')).toBe('murphys.ie');
    expect(domainOf('murphys.ie')).toBe('murphys.ie');
    expect(domainOf('not a url')).toBeNull();
    expect(normaliseUrl('javascript:alert(1)')).toBeNull();
  });
  it('random codes', () => {
    const c = randomCode(8);
    expect(c).toMatch(/^[A-Za-z0-9]{8}$/);
    expect(new Set(Array.from({ length: 500 }, () => randomCode(8))).size).toBe(500);
  });
});

describe('passwords', () => {
  it('hash and verify', async () => {
    const h = await hashPassword('correct horse battery');
    expect(h.startsWith('scrypt$')).toBe(true);
    expect(await verifyPassword('correct horse battery', h)).toBe(true);
    expect(await verifyPassword('wrong password!', h)).toBe(false);
  });
  it('strength', () => {
    expect(passwordProblem('short')).not.toBeNull();
    expect(passwordProblem('aaaaaaaaaaaa')).not.toBeNull();
    expect(passwordProblem('a-decent-passphrase')).toBeNull();
  });
});
