import 'server-only';
import { sql } from './db';
import type { DashBusiness } from './dashboard';

export const RANGES = { '7': 7, '30': 30, '90': 90, '365': 365 } as const;
export type RangeKey = keyof typeof RANGES;
export const parseRange = (v: string | undefined): RangeKey => (v && v in RANGES ? (v as RangeKey) : '30');

export type Funnel = {
  views: number; scans: number; starts: number; downloads: number;
  submitted: number; confirmed: number; published: number;
  prevViews: number; unanswered: number;
  series: { day: string; views: number; scans: number; starts: number }[];
};

/** Every number comes from recorded rows: daily counters (deduplicated per visitor/day) and the reviews table. */
export async function loadFunnel(businessId: string, days: number): Promise<Funnel> {
  const [agg] = await sql<Omit<Funnel, 'series' | 'unanswered' | 'submitted' | 'confirmed' | 'published'>[]>`
    with d as (select (now() at time zone 'Europe/Dublin')::date today)
    select
      coalesce(sum(profile_views) filter (where day > d.today - ${days}::int), 0)::int views,
      coalesce(sum(qr_scans) filter (where day > d.today - ${days}::int), 0)::int scans,
      coalesce(sum(review_starts) filter (where day > d.today - ${days}::int), 0)::int starts,
      coalesce(sum(kit_downloads) filter (where day > d.today - ${days}::int), 0)::int downloads,
      coalesce(sum(profile_views) filter (where day <= d.today - ${days}::int and day > d.today - ${days * 2}::int), 0)::int "prevViews"
    from business_daily_stats, d where business_id = ${businessId} and day > d.today - ${days * 2}::int`;
  const [rev] = await sql<{ submitted: number; confirmed: number; published: number; unanswered: number }[]>`
    select
      count(*) filter (where created_at > now() - make_interval(days => ${days}::int))::int submitted,
      count(*) filter (where confirmed_at > now() - make_interval(days => ${days}::int))::int confirmed,
      count(*) filter (where status = 'published' and published_at > now() - make_interval(days => ${days}::int))::int published,
      count(*) filter (where status = 'published' and not exists (
        select 1 from review_responses rr where rr.review_id = r.id and rr.status = 'published'))::int unanswered
    from reviews r where business_id = ${businessId}`;
  const series = await sql<{ day: string; views: number; scans: number; starts: number }[]>`
    select to_char(g.day, 'YYYY-MM-DD') "day", coalesce(s.profile_views, 0)::int views, coalesce(s.qr_scans, 0)::int scans, coalesce(s.review_starts, 0)::int starts
    from generate_series((now() at time zone 'Europe/Dublin')::date - ${Math.min(days, 90) - 1}::int, (now() at time zone 'Europe/Dublin')::date, interval '1 day') g(day)
    left join business_daily_stats s on s.business_id = ${businessId} and s.day = g.day::date order by g.day`;
  return { ...agg, ...rev, series };
}

export type CompletenessItem = { key: string; label: string; done: boolean };

/** Only fields the profile actually has. */
export function profileCompleteness(b: DashBusiness): { pct: number; items: CompletenessItem[] } {
  const items: CompletenessItem[] = [
    { key: 'description', label: 'Description of what you do', done: !!b.description && b.description.length >= 80 },
    { key: 'logo', label: 'Logo', done: !!b.logo_id },
    { key: 'phone', label: 'Phone number', done: !!b.phone },
    { key: 'contact', label: 'Website or public email', done: !!(b.website || b.public_email) },
    { key: 'area', label: 'Town or locality', done: !!b.locality_id },
    { key: 'eircode', label: 'Eircode (helps local search)', done: !!b.eircode },
    { key: 'socials', label: 'At least one social profile', done: Object.values(b.socials ?? {}).some(Boolean) },
  ];
  return { pct: Math.round((items.filter((i) => i.done).length / items.length) * 100), items };
}
