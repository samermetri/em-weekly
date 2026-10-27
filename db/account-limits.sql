-- Bound private reader storage on the Free plan. Apply after accounts.sql.
create function em_weekly.limit_reader_storage() returns trigger language plpgsql security definer set search_path='' as $$
declare total bigint; maximum bigint;
begin
 perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(new.user_id::text,0));
 if tg_table_name='em_bookmarks' then
  if not exists(select 1 from em_weekly.documents where kind='article' and id=new.article_id and body->>'status'='published' and coalesce((body->>'excluded')::boolean,false)=false) then
   raise exception 'Only published articles can be saved' using errcode='23514';
  end if;
  select count(*) into total from public.em_bookmarks where user_id=new.user_id;maximum:=5000;
  if exists(select 1 from public.em_bookmarks where user_id=new.user_id and article_id=new.article_id) then return new;end if;
 elsif tg_table_name='em_folders' then
  select count(*) into total from public.em_folders where user_id=new.user_id;maximum:=100;
 else
  select count(*) into total from public.em_folder_items where user_id=new.user_id;maximum:=10000;
  if exists(select 1 from public.em_folder_items where user_id=new.user_id and folder_id=new.folder_id and article_id=new.article_id) then return new;end if;
 end if;
 if tg_op='INSERT' and total>=maximum then raise exception 'Your library storage limit has been reached' using errcode='23514';end if;
 return new;
end $$;
revoke all on function em_weekly.limit_reader_storage() from public,anon,authenticated;
create trigger em_bookmark_storage before insert or update on public.em_bookmarks for each row execute function em_weekly.limit_reader_storage();
create trigger em_folder_storage before insert on public.em_folders for each row execute function em_weekly.limit_reader_storage();
create trigger em_membership_storage before insert on public.em_folder_items for each row execute function em_weekly.limit_reader_storage();
