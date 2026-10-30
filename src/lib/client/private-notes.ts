import {supabase,user,check,cacheLibrary,type Library} from './account';
export type Note={article_id:string;note:string;note_revision:number};
export const noteLimit=4000;
const memory=new Map<string,{at:number;notes:Map<string,Note|null>}>();
window.addEventListener('storage',event=>{if(event.key?.startsWith('em-weekly:library:'))memory.delete(event.key.slice('em-weekly:library:'.length));});
document.addEventListener('em-note-removed',e=>{const id=(e as CustomEvent<string>).detail;for(const cached of memory.values())cached.notes.delete(id);});
export async function readNotes(ids:string[],refresh=false):Promise<{uid:string;notes:Map<string,Note>}> {
 const u=await user();if(!u)throw Error('Sign in to include your private notes.');
 const notes=new Map<string,Note>();let cached:Library|undefined;
 const recent=memory.get(u.id);if(!refresh&&recent&&Date.now()-recent.at<300000&&ids.every(id=>recent.notes.has(id))){for(const id of ids){const note=recent.notes.get(id);if(note)notes.set(id,note);}return {uid:u.id,notes};}
 try{const item=JSON.parse(localStorage.getItem('em-weekly:library:'+u.id)||'null');if(!refresh&&item?.version===2&&Date.now()-item.at<300000)cached=item.data;}catch{}
 if(cached){for(const b of cached.bookmarks)if(ids.includes(b.article_id))notes.set(b.article_id,{article_id:b.article_id,note:b.note||'',note_revision:b.note_revision||0});}
 else if(ids.length){
  // A short indexed owner/article lookup, only after an explicit notes action.
  for(let i=0;i<ids.length;i+=100){const rows=check(await supabase.from('em_bookmarks').select('article_id,note,note_revision').eq('user_id',u.id).in('article_id',ids.slice(i,i+100)))||[];for(const row of rows)notes.set(row.article_id,row);}
 }
 const values=recent&&Date.now()-recent.at<300000?recent.notes:new Map<string,Note|null>();for(const id of ids)values.set(id,notes.get(id)||null);memory.set(u.id,{at:Date.now(),notes:values});
 return {uid:u.id,notes};
}
export async function writeNote(uid:string,id:string,text:string,revision:number|null):Promise<Note>{
 if(text.length>noteLimit)throw Error('Use at most 4,000 characters.');
 const result=check(await supabase.rpc('em_save_article_note',{article:id,note_text:text,expected_revision:revision})) as Note;
 const previous=memory.get(uid);const values=previous&&Date.now()-previous.at<300000?previous.notes:new Map<string,Note|null>();values.set(id,result);memory.set(uid,{at:Date.now(),notes:values});
 try{
  const key='em-weekly:library:'+uid,cached=JSON.parse(localStorage.getItem(key)||'null');
  if(cached?.version===2){const bookmark=cached.data.bookmarks.find((b:{article_id:string})=>b.article_id===id);if(bookmark)Object.assign(bookmark,result);else cached.data.bookmarks.unshift({user_id:uid,created_at:new Date().toISOString(),...result});cacheLibrary(uid,cached.data);}
 }catch{}
 return result;
}
export function noteSection(text:string){
 const section=document.createElement('section');section.className='personal-note-print';
 const heading=document.createElement('h4');heading.textContent='My notes';const copy=document.createElement('p');copy.textContent=text;section.append(heading,copy);return section;
}
export async function editNote(options:{uid:string;id:string;title:string;current?:Note}):Promise<Note|undefined>{
 const {uid,id,title,current}=options;
 return new Promise(resolve=>{
  const dialog=document.createElement('dialog');dialog.className='reader-dialog note-dialog';dialog.setAttribute('aria-labelledby','note-dialog-title');
  const form=document.createElement('form'),heading=document.createElement('h2');heading.id='note-dialog-title';heading.textContent='Your note';
  const article=document.createElement('p');article.className='note-article-title';article.textContent=title;
  const label=document.createElement('label');label.textContent='Private note';label.htmlFor='article-note';
  const input=document.createElement('textarea');input.id='article-note';input.maxLength=noteLimit;input.rows=8;input.placeholder='Your takeaways, questions, or reminders…';input.value=current?.note||'';
  const hint=document.createElement('p');hint.className='note-hint';hint.textContent='Only you can see this. Notes are printed only when you choose to include them.';
  const count=document.createElement('span');count.className='note-count';const updateCount=()=>count.textContent=`${input.value.length.toLocaleString()} / 4,000`;input.addEventListener('input',updateCount);updateCount();
  const error=document.createElement('p');error.className='form-error';error.setAttribute('role','alert');error.hidden=true;
  const actions=document.createElement('div');actions.className='reader-row';const cancel=document.createElement('button');cancel.type='button';cancel.className='btn';cancel.textContent='Cancel';
  const submit=document.createElement('button');submit.className='btn primary';submit.type='submit';submit.textContent='Save note';actions.append(cancel,submit);
  const discard=document.createElement('div');discard.className='note-discard';discard.hidden=true;const question=document.createElement('p');question.textContent='Discard your unsaved changes?';
  const keep=document.createElement('button');keep.type='button';keep.className='btn small';keep.textContent='Keep editing';const leave=document.createElement('button');leave.type='button';leave.className='btn small';leave.textContent='Discard changes';discard.append(question,keep,leave);
  let busy=false,result:Note|undefined;
  function requestClose(){if(busy)return;if(input.value!==(current?.note||'')){discard.hidden=false;keep.focus();}else dialog.close();}
  cancel.addEventListener('click',requestClose);dialog.addEventListener('cancel',e=>{e.preventDefault();requestClose();});keep.addEventListener('click',()=>{discard.hidden=true;input.focus();});leave.addEventListener('click',()=>dialog.close());
  form.addEventListener('submit',async e=>{
   e.preventDefault();if(busy)return;
   if(input.value===(current?.note||'')){dialog.close();return;}
   busy=true;submit.disabled=true;cancel.disabled=true;input.readOnly=true;discard.hidden=true;error.hidden=true;
   try{result=await writeNote(uid,id,input.value,current?.note_revision??null);dialog.close();}
   catch(e){error.textContent=(e as Error).message;error.hidden=false;}
   finally{busy=false;submit.disabled=false;cancel.disabled=false;input.readOnly=false;}
  });
  form.className='reader-form';form.append(heading,article,label,input,count,hint,error,actions,discard);dialog.append(form);document.body.append(dialog);
  dialog.addEventListener('close',()=>{dialog.remove();resolve(result);},{once:true});dialog.showModal();input.focus();input.setSelectionRange(0,0);input.scrollTop=0;
 });
}
