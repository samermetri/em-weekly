-- Real PostgreSQL authorization checks. All fixtures are rolled back.
begin;
insert into auth.users(id,aud,role,email,email_confirmed_at,raw_user_meta_data,created_at,updated_at) values
 ('00000000-0000-4000-a000-000000000001','authenticated','authenticated','em-qa-a@example.invalid',now(),'{}',now(),now()),
 ('00000000-0000-4000-a000-000000000002','authenticated','authenticated','em-qa-b@example.invalid',now(),'{"role":"admin"}',now(),now());
set local role authenticated;
select set_config('request.jwt.claims','{"sub":"00000000-0000-4000-a000-000000000001","role":"authenticated"}',true);
insert into public.em_folders(id,name) values('00000000-0000-4000-b000-000000000001','Private A');
insert into public.em_bookmarks(article_id) values('preoxi');
insert into public.em_folder_items(folder_id,article_id) values('00000000-0000-4000-b000-000000000001','preoxi');
select set_config('request.jwt.claims','{"sub":"00000000-0000-4000-a000-000000000002","role":"authenticated"}',true);
do $$begin
 if exists(select 1 from public.em_folders) or exists(select 1 from public.em_bookmarks) or exists(select 1 from public.em_folder_items) then raise exception 'Cross-user read leaked';end if;
 if public.em_my_role()<>'reader' then raise exception 'User-editable metadata elevated privileges';end if;
 begin perform public.em_admin_articles();raise exception 'Reader accessed admin data';exception when insufficient_privilege then null;end;
 begin insert into public.em_bookmarks(article_id) values('not-a-published-article');raise exception 'Arbitrary bookmark accepted';exception when check_violation then null;end;
 begin insert into public.em_bookmarks(user_id,article_id) values('00000000-0000-4000-a000-000000000001','device');raise exception 'Cross-user insert allowed';exception when insufficient_privilege then null;end;
end $$;
insert into public.em_bookmarks(article_id) values('device');
do $$begin
 begin insert into public.em_folder_items(folder_id,article_id) values('00000000-0000-4000-b000-000000000001','device');raise exception 'Cross-user folder association allowed';exception when foreign_key_violation then null;end;
end $$;
reset role;
insert into em_weekly.admin_emails(email) values('em-qa-a@example.invalid');
update auth.users set email_confirmed_at=null where id='00000000-0000-4000-a000-000000000001';
do $$begin
 if exists(select 1 from em_weekly.admins where user_id='00000000-0000-4000-a000-000000000001') then raise exception 'Unconfirmed email received admin';end if;
end $$;
update auth.users set email_confirmed_at=now() where id='00000000-0000-4000-a000-000000000001';
set local role authenticated;
select set_config('request.jwt.claims','{"sub":"00000000-0000-4000-a000-000000000001","role":"authenticated"}',true);
do $$declare original jsonb; saved jsonb;begin
 if public.em_my_role()<>'admin' then raise exception 'Authorized admin rejected';end if;
 original:=public.em_admin_articles()->0->'body';original:=jsonb_set(original,'{id}','"qa-admin-rls"');
 saved:=public.em_admin_save_article(original,null,'Authorization fixture');
 if (saved->>'revision')::int<>1 then raise exception 'Insert revision wrong';end if;
 saved:=public.em_admin_save_article(original,1,'Revision fixture');
 if (saved->>'revision')::int<>2 then raise exception 'Update revision wrong';end if;
 begin perform public.em_admin_save_article(original,1,'Stale fixture');raise exception 'Stale update accepted';exception when serialization_failure then null;end;
 saved:=public.em_admin_save_article(jsonb_set(jsonb_set(original,'{excluded}','true'),'{status}','"held"'),2,'Withdraw fixture');
 if saved->'body'->>'status'<>'held' or saved->'body'->>'excluded'<>'true' then raise exception 'Withdrawal failed';end if;
end $$;
reset role;
set local role anon;
do $$begin
 begin perform count(*) from public.em_bookmarks;raise exception 'Anonymous library access allowed';exception when insufficient_privilege then null;end;
 begin perform public.em_admin_articles();raise exception 'Anonymous admin access allowed';exception when insufficient_privilege then null;end;
end $$;
reset role;
rollback;
