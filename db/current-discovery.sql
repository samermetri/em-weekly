-- Four replaceable rows of public PubMed metadata. No editorial or user-data access.
create table em_weekly.current_discovery (
 source_id text primary key check (source_id in ('pubmed-em','pubmed-general','pubmed-specialty','pubmed-guidance')),
 body jsonb not null,
 updated_at timestamptz not null default now(),
 check (jsonb_typeof(body)='object' and octet_length(body::text)<=2097152
   and body ?& array['version','method','sourceId','query','start','end','retrievedAt','count','candidates','requests']
   and body @> '{"version":1,"method":"PubMed entry-date discovery; primary first-online verification required"}'::jsonb
   and body->>'sourceId'=source_id and jsonb_typeof(body->'query')='string'
   and jsonb_typeof(body->'start')='string' and jsonb_typeof(body->'end')='string'
   and jsonb_typeof(body->'retrievedAt')='string'
   and (body->>'end')::date >= (body->>'start')::date
   and jsonb_typeof(body->'candidates')='array' and jsonb_array_length(body->'candidates')<=10000
   and jsonb_typeof(body->'count')='number' and (body->>'count')::integer=jsonb_array_length(body->'candidates')
   and jsonb_typeof(body->'requests')='array' and jsonb_array_length(body->'requests')>0)
);
alter table em_weekly.current_discovery enable row level security;
revoke all on em_weekly.current_discovery from public,anon,authenticated;
grant select,insert on em_weekly.current_discovery to em_weekly_builder;
grant update(body,updated_at) on em_weekly.current_discovery to em_weekly_builder;
create policy builder_reads_current_metadata on em_weekly.current_discovery for select to em_weekly_builder using (true);
create policy builder_inserts_current_metadata on em_weekly.current_discovery for insert to em_weekly_builder with check (true);
create policy builder_updates_current_metadata on em_weekly.current_discovery for update to em_weekly_builder using (true) with check (true);
comment on table em_weekly.current_discovery is 'Four bounded replaceable public metadata rows for daily/weekly discovery; no abstracts, summaries, accounts or private notes. Not exposed via public Data API.';
