-- Private editorial store. The browser never connects to this schema.
create schema em_weekly;
revoke all on schema em_weekly from public, anon, authenticated;
create role em_weekly_builder nologin nosuperuser nocreatedb nocreaterole noinherit nobypassrls;
grant usage on schema em_weekly to em_weekly_builder;

create table em_weekly.documents (
 kind text not null check (kind in ('article','issue','audit','state','config','probe')),
 id text not null check (id ~ '^[a-z0-9][a-z0-9-]{0,120}$'),
 body jsonb not null check (jsonb_typeof(body) = 'object' and octet_length(body::text) <= 524288),
 revision bigint not null default 1,
 updated_at timestamptz not null default now(),
 primary key (kind,id),
 check (kind not in ('article','issue') or body->>'id' = id)
);
alter table em_weekly.documents enable row level security;
revoke all on em_weekly.documents from public,anon,authenticated;
grant select on em_weekly.documents to em_weekly_builder;
create policy builder_reads_export on em_weekly.documents for select to em_weekly_builder using (kind <> 'config');

create function em_weekly.bump_revision() returns trigger language plpgsql security invoker set search_path = '' as $$
begin
 new.revision := old.revision + 1;
 new.updated_at := now();
 return new;
end;
$$;
revoke all on function em_weekly.bump_revision() from public,anon,authenticated;
create trigger document_revision before update on em_weekly.documents for each row execute function em_weekly.bump_revision();

create table em_weekly.publication (
 id text primary key check (id = 'main'),
 checked_at timestamptz,
 attempted_at timestamptz,
 deployed_at timestamptz,
 status text not null default 'not-tested' check (status in ('not-tested','building','success','failed')),
 snapshot_hash text check (snapshot_hash is null or snapshot_hash ~ '^[a-f0-9]{64}$'),
 commit_sha text check (commit_sha is null or commit_sha ~ '^[a-f0-9]{40}$'),
 run_url text,
 deployment_url text,
 error text,
 document_revisions jsonb not null default '{}'::jsonb
);
insert into em_weekly.publication(id) values ('main');
alter table em_weekly.publication enable row level security;
revoke all on em_weekly.publication from public,anon,authenticated;
grant select,update on em_weekly.publication to em_weekly_builder;
create policy builder_reads_status on em_weekly.publication for select to em_weekly_builder using (id='main');
create policy builder_updates_status on em_weekly.publication for update to em_weekly_builder using (id='main') with check (id='main');
