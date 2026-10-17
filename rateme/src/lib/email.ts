import 'server-only';
import { sql } from './db';
import { env, isProduction } from './env';

type Mail = { to: string; subject: string; text: string; template: string };

/**
 * Every message is written to email_outbox first (an auditable record), then delivered
 * through Resend when RESEND_API_KEY is configured. Without a provider, messages stay
 * in the outbox and `delivered` is false — callers must not pretend otherwise.
 */
export async function sendEmail(mail: Mail): Promise<{ delivered: boolean }> {
  const [row] = await sql<{ id: string }[]>`
    insert into email_outbox (to_email, subject, body_text, template)
    values (${mail.to}, ${mail.subject}, ${mail.text}, ${mail.template}) returning id`;
  if (!env.resendApiKey) {
    if (!isProduction()) console.info(`[email:${mail.template}] to=${mail.to} subject="${mail.subject}" (outbox only)`);
    return { delivered: false };
  }
  try {
    const r = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: { Authorization: `Bearer ${env.resendApiKey}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ from: env.emailFrom, to: [mail.to], subject: mail.subject, text: mail.text }),
      signal: AbortSignal.timeout(8000),
    });
    const body = (await r.json().catch(() => ({}))) as { id?: string; message?: string };
    if (!r.ok) throw new Error(body.message || `HTTP ${r.status}`);
    await sql`update email_outbox set sent_at = now(), provider_id = ${body.id ?? null} where id = ${row.id}`;
    return { delivered: true };
  } catch (e) {
    await sql`update email_outbox set error = ${String((e as Error).message).slice(0, 300)} where id = ${row.id}`;
    console.error('email delivery failed', mail.template);
    return { delivered: false };
  }
}

export const emailConfigured = () => !!env.resendApiKey;

const sig = `\n\n— RateMe.ie\nIrish business ratings from genuine customer experiences.\n${env.appUrl}`;

export const templates = {
  verifyEmail: (name: string, link: string) => ({
    subject: 'Confirm your email for RateMe.ie',
    text: `Hi ${name},\n\nPlease confirm your email address to finish setting up your RateMe.ie account:\n\n${link}\n\nThis link expires in 48 hours. If you didn't create an account, you can ignore this email.${sig}`,
  }),
  resetPassword: (link: string) => ({
    subject: 'Reset your RateMe.ie password',
    text: `Someone (hopefully you) asked to reset the password for this email address.\n\n${link}\n\nThis link expires in 1 hour and can be used once. If it wasn't you, ignore this email — your password hasn't changed.${sig}`,
  }),
  confirmReview: (name: string, business: string, link: string) => ({
    subject: `Confirm your review of ${business}`,
    text: `Hi ${name},\n\nThanks for sharing your experience with ${business}. Please confirm it's you so we can publish your review:\n\n${link}\n\nThe link expires in 72 hours. Your email address is never shown publicly.\n\nIf you didn't write this review, ignore this email and it won't be published.${sig}`,
  }),
  reviewStatus: (business: string, status: string, manageLink: string) => ({
    subject: `Your review of ${business}: ${status}`,
    text: `Your review of ${business} is now: ${status}.\n\nYou can see its status, withdraw it or ask us to reconsider a decision here:\n${manageLink}\n\nKeep this link private — anyone with it can manage your review.${sig}`,
  }),
  businessEmailCode: (business: string, link: string) => ({
    subject: `Verify that you manage ${business} on RateMe.ie`,
    text: `We received a request to verify ownership of ${business} on RateMe.ie using this business email address.\n\nIf you made the request, open this link while signed in:\n${link}\n\nIf you didn't request this, ignore this email — nothing will change.${sig}`,
  }),
  newReview: (business: string, rating: number, link: string) => ({
    subject: `New ${rating}-star review for ${business}`,
    text: `A new review has been published on ${business}'s RateMe.ie profile.\n\nRead and respond: ${link}${sig}`,
  }),
  paymentFailed: (business: string, link: string) => ({
    subject: `Payment problem with your RateMe.ie membership for ${business}`,
    text: `We couldn't take your renewal payment. Your card provider may have declined it.\n\nPlease update your payment details here: ${link}\n\nYour public profile and reviews stay visible regardless. Member tools stay available during a short grace period.${sig}`,
  }),
  verificationDecision: (business: string, approved: boolean, notes: string | null, link: string) => ({
    subject: approved ? `You're verified as the owner of ${business}` : `We couldn't verify ownership of ${business}`,
    text: approved
      ? `Good news — we've verified that you manage ${business} on RateMe.ie.\n\nNext step: ${link}${sig}`
      : `We weren't able to verify that you manage ${business}.${notes ? `\n\nReason: ${notes}` : ''}\n\nYou can try another verification method here: ${link}${sig}`,
  }),
  disputeDecision: (business: string, outcome: string, finding: string, link: string) => ({
    subject: `Outcome of your review dispute (${business})`,
    text: `We've reviewed your dispute.\n\nOutcome: ${outcome}\nFinding: ${finding}\n\nIf you have new information you can ask for reconsideration: ${link}${sig}`,
  }),
};
