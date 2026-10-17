import 'server-only';
import { cache } from 'react';
import { cookies, headers } from 'next/headers';
import { redirect } from 'next/navigation';
import { sql } from './db';
import { env } from './env';
import { randomToken, sha256 } from './util';

export const SESSION_COOKIE = 'rm_session';
const SESSION_DAYS = 30;

export type User = {
  id: string;
  email: string;
  display_name: string;
  role: 'user' | 'moderator' | 'admin';
  status: string;
  email_verified_at: Date | null;
};

export async function createSession(userId: string) {
  const token = randomToken(32);
  const ua = (await headers()).get('user-agent')?.slice(0, 200) ?? null;
  await sql`insert into sessions (id, user_id, expires_at, user_agent)
            values (${sha256(token)}, ${userId}, now() + make_interval(days => ${SESSION_DAYS}), ${ua})`;
  (await cookies()).set(SESSION_COOKIE, token, {
    httpOnly: true,
    secure: env.appUrl.startsWith('https://'),
    sameSite: 'lax',
    path: '/',
    maxAge: SESSION_DAYS * 86400,
  });
}

export async function destroySession() {
  const jar = await cookies();
  const token = jar.get(SESSION_COOKIE)?.value;
  if (token) await sql`delete from sessions where id = ${sha256(token)}`;
  jar.delete(SESSION_COOKIE);
}

export async function destroyAllSessions(userId: string) {
  await sql`delete from sessions where user_id = ${userId}`;
}

export const currentUser = cache(async (): Promise<User | null> => {
  const token = (await cookies()).get(SESSION_COOKIE)?.value;
  if (!token || token.length > 100) return null;
  const [u] = await sql<User[]>`
    select u.id, u.email, u.display_name, u.role, u.status, u.email_verified_at
    from sessions s join users u on u.id = s.user_id
    where s.id = ${sha256(token)} and s.expires_at > now() and u.status = 'active'`;
  return u ?? null;
});

export async function requireUser(opts: { verified?: boolean; next?: string } = {}): Promise<User> {
  const u = await currentUser();
  if (!u) redirect(`/login${opts.next ? `?next=${encodeURIComponent(opts.next)}` : ''}`);
  if (opts.verified !== false && !u.email_verified_at) redirect('/verify-email');
  return u;
}

export async function requireStaff(min: 'moderator' | 'admin' = 'moderator'): Promise<User> {
  const u = await currentUser();
  if (!u) redirect('/login?next=/admin');
  const ok = min === 'admin' ? u.role === 'admin' : u.role === 'admin' || u.role === 'moderator';
  if (!ok) redirect('/dashboard?denied=1');
  return u;
}

export function isStaff(u: User | null): boolean {
  return !!u && (u.role === 'admin' || u.role === 'moderator');
}

/** Safe post-login redirect target: same-site relative paths only. */
export function safeNext(next: unknown, fallback = '/dashboard'): string {
  const s = typeof next === 'string' ? next : '';
  return s.startsWith('/') && !s.startsWith('//') && !s.startsWith('/\\') ? s : fallback;
}
