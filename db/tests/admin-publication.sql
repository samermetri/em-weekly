-- Run as the project migration owner. All simulated article/history writes roll back. Run before configuring the credential.
do $test$
declare verified_admin uuid; article_body jsonb; prior_revision bigint;
 saved jsonb; prior_history bigint;
begin
 if has_table_privilege('authenticated','em_weekly.admin_dispatch','select')
 or has_table_privilege('anon','vault.decrypted_secrets','select')
 or has_table_privilege('em_weekly_builder','vault.decrypted_secrets','select')
 or has_function_privilege('anon','public.em_admin_request_publication()','execute')
 or has_function_privilege('authenticated','em_weekly.request_admin_publication(text,bigint)','execute') then
  raise exception 'Publication dispatch permissions are too broad';
 end if;
 perform set_config('request.jwt.claims','{"sub":"00000000-0000-4000-8000-000000000001","role":"authenticated"}',true);
 begin
  perform public.em_admin_request_publication();
  raise exception 'Reader was allowed to dispatch publication';
 exception when insufficient_privilege then null;
 end;
 select a.user_id into verified_admin from em_weekly.admins a
 join auth.users u on u.id=a.user_id
 where u.email='samermetri@gmail.com' and u.email_confirmed_at is not null;
 if verified_admin is null then raise exception 'Verified owner admin is required';end if;
 perform set_config('request.jwt.claims',jsonb_build_object('sub',verified_admin,'role','authenticated')::text,true);
 select body,revision into article_body,prior_revision from em_weekly.documents
 where kind='article' and id='preoxi';
 select count(*) into prior_history from em_weekly.article_history;
 if exists(select 1 from vault.secrets where name='em_weekly_github_dispatch_token') then raise exception 'Run transactional tests before credential configuration';end if;
 begin
  saved:=public.em_admin_save_article(article_body,prior_revision,'Transactional publication-hook verification; rolled back.');
  if (saved->>'revision')::bigint<>prior_revision+1 then raise exception 'Save revision mismatch';end if;
  if (public.em_admin_publication()->'adminDispatch'->>'status') not in ('queued','not_configured') then
   raise exception 'Admin save did not request publication or retain the scheduled fallback';
  end if;
  begin
   perform public.em_admin_save_article(article_body,prior_revision,'Stale edit must be rejected.');
   raise exception 'Stale edit was accepted';
  exception when serialization_failure then null;
  end;
  raise exception using errcode='P2999',message='Roll back simulated save';
 exception when sqlstate 'P2999' then null;
 end;
 if (select revision from em_weekly.documents where kind='article' and id='preoxi')<>prior_revision
 or (select count(*) from em_weekly.article_history)<>prior_history
 then
  raise exception 'Transactional test left persisted changes';
 end if;
end $test$;
select 'passed: admin save hook, stale revision rejection, reader denial, credential privacy, and rollback' as verification;
