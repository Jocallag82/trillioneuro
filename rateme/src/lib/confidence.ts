// How much weight a score can bear, based ONLY on how many reviews there are and how recent they are.
// It says nothing about whether individual reviews are authentic, and it is not a statistical interval.

export type Confidence = { level: 'none' | 'early' | 'building' | 'established'; label: string; detail: string; stale: boolean };

export const CONFIDENCE_THRESHOLDS = { building: 5, established: 20, staleMonths: 12 } as const;

export function reviewConfidence(count: number, lastReviewAt: Date | string | null, now = new Date()): Confidence {
  const last = lastReviewAt ? new Date(lastReviewAt) : null;
  const stale = !!last && now.getTime() - last.getTime() > CONFIDENCE_THRESHOLDS.staleMonths * 30.44 * 86400_000;
  const staleNote = stale ? ` No new reviews in the last ${CONFIDENCE_THRESHOLDS.staleMonths} months, so it may not reflect the business today.` : '';
  if (!count) return { level: 'none', label: 'No reviews yet', detail: 'There is no score until real customers rate this business.', stale: false };
  if (count < CONFIDENCE_THRESHOLDS.building) {
    return { level: 'early', label: 'Early score', stale,
      detail: `Based on only ${count} ${count === 1 ? 'review' : 'reviews'}. One more review can change it a lot.${staleNote}` };
  }
  if (count < CONFIDENCE_THRESHOLDS.established) {
    return { level: 'building', label: 'Building', stale, detail: `Based on ${count} reviews — a useful signal, still sensitive to new reviews.${staleNote}` };
  }
  return { level: 'established', label: stale ? 'Established, not recent' : 'Established', stale, detail: `Based on ${count} reviews.${staleNote}` };
}
