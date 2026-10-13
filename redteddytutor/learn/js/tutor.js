// Browser side of Teddy the tutor. Sends one turn to /api/rtt-tutor with the parent's
// access token, and turns every failure into a calm message plus the authored hints,
// so a tutor outage never breaks an activity.
import { ensureSession, loadSession } from './api.js';

const REASONS = {
  'signed-out': 'Ask a grown-up to sign in on the Account page to use Teddy’s explanations.',
  'no-profile': 'Choose a child profile on the Account page to use Teddy’s explanations.',
  'daily-limit': 'Teddy has helped a lot today. The explanations are back tomorrow. The hints still work.',
  'slow-down': 'Let’s try the question for a moment before asking again.',
  'unavailable': 'Teddy can’t explain right now. Here is a hint instead.',
  'fallback': 'Here is a hint instead.',
  'offline': 'You seem to be offline. Here is a hint instead.',
};

export const reasonText = (reason) => REASONS[reason] || REASONS.unavailable;

// Builds the item description the tutor needs from an engine step.
export function itemFor(step, attempts, revealed, learnerAnswer) {
  const answer = step.kind === 'numberline'
    ? (step.denominator ? `${step.target}/${step.denominator}` : String(step.target))
    : step.kind === 'build' ? String(step.target)
      : step.kind === 'order' ? step.accept[0]
        : step.options ? (step.options.find((o) => o.id === step.answer)?.label ?? step.answer) : step.answer;
  return {
    prompt: step.prompt,
    answer,
    options: step.options ? step.options.map((o) => o.label) : [],
    learnerAnswer: learnerAnswer || '',
    attempts,
    revealed,
    ...(step.visual?.kind === 'passage' ? { context: `${step.visual.title}. ${step.visual.text}` } : {}),
  };
}

export async function askTutor(storage, { profileId, objective, mode, item, message, history }) {
  if (typeof navigator !== 'undefined' && navigator.onLine === false) return { ok: false, reason: 'offline' };
  const session = await ensureSession(storage, loadSession(storage)).catch(() => null);
  if (!session) return { ok: false, reason: 'signed-out' };
  if (!profileId) return { ok: false, reason: 'no-profile' };
  try {
    const res = await fetch('/api/rtt-tutor', {
      method: 'POST',
      headers: { Authorization: `Bearer ${session.access_token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ profileId, objective, mode, item, message, history }),
      signal: AbortSignal.timeout(20000),
    });
    const data = await res.json().catch(() => ({}));
    if (data && data.ok) return data;
    return { ok: false, reason: data?.reason || (res.status === 401 ? 'signed-out' : 'unavailable') };
  } catch {
    return { ok: false, reason: 'unavailable' };
  }
}
