-- Private, bounded cache of public PubMed metadata for the hosted research task.
-- Apply once after schema.sql. No browser, reader-account, or editorial grants.
create table em_weekly.research_index (
 window_start date primary key,
 body jsonb not null,
 updated_at timestamptz not null default now(),
 check (window_start between date '2024-10-27' and date '2026-10-26'
        and (window_start - date '2024-10-27') % 7 = 0),
 check (jsonb_typeof(body) = 'object' and octet_length(body::text) <= 524288
        and jsonb_typeof(body->'start') = 'string' and body->>'start' = window_start::text
        and body @> '{"version":1,"method":"PubMed electronic-date discovery; primary first-online verification required"}'::jsonb
        and jsonb_typeof(body->'candidates') = 'array'
        and jsonb_array_length(body->'candidates') <= 10000
        and jsonb_typeof(body->'sources') = 'array' and jsonb_array_length(body->'sources') = 4)
);
alter table em_weekly.research_index enable row level security;
revoke all on em_weekly.research_index from public,anon,authenticated;
grant select,insert on em_weekly.research_index to em_weekly_builder;
grant update(body,updated_at) on em_weekly.research_index to em_weekly_builder;
create policy builder_reads_research_metadata on em_weekly.research_index for select to em_weekly_builder using (true);
create policy builder_inserts_research_metadata on em_weekly.research_index for insert to em_weekly_builder with check (true);
create policy builder_updates_research_metadata on em_weekly.research_index for update to em_weekly_builder using (true) with check (true);
comment on table em_weekly.research_index is 'Unreviewed public PubMed discovery metadata, at most 105 windows. No clinical summaries or private user data. Not exposed through the public Data API.';
