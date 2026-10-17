import 'server-only';
import { sql } from './db';
import type { Tx } from './db';
import { randomToken, sha256 } from './util';

export type TokenPurpose = 'verify_email' | 'reset_password' | 'business_email' | 'review_confirm' | 'review_manage';

export async function createToken(purpose: TokenPurpose, opts: { userId?: string | null; refId?: string | null; ttlHours: number }, tx?: Tx) {
  const raw = randomToken(32);
  const q = tx ?? sql;
  await q`insert into email_tokens (token_hash, purpose, user_id, ref_id, expires_at)
          values (${sha256(raw)}, ${purpose}, ${opts.userId ?? null}, ${opts.refId ?? null}, now() + make_interval(hours => ${opts.ttlHours}))`;
  return raw;
}

/** Atomically consume a single-use token. Returns null if unknown, used or expired. */
export async function consumeToken(raw: string, purpose: TokenPurpose, tx?: Tx) {
  if (!raw || raw.length > 100) return null;
  const q = tx ?? sql;
  const [row] = await q<{ user_id: string | null; ref_id: string | null }[]>`
    update email_tokens set used_at = now()
    where token_hash = ${sha256(raw)} and purpose = ${purpose} and used_at is null and expires_at > now()
    returning user_id, ref_id`;
  return row ?? null;
}

/** Look up a reusable token (e.g. a reviewer's manage link) without consuming it. */
export async function peekToken(raw: string, purpose: TokenPurpose) {
  if (!raw || raw.length > 100) return null;
  const [row] = await sql<{ user_id: string | null; ref_id: string | null }[]>`
    select user_id, ref_id from email_tokens
    where token_hash = ${sha256(raw)} and purpose = ${purpose} and expires_at > now()`;
  return row ?? null;
}
