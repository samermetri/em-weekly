-- Private, bounded plain-text notes reuse saved-article storage and owner RLS.
alter table public.em_bookmarks
 add column note text not null default '' check (char_length(note)<=4000),
 add column note_revision integer not null default 0 check (note_revision>=0);

-- Note text is sent in the request body, never in URL filters. Revisions prevent
-- silently overwriting a note edited on another device. No privilege escalation.
create function public.em_save_article_note(article text, note_text text, expected_revision integer)
returns jsonb language plpgsql security invoker set search_path='' as $$
declare saved public.em_bookmarks; owner_id uuid:=auth.uid();
begin
 if owner_id is null then raise exception 'Sign in to save a note' using errcode='42501';end if;
 if note_text is null or char_length(note_text)>4000 then raise exception 'Notes must contain at most 4000 characters' using errcode='22023';end if;
 if expected_revision is null then
  insert into public.em_bookmarks(user_id,article_id,note,note_revision)
  values(owner_id,article,note_text,1) on conflict do nothing returning * into saved;
 else
  update public.em_bookmarks set note=note_text,note_revision=note_revision+1
  where user_id=owner_id and article_id=article and note_revision=expected_revision returning * into saved;
 end if;
 if saved.user_id is null then raise exception 'This saved article changed on another device. Refresh before saving your note.' using errcode='40001';end if;
 return jsonb_build_object('article_id',saved.article_id,'note',saved.note,'note_revision',saved.note_revision);
end $$;
revoke all on function public.em_save_article_note(text,text,integer) from public,anon;
grant execute on function public.em_save_article_note(text,text,integer) to authenticated;
