-- Owner-run, rollback-only verification. Uses one existing user's ID but never
-- reads or modifies their real bookmarks/notes; a new bookmark is rolled back.
do $test$
declare owner_id uuid; outsider uuid:=gen_random_uuid(); fixture text; result jsonb; affected integer;
begin
 select id into owner_id from auth.users limit 1;
 if owner_id is null then raise exception 'A user is required for rollback-only RLS tests';end if;
 select d.id into fixture from em_weekly.documents d where d.kind='article' and d.body->>'status'='published' and coalesce((d.body->>'excluded')::boolean,false)=false and not exists(select 1 from public.em_bookmarks b where b.user_id=owner_id and b.article_id=d.id) limit 1;
 if fixture is null then raise exception 'An unbookmarked published article is required';end if;
 if has_function_privilege('anon','public.em_save_article_note(text,text,integer)','execute')
 or has_table_privilege('em_weekly_builder','public.em_bookmarks','select') then raise exception 'Private note permissions are too broad';end if;
 begin
  perform set_config('request.jwt.claims',jsonb_build_object('sub',owner_id,'role','authenticated')::text,true);
  execute 'set local role authenticated';
  result:=public.em_save_article_note(fixture,'Initial note',null);
  if result->>'note_revision'<>'1' then raise exception 'Note did not create a saved article';end if;
  result:=public.em_save_article_note(fixture,'Rollback-only note',1);
  if result->>'note'<>'Rollback-only note' or result->>'note_revision'<>'2' then raise exception 'Owner note save failed';end if;
  begin perform public.em_save_article_note(fixture,'Stale write',1);raise exception 'Stale note was overwritten';exception when serialization_failure then null;end;
  begin perform public.em_save_article_note(fixture,repeat('x',4001),2);raise exception 'Oversized note accepted';exception when invalid_parameter_value then null;end;
  perform set_config('request.jwt.claims',jsonb_build_object('sub',outsider,'role','authenticated')::text,true);
  if exists(select 1 from public.em_bookmarks where article_id=fixture) then raise exception 'Other user could read private note';end if;
  update public.em_bookmarks set note='Unauthorized' where article_id=fixture;
  get diagnostics affected=row_count;
  if affected<>0 then raise exception 'Other user could update private note';end if;
  begin perform public.em_save_article_note(fixture,'Unauthorized',2);raise exception 'Other user could edit note through RPC';exception when serialization_failure then null;end;
  begin insert into public.em_bookmarks(user_id,article_id,note) values(owner_id,fixture,'Unauthorized');raise exception 'Owner spoof accepted';exception when insufficient_privilege then null;end;
  execute 'reset role';
  raise exception using errcode='P2999',message='Roll back all QA writes';
 exception when sqlstate 'P2999' then null;
 end;
 if exists(select 1 from public.em_bookmarks where article_id=fixture) then raise exception 'QA note persisted';end if;
end $test$;
select 'passed: owner save, stale-write rejection, note limit, cross-user read/write denial, anonymous denial, builder isolation, rollback' as verification;
