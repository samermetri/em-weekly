-- Apply after accounts.sql. No GitHub credential belongs in source or browser code.
-- Configure Vault secret em_weekly_github_dispatch_token separately.
create extension if not exists http with schema extensions;

create table em_weekly.admin_dispatch (
 id text primary key check(id='main'),
 http_status integer,
 requested_at timestamptz not null default now(),
 state text not null check(state in ('queued','not_configured','failed'))
);
alter table em_weekly.admin_dispatch enable row level security;
revoke all on em_weekly.admin_dispatch from public,anon,authenticated,em_weekly_builder;

create function em_weekly.request_admin_publication(target_article text,target_revision bigint) returns jsonb
language plpgsql security definer set search_path='' as $$
declare dispatch_token text; response_status integer; dispatch_state text; dispatch_body jsonb;
begin
 if not em_weekly.is_admin() then
  raise exception 'Administrator access required' using errcode='42501';
 end if;
 -- Fixed destination, repository, workflow and branch; never accept them from a caller.
 select decrypted_secret into dispatch_token from vault.decrypted_secrets
 where name='em_weekly_github_dispatch_token';
 if nullif(btrim(dispatch_token),'') is null then
  dispatch_state:='not_configured';
 else
  begin
   dispatch_body:=jsonb_build_object('ref','main');
   if target_article is not null and target_revision is not null then
    dispatch_body:=dispatch_body||jsonb_build_object('inputs',jsonb_build_object(
     'admin_article',target_article,'admin_revision',target_revision::text));
   end if;
   perform set_config('http.curlopt_timeout_msec','5000',true);
   select status into response_status from extensions.http((
    'POST','https://api.github.com/repos/samermetri/em-weekly/actions/workflows/publish.yml/dispatches',
    array[extensions.http_header('Accept','application/vnd.github+json'),
     extensions.http_header('User-Agent','EM-Weekly-Admin'),
     extensions.http_header('X-GitHub-Api-Version','2022-11-28'),
     extensions.http_header('Authorization','Bearer '||dispatch_token)],
    'application/json',dispatch_body::text
   )::extensions.http_request);
   dispatch_state:=case when response_status between 200 and 299 then 'queued' else 'failed' end;
  exception when others then
   -- A dispatch failure must not undo a valid article edit or leak a credential.
   dispatch_state:='failed';
  end;
 end if;
 insert into em_weekly.admin_dispatch(id,http_status,requested_at,state)
 values('main',response_status,now(),dispatch_state)
 on conflict(id) do update set http_status=excluded.http_status,
  requested_at=excluded.requested_at,state=excluded.state;
 return jsonb_build_object('status',dispatch_state,'requestedAt',now(),'httpStatus',response_status);
end $$;
revoke all on function em_weekly.request_admin_publication(text,bigint) from public,anon,authenticated;

create function em_weekly.publish_admin_edit() returns trigger
language plpgsql security definer set search_path='' as $$
begin
 perform em_weekly.request_admin_publication(new.article_id,(select revision from em_weekly.documents where kind='article' and id=new.article_id));
 return new;
end $$;
revoke all on function em_weekly.publish_admin_edit() from public,anon,authenticated;
-- Only the admin-save history path triggers publication. Routine document writes do not.
create trigger em_publish_admin_edit after insert on em_weekly.article_history
for each row execute function em_weekly.publish_admin_edit();

create function public.em_admin_request_publication() returns jsonb
language sql security definer set search_path='' as $$
 select em_weekly.request_admin_publication(null,null)
$$;
revoke all on function public.em_admin_request_publication() from public,anon;
grant execute on function public.em_admin_request_publication() to authenticated;

create or replace function em_weekly.admin_publication() returns jsonb
language plpgsql security definer set search_path='' as $$
declare dispatch jsonb;
begin
 if not em_weekly.is_admin() then
  raise exception 'Administrator access required' using errcode='42501';
 end if;
 select jsonb_build_object('requestedAt',requested_at,'status',state,'httpStatus',http_status) into dispatch
 from em_weekly.admin_dispatch where id='main';
 return (select to_jsonb(p)||jsonb_build_object('adminDispatch',dispatch)
  from em_weekly.publication p where id='main');
end $$;
revoke all on function em_weekly.admin_publication() from public,anon;
grant execute on function em_weekly.admin_publication() to authenticated;
