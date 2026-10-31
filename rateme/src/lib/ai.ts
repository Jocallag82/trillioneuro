import 'server-only';
import Anthropic from '@anthropic-ai/sdk';
import { sql } from './db';

// Claude Haiku 5.5: $0.10 / 1M input tokens, $0.50 / 1M output tokens (first-party API, prompts ≤100K).
export const DRAFT_MODEL = 'claude-haiku-5-5';
const PRICE = { inMicroPerToken: 0.1, outMicroPerToken: 0.5 }; // micro-USD per token
export const TONES = { professional: 'Professional', friendly: 'Friendly', empathetic: 'Empathetic', concise: 'Concise' } as const;
export type Tone = keyof typeof TONES;

export type AiSettings = { reply_drafts_enabled: boolean; drafts_per_business_per_month: number; monthly_budget_usd: number };
export async function aiSettings(): Promise<AiSettings> {
  const [s] = await sql<{ value: Partial<AiSettings> }[]>`select value from settings where key = 'ai'`;
  return { reply_drafts_enabled: !!s?.value?.reply_drafts_enabled, drafts_per_business_per_month: Number(s?.value?.drafts_per_business_per_month ?? 40),
    monthly_budget_usd: Number(s?.value?.monthly_budget_usd ?? 10) };
}
export const aiConfigured = () => !!process.env.ANTHROPIC_API_KEY;

/** Removes contact details so they are never sent to the model provider. */
export function redactForModel(t: string) {
  return t.replace(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi, '[email removed]')
    .replace(/(\+?\d[\d\s().-]{7,}\d)/g, '[number removed]')
    .replace(/\b[A-Z]\d{2}\s?[A-Z0-9]{4}\b/gi, '[eircode removed]');
}

const SYSTEM = `You draft public replies from an Irish small business to a customer review on RateMe.ie.
Rules:
- Use only facts in the review. Never invent events, dates, prices, staff names, policies or offers.
- Never include personal information, contact details of the customer, or details of their job beyond what the review says.
- Do not admit legal liability, do not threaten, and do not ask the customer to change or remove the review.
- Never offer anything in exchange for a review or a changed rating.
- For negative or mixed reviews: thank them, acknowledge the specific concern calmly, say the business takes it seriously, and invite them to get in touch directly using the placeholder [contact details].
- For positive reviews: thank them warmly and specifically.
- Irish/UK English spelling. Plain text, no greeting line with the reviewer's name, no sign-off name (use [your name] if needed). Under 120 words.
Return only the reply text.`;

export type DraftResult = { ok: true; text: string } | { ok: false; error: string };

export async function draftReply(opts: { businessId: string; userId: string; reviewId: string; businessName: string; rating: number;
  title: string | null; body: string | null; tone: Tone }): Promise<DraftResult> {
  const s = await aiSettings();
  if (!s.reply_drafts_enabled || !aiConfigured()) return { ok: false, error: 'Reply drafts are not switched on yet.' };
  const [use] = await sql<{ biz: number; spend: number }[]>`
    select count(*) filter (where business_id = ${opts.businessId} and ok)::int biz, coalesce(sum(cost_micro_usd), 0)::int spend
    from ai_usage where created_at > date_trunc('month', now())`;
  if (use.biz >= s.drafts_per_business_per_month) return { ok: false, error: `You’ve used this month’s ${s.drafts_per_business_per_month} drafts. You can still write a reply yourself.` };
  if (use.spend >= s.monthly_budget_usd * 1_000_000) return { ok: false, error: 'Drafting is paused for the rest of the month. You can still write a reply yourself.' };

  const review = redactForModel([opts.title, opts.body].filter(Boolean).join('\n\n') || '(no written comment, rating only)').slice(0, 4000);
  const client = new Anthropic({ maxRetries: 1, timeout: 20_000 });
  try {
    const res = await client.messages.create({
      model: DRAFT_MODEL, max_tokens: 2000, system: SYSTEM,
      output_config: { effort: 'low' },
      messages: [{ role: 'user', content: `Business: ${opts.businessName}\nStar rating: ${opts.rating} out of 5\nTone: ${TONES[opts.tone]}\n\nReview:\n"""\n${review}\n"""` }],
    });
    const inT = res.usage.input_tokens, outT = res.usage.output_tokens;
    const cost = Math.ceil(inT * PRICE.inMicroPerToken + outT * PRICE.outMicroPerToken);
    const text = res.stop_reason === 'refusal' ? '' : res.content.flatMap((b) => (b.type === 'text' ? [b.text] : [])).join('').trim();
    await sql`insert into ai_usage (feature, business_id, user_id, review_id, model, input_tokens, output_tokens, cost_micro_usd, ok, error)
              values ('reply_draft', ${opts.businessId}, ${opts.userId}, ${opts.reviewId}, ${DRAFT_MODEL}, ${inT}, ${outT}, ${cost}, ${!!text}, ${text ? null : `stop:${res.stop_reason}`})`;
    if (!text) return { ok: false, error: 'No draft could be written for this review. Please write your reply yourself.' };
    return { ok: true, text: text.slice(0, 2000) };
  } catch (e) {
    const msg = e instanceof Anthropic.RateLimitError ? 'rate_limited' : e instanceof Anthropic.APIError ? `api_${e.status}` : 'network';
    await sql`insert into ai_usage (feature, business_id, user_id, review_id, model, ok, error) values ('reply_draft', ${opts.businessId}, ${opts.userId}, ${opts.reviewId}, ${DRAFT_MODEL}, false, ${msg})`;
    console.error('reply draft failed', msg);
    return { ok: false, error: 'The drafting service didn’t respond. Try again in a minute, or write your reply yourself.' };
  }
}
