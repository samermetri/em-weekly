import type {Note} from './private-notes';
type Item={id:string;title:string};type Draft={saved?:Note;text:string};
const panel=document.querySelector<HTMLElement>('#notes-panel');
if(panel){
 const items=JSON.parse(panel.dataset.noteItems||'[]') as Item[];
 const launcher=document.querySelector<HTMLButtonElement>('#notes-launcher')!;
 const close=panel.querySelector<HTMLButtonElement>('.notes-close')!;
 const form=panel.querySelector<HTMLFormElement>('#side-note-form')!;
 const select=panel.querySelector<HTMLSelectElement>('#side-note-article')!;
 const input=panel.querySelector<HTMLTextAreaElement>('#side-note-text')!;
 const save=panel.querySelector<HTMLButtonElement>('#side-note-save')!;
 const status=panel.querySelector<HTMLElement>('#side-note-status')!;
 const signin=panel.querySelector<HTMLElement>('#notes-signin')!;
 const retry=panel.querySelector<HTMLButtonElement>('#side-note-retry')!;
 const drafts=new Map<string,Draft>();let active=items[0]?.id||'',uid='',generation=0,busy=false,saving=false,subscribed=false;
 const dirty=(d:Draft)=>d.text!==(d.saved?.note||'');
 function updateState(){
  const draft=drafts.get(active),unsaved=draft?dirty(draft):false;
  panel!.querySelector('#side-note-count')!.textContent=`${input.value.length.toLocaleString()} / 4,000`;
  panel!.querySelector('#side-note-state')!.textContent=unsaved?'Unsaved changes':draft?.saved?.note?'Saved':'No changes';
  save.disabled=busy||!draft||!unsaved;select.disabled=busy;close.disabled=busy;
  const badge=document.querySelector<HTMLElement>('#notes-draft-badge')!;badge.hidden=![...drafts.values()].some(dirty);
 }
 function hidePanel(focus=true){if(busy)return;panel!.hidden=true;document.body.classList.remove('notes-open');launcher.setAttribute('aria-expanded','false');if(focus)launcher.focus();}
 function resetAccount(){++generation;busy=false;uid='';drafts.clear();input.value='';status.textContent='';hidePanel(false);updateState();}
 async function showArticle(id:string,focus=true){
  const item=items.find(a=>a.id===id);if(!item||saving)return;const turn=++generation;retry.hidden=true;
  active=id;select.value=id;panel!.querySelector('#side-note-context')!.textContent=item.title;status.textContent='';
  const cached=drafts.get(id);
  if(cached){busy=false;input.value=cached.text;input.readOnly=false;updateState();if(focus)input.focus({preventScroll:true});return;}
  busy=true;input.readOnly=true;input.value='';status.textContent='Loading your note…';updateState();
  try{
   const {readNotes}=await import('./private-notes');const result=await readNotes([id]);if(turn!==generation)return;
   if(result.uid!==uid){resetAccount();return;}
   const saved=result.notes.get(id);drafts.set(id,{saved,text:saved?.note||''});input.value=saved?.note||'';status.textContent='';
  }catch(e){if(turn===generation){status.textContent=(e as Error).message;retry.hidden=false;}}
  finally{if(turn===generation){busy=false;input.readOnly=!drafts.has(id);updateState();if(focus&&drafts.has(id)){input.focus({preventScroll:true});input.setSelectionRange(0,0);input.scrollTop=0;}}}
 }
 function nearestArticle(){
  const candidates=[...document.querySelectorAll<HTMLElement>('[data-note-entry]')];
  const visible=candidates.find(el=>{const r=el.getBoundingClientRect();return r.bottom>140&&r.top<innerHeight*.7;});return visible?.dataset.noteEntry||active;
 }
 async function openPanel(id=nearestArticle()){
  if(saving)return;
  panel!.hidden=false;document.body.classList.add('notes-open');launcher.setAttribute('aria-expanded','true');
  launcher.querySelector('span')!.textContent='Notes';
  const api=await import('./account');const u=await api.user();
  signin.hidden=!!u;form.hidden=!u;
  if(!u){const link=panel!.querySelector<HTMLAnchorElement>('#notes-signin-link')!;link.href=api.base+'/account/?next='+encodeURIComponent(location.pathname+location.hash);link.focus();return;}
  if(uid&&uid!==u.id)drafts.clear();uid=u.id;
  if(!subscribed){subscribed=true;api.supabase.auth.onAuthStateChange((event,session)=>{if(event==='SIGNED_OUT'||(uid&&session?.user&&session.user.id!==uid))resetAccount();});}
  localStorage.setItem('em-weekly:last-user',uid);await showArticle(id);
 }
 launcher.addEventListener('click',()=>{if(panel!.hidden)void openPanel().catch(e=>{status.textContent=e.message;form.hidden=false;});else hidePanel();});
 retry.addEventListener('click',()=>void openPanel(active));
 close.addEventListener('click',()=>hidePanel());
 document.addEventListener('keydown',e=>{if(e.key==='Escape'&&!panel!.hidden&&!document.querySelector('dialog[open]'))hidePanel();});
 for(const button of document.querySelectorAll<HTMLButtonElement>('[data-open-note]'))button.addEventListener('click',()=>void openPanel(button.dataset.openNote).catch(e=>{status.textContent=e.message;}));
 select.addEventListener('change',()=>{const id=select.value;void showArticle(id);document.querySelector<HTMLElement>(`[data-note-entry="${id}"]`)?.scrollIntoView({block:'start',behavior:matchMedia('(prefers-reduced-motion: reduce)').matches?'instant':'smooth'});});
 input.addEventListener('input',()=>{const d=drafts.get(active);if(d){d.text=input.value;status.textContent='';updateState();}});
 form.addEventListener('submit',async e=>{
  e.preventDefault();const draft=drafts.get(active);if(busy||!draft||!dirty(draft))return;
  busy=true;saving=true;input.readOnly=true;status.textContent='Saving…';updateState();
  try{
   const {writeNote}=await import('./private-notes');const result=await writeNote(uid,active,draft.text,draft.saved?.note_revision??null);draft.saved=result;status.textContent='Note saved.';
   document.dispatchEvent(new CustomEvent('em-note-saved',{detail:result}));
  }catch(e){status.textContent=(e as Error).message;}
  finally{busy=false;saving=false;input.readOnly=false;updateState();}
 });
 window.addEventListener('beforeunload',e=>{if([...drafts.values()].some(dirty)){e.preventDefault();}});
}
