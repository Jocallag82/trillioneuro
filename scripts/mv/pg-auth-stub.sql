-- Minimal auth.users (+ a stand-in for another product's table) so the mv_* migration can run on plain Postgres.
create table if not exists auth.users (
  id uuid primary key default gen_random_uuid(),
  email text unique,
  raw_user_meta_data jsonb,
  email_confirmed_at timestamptz,
  created_at timestamptz default now()
);
create table if not exists public.rtt_profiles (parent_id uuid references auth.users(id) on delete cascade);
