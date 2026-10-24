-- Listings imported from Find It in Ireland (OpenStreetMap-derived). Kept apart from owner and
-- community listings so they can be attributed (ODbL), refreshed and removed as one set.
set search_path = rateme, extensions, public;

alter table businesses drop constraint businesses_source_check;
alter table businesses add constraint businesses_source_check check (source in ('owner','community','admin','import'));
alter table businesses add column external_id text;
create unique index businesses_external_id on businesses(external_id) where external_id is not null;
