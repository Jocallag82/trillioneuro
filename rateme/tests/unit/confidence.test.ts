import { describe, it, expect } from 'vitest';
import { reviewConfidence } from '@/lib/confidence';

const now = new Date('2026-11-01T00:00:00Z');
describe('reviewConfidence', () => {
  it('no reviews → no score', () => expect(reviewConfidence(0, null, now).level).toBe('none'));
  it('few reviews → early', () => expect(reviewConfidence(3, '2026-10-01', now).level).toBe('early'));
  it('5–19 → building', () => expect(reviewConfidence(5, '2026-10-01', now).level).toBe('building'));
  it('20+ → established', () => expect(reviewConfidence(20, '2026-10-01', now)).toMatchObject({ level: 'established', stale: false }));
  it('flags stale scores and never claims authenticity', () => {
    const c = reviewConfidence(40, '2025-06-01', now);
    expect(c.stale).toBe(true);
    expect(c.label).toMatch(/not recent/);
    expect(`${c.label} ${c.detail}`).not.toMatch(/verified|genuine|authentic/i);
  });
});
