-- Red Teddy Tutor: allow middle school (11-14) and high school (14-18) profiles.
-- Additive only: every existing value stays valid, no rows change.
alter table public.rtt_profiles drop constraint if exists rtt_profiles_age_band_check;
alter table public.rtt_profiles add constraint rtt_profiles_age_band_check
  check (age_band in ('2-3', '3-5', '5-7', '7-9', '9-11', '11-14', '14-18'));
