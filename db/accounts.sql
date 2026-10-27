-- Reader accounts and private saved articles. Editorial JSON remains private.
create table em_weekly.admin_emails(email text primary key check(email=lower(email)));
alter table em_weekly.admin_emails enable row level security;
revoke all on em_weekly.admin_emails from public,anon,authenticated;
create table em_weekly.admins(user_id uuid primary key references auth.users(id) on delete cascade);
alter table em_weekly.admins enable row level security;
revoke all on em_weekly.admins from public,anon,authenticated;

create function em_weekly.assign_verified_admin() returns trigger language plpgsql security definer set search_path='' as $$
begin
 if new.email_confirmed_at is not null and exists(select 1 from em_weekly.admin_emails a where a.email=lower(new.email)) then
  insert into em_weekly.admins(user_id) values(new.id) on conflict do nothing;
 end if;
 return new;
end $$;
revoke all on function em_weekly.assign_verified_admin() from public,anon,authenticated;
create trigger em_verified_admin after insert or update of email_confirmed_at,email on auth.users for each row execute function em_weekly.assign_verified_admin();

create function em_weekly.is_admin() returns boolean language sql stable security definer set search_path='' as $$
 select auth.uid() is not null and exists(select 1 from em_weekly.admins a join auth.users u on u.id=a.user_id where a.user_id=auth.uid() and u.email_confirmed_at is not null)
$$;
revoke all on function em_weekly.is_admin() from public,anon;
grant usage on schema em_weekly to authenticated;
grant execute on function em_weekly.is_admin() to authenticated;
create function public.em_my_role() returns text language sql stable security invoker set search_path='' as $$
 select case when em_weekly.is_admin() then 'admin' else 'reader' end
$$;
revoke all on function public.em_my_role() from public,anon;
grant execute on function public.em_my_role() to authenticated;

create table public.em_folders(
 id uuid primary key default gen_random_uuid(),
 user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
 name text not null check(length(btrim(name)) between 1 and 60),
 created_at timestamptz not null default now(),
 unique(user_id,name), unique(id,user_id)
);
create table public.em_bookmarks(
 user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
 article_id text not null check(article_id ~ '^[a-z0-9]+(-[a-z0-9]+)*$' and length(article_id)<=121),
 created_at timestamptz not null default now(),
 primary key(user_id,article_id)
);
create table public.em_folder_items(
 user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
 folder_id uuid not null,
 article_id text not null,
 primary key(user_id,folder_id,article_id),
 foreign key(folder_id,user_id) references public.em_folders(id,user_id) on delete cascade,
 foreign key(user_id,article_id) references public.em_bookmarks(user_id,article_id) on delete cascade
);
create index em_folder_items_bookmark on public.em_folder_items(user_id,article_id);
alter table public.em_folders enable row level security;
alter table public.em_bookmarks enable row level security;
alter table public.em_folder_items enable row level security;
revoke all on public.em_folders,public.em_bookmarks,public.em_folder_items from public,anon;
grant select,insert,update,delete on public.em_folders,public.em_bookmarks,public.em_folder_items to authenticated;
create policy own_folders on public.em_folders for all to authenticated using((select auth.uid())=user_id) with check((select auth.uid())=user_id);
create policy own_bookmarks on public.em_bookmarks for all to authenticated using((select auth.uid())=user_id) with check((select auth.uid())=user_id);
create policy own_folder_items on public.em_folder_items for all to authenticated using((select auth.uid())=user_id) with check((select auth.uid())=user_id);

create table em_weekly.article_history(
 id bigint generated always as identity primary key,
 article_id text not null,
 previous_body jsonb,
 written_body jsonb not null,
 actor uuid not null,
 reason text not null,
 at timestamptz not null default now()
);
alter table em_weekly.article_history enable row level security;
revoke all on em_weekly.article_history from public,anon,authenticated;

create function em_weekly.admin_list() returns jsonb language plpgsql security definer set search_path='' as $$
begin
 if not em_weekly.is_admin() then raise exception 'Administrator access required' using errcode='42501';end if;
 return coalesce((select jsonb_agg(jsonb_build_object('id',id,'body',body,'revision',revision,'updated_at',updated_at) order by updated_at desc) from em_weekly.documents where kind='article'),'[]'::jsonb);
end $$;
revoke all on function em_weekly.admin_list() from public,anon;
grant execute on function em_weekly.admin_list() to authenticated;
create function public.em_admin_articles() returns jsonb language sql security invoker set search_path='' as $$ select em_weekly.admin_list() $$;
revoke all on function public.em_admin_articles() from public,anon;
grant execute on function public.em_admin_articles() to authenticated;

create function em_weekly.admin_save(article jsonb,expected_revision bigint,reason text) returns jsonb language plpgsql security definer set search_path='' as $$
declare old_body jsonb; result_body jsonb; result_revision bigint; article_id text; day text;
begin
 if not em_weekly.is_admin() then raise exception 'Administrator access required' using errcode='42501';end if;
 article_id:=article->>'id';day:=to_char(now() at time zone 'America/Los_Angeles','YYYY-MM-DD');
 if article_id is null or article_id !~ '^[a-z0-9]+(-[a-z0-9]+)*$' or length(article_id)>121 or jsonb_typeof(article)<>'object' or octet_length(article::text)>524288 then raise exception 'Invalid article identity or size';end if;
 if coalesce(length(btrim(reason)),0) not between 1 and 500 then raise exception 'A dated edit reason is required';end if;
 if article->>'status' not in ('published','held') or article->>'humanReview' not in ('Not yet human-reviewed','Human-reviewed') or jsonb_typeof(article->'corrections')<>'array' then raise exception 'Invalid publication or review status';end if;
 select body into old_body from em_weekly.documents where kind='article' and id=article_id for update;
 if expected_revision is null then
  if old_body is not null then raise exception 'Article already exists; reload before editing' using errcode='40001';end if;
  result_body:=article;
  insert into em_weekly.documents(kind,id,body) values('article',article_id,result_body) returning revision into result_revision;
 else
  if old_body is null or not exists(select 1 from em_weekly.documents where kind='article' and id=article_id and revision=expected_revision) then raise exception 'Article changed; reload before saving' using errcode='40001';end if;
  result_body:=jsonb_set(article,'{corrections}',coalesce(old_body->'corrections','[]'::jsonb)||jsonb_build_array(jsonb_build_object('date',day,'description',reason)));
  update em_weekly.documents set body=result_body where kind='article' and id=article_id and revision=expected_revision returning revision into result_revision;
 end if;
 insert into em_weekly.article_history(article_id,previous_body,written_body,actor,reason) values(article_id,old_body,result_body,auth.uid(),reason);
 return jsonb_build_object('id',article_id,'body',result_body,'revision',result_revision);
end $$;
revoke all on function em_weekly.admin_save(jsonb,bigint,text) from public,anon;
grant execute on function em_weekly.admin_save(jsonb,bigint,text) to authenticated;
create function public.em_admin_save_article(article jsonb,expected_revision bigint,reason text) returns jsonb language sql security invoker set search_path='' as $$ select em_weekly.admin_save(article,expected_revision,reason) $$;
revoke all on function public.em_admin_save_article(jsonb,bigint,text) from public,anon;
grant execute on function public.em_admin_save_article(jsonb,bigint,text) to authenticated;

create function em_weekly.admin_publication() returns jsonb language plpgsql security definer set search_path='' as $$
begin
 if not em_weekly.is_admin() then raise exception 'Administrator access required' using errcode='42501';end if;
 return (select to_jsonb(p) from em_weekly.publication p where id='main');
end $$;
revoke all on function em_weekly.admin_publication() from public,anon;
grant execute on function em_weekly.admin_publication() to authenticated;
create function public.em_admin_publication() returns jsonb language sql security invoker set search_path='' as $$ select em_weekly.admin_publication() $$;
revoke all on function public.em_admin_publication() from public,anon;
grant execute on function public.em_admin_publication() to authenticated;
