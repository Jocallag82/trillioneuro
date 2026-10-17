'use client';
import { useActionState, useState } from 'react';
import { submitReviewAction, type ReviewFormState } from './actions';
import { SubmitButton } from '@/components/SubmitButton';
import { FormStarted } from '@/components/FormStarted';

const LABELS = ['', 'Poor', 'Below average', 'OK', 'Good', 'Excellent'];

export function ReviewForm({ businessId, businessName, source, months, experienceTypes, devMode }: {
  businessId: string; businessName: string; source: 'web' | 'qr'; months: { value: string; label: string }[]; experienceTypes: readonly string[]; devMode: boolean;
}) {
  const [state, action] = useActionState<ReviewFormState, FormData>(submitReviewAction, {});
  const [rating, setRating] = useState(0);
  const [hover, setHover] = useState(0);
  const [bodyLen, setBodyLen] = useState(0);
  const fe = state.fieldErrors ?? {};

  if (state.ok) {
    return (
      <div className="card p-6 text-center sm:p-10" role="status">
        <div className="mx-auto grid h-14 w-14 place-items-center rounded-full bg-sea-soft text-2xl" aria-hidden="true">✉️</div>
        <h2 className="mt-4 text-2xl font-semibold">{state.delivered === false && !devMode ? 'Review received' : 'Check your email to publish your review'}</h2>
        {state.delivered === false && !devMode ? (
          <p className="mx-auto mt-2 max-w-md text-ink-2">We saved your review but couldn’t send the confirmation email just now. We’ll retry; your review is published only after you confirm.</p>
        ) : (
          <p className="mx-auto mt-2 max-w-md text-ink-2">
            We’ve sent a confirmation link to <strong>{state.email}</strong>. Your review of {businessName} will be published once you click it
            (and it passes our standard checks). The link expires in 72 hours.
          </p>
        )}
        {devMode && <p className="mx-auto mt-4 max-w-md rounded-lg bg-gorse-soft p-3 text-sm">Development mode: no email provider is configured, so the message is in the email outbox table.</p>}
      </div>
    );
  }

  return (
    <form action={action} className="space-y-7" noValidate>
      <input type="hidden" name="business_id" value={businessId} />
      <input type="hidden" name="source" value={source} />
      <div className="sr-only-hp" aria-hidden="true"><label>Leave empty<input name="website_confirm" tabIndex={-1} autoComplete="off" /></label></div>
      <FormStarted />
      {state.error && <div role="alert" className="notice notice-error">{state.error}</div>}

      <fieldset>
        <legend className="text-lg font-semibold">How would you rate your experience?</legend>
        <p className="text-sm text-muted">There’s no default — choose what reflects your experience.</p>
        <div className="mt-3 flex flex-wrap items-center gap-1.5 sm:gap-2" onMouseLeave={() => setHover(0)}>
          {[1, 2, 3, 4, 5].map((n) => {
            const active = (hover || rating) >= n;
            return (
              <label key={n} className="cursor-pointer" onMouseEnter={() => setHover(n)}>
                <input type="radio" name="rating" value={n} className="peer sr-only" checked={rating === n} onChange={() => setRating(n)} aria-label={`${n} star${n > 1 ? 's' : ''} — ${LABELS[n]}`} />
                <span className={`grid h-12 w-12 place-items-center rounded-xl border-2 transition peer-focus-visible:ring-4 peer-focus-visible:ring-gorse/60 sm:h-14 sm:w-14 ${active ? 'border-gorse bg-gorse' : 'border-line bg-white'}`}>
                  <svg viewBox="0 0 24 24" width="28" height="28" aria-hidden="true"><path d="M12 2.8l2.8 5.7 6.3.9-4.6 4.5 1.1 6.3L12 17.2l-5.6 3 1.1-6.3L2.9 9.4l6.3-.9L12 2.8z" fill={active ? '#10202b' : '#c9c1b3'} /></svg>
                </span>
              </label>
            );
          })}
          <span className="w-full font-semibold text-ink-2 sm:ml-2 sm:w-auto" aria-live="polite">{LABELS[hover || rating]}</span>
        </div>
        {fe.rating && <p className="mt-2 text-sm font-medium text-danger">{fe.rating}</p>}
      </fieldset>

      <div className="grid gap-5 sm:grid-cols-2">
        <label className="field">
          <span className="label">When was your experience?</span>
          <select name="experience_month" className="select" defaultValue="" aria-invalid={!!fe.experience_month} required>
            <option value="" disabled>Choose a month</option>
            {months.map((m) => <option key={m.value} value={m.value}>{m.label}</option>)}
          </select>
          {fe.experience_month ? <span className="hint text-danger">{fe.experience_month}</span> : <span className="hint">Approximately is fine.</span>}
        </label>
        <label className="field">
          <span className="label">Type of experience <span className="font-normal text-muted">(optional)</span></span>
          <select name="experience_type" className="select" defaultValue="">
            <option value="">Choose one</option>
            {experienceTypes.map((t) => <option key={t} value={t}>{t}</option>)}
          </select>
        </label>
      </div>

      <label className="field">
        <span className="label">Headline <span className="font-normal text-muted">(optional)</span></span>
        <input name="title" className="input" maxLength={120} placeholder="Sum it up in a few words" />
      </label>
      <label className="field">
        <span className="label">Your review <span className="font-normal text-muted">(optional)</span></span>
        <textarea name="body" className="textarea" maxLength={4000} onChange={(e) => setBodyLen(e.target.value.length)} aria-invalid={!!fe.body}
          placeholder="What happened? What was good, or what could have been better? Stick to your own experience." />
        <span className="hint flex justify-between gap-3"><span>Please don’t include phone numbers, emails or other people’s personal details.</span><span className="tabular-nums">{bodyLen}/4000</span></span>
      </label>

      <div className="grid gap-5 sm:grid-cols-2">
        <label className="field">
          <span className="label">Name to show publicly</span>
          <input name="reviewer_name" className="input" maxLength={60} autoComplete="given-name" placeholder="e.g. Siobhán M." aria-invalid={!!fe.reviewer_name} required />
          {fe.reviewer_name ? <span className="hint text-danger">{fe.reviewer_name}</span> : <span className="hint">A first name and initial is fine.</span>}
        </label>
        <label className="field">
          <span className="label">Your email</span>
          <input name="reviewer_email" type="email" className="input" autoComplete="email" inputMode="email" aria-invalid={!!fe.reviewer_email} required />
          {fe.reviewer_email ? <span className="hint text-danger">{fe.reviewer_email}</span> : <span className="hint">Private. Used only to confirm and manage your review.</span>}
        </label>
      </div>

      <div className="rounded-xl bg-paper p-4 text-sm leading-relaxed text-ink-2">
        <p className="font-semibold text-ink">What will be public</p>
        <p className="mt-1">Your star rating, headline, review, display name, the month and type of experience, and the date it was published. <strong>Your email address is never shown</strong> to the public or to the business.</p>
      </div>

      <label className="flex items-start gap-3 rounded-xl border border-line bg-white p-4">
        <input type="checkbox" name="declaration" value="yes" className="mt-1 h-5 w-5 accent-[#0d5c61]" required aria-invalid={!!fe.declaration} />
        <span className="text-sm leading-relaxed">
          <strong>I confirm this review is based on my own genuine experience</strong> with {businessName}. I’m not the owner, an employee,
          a relative or a competitor, and I haven’t been offered anything in return for this review.
          {fe.declaration && <span className="mt-1 block font-medium text-danger">{fe.declaration}</span>}
        </span>
      </label>

      <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
        <SubmitButton className="btn btn-primary px-8 text-base" pendingText="Submitting…">Submit review</SubmitButton>
        <p className="text-xs text-muted">By submitting you agree to the <a className="underline" href="/review-policy" target="_blank">review policy</a> and <a className="underline" href="/terms" target="_blank">terms</a>.</p>
      </div>
    </form>
  );
}
