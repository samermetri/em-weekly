import {supabase,base,requireUser,library,cacheLibrary,check,remove,save,status,type Library,type Bookmark,type Membership,type Folder} from './account';
import {icon} from './library-icons';
const collectionDetails=document.querySelector<HTMLDetailsElement>('#library-collections')!;
const folderPanel=document.querySelector<HTMLElement>('#library-folders-panel')!;
const folderToggle=document.querySelector<HTMLButtonElement>('#toggle-folders')!;
const compactCollections=matchMedia('(max-width:620px)');
function closeFolders(){folderPanel.classList.remove('drawer-open');folderToggle.setAttribute('aria-expanded','false');folderToggle.setAttribute('aria-label','Open folders');}
const adaptCollections=()=>{collectionDetails.open=true;closeFolders();};adaptCollections();compactCollections.addEventListener('change',adaptCollections);
folderToggle.addEventListener('click',()=>{const open=folderToggle.getAttribute('aria-expanded')!=='true';folderPanel.classList.toggle('drawer-open',open);folderToggle.setAttribute('aria-expanded',String(open));folderToggle.setAttribute('aria-label',open?'Close folders':'Open folders');});
document.addEventListener('click',e=>{if(!folderPanel.contains(e.target as Node)&&!folderToggle.contains(e.target as Node))closeFolders();});
document.addEventListener('keydown',e=>{if(e.key==='Escape'&&folderToggle.getAttribute('aria-expanded')==='true'){closeFolders();folderToggle.focus();}});
function chooseFolder(id:string){selected=id;closeFolders();render();document.querySelector<HTMLElement>('#library-title')!.focus();}
type Entry={id:string;shortTitle:string;source:string;firstOnlineDate:string;summary:string;topics?:string[];studyType?:string};
const list=document.querySelector<HTMLElement>('#saved-articles')!;
const folderList=document.querySelector<HTMLElement>('#folder-list')!;
const folderDialog=document.querySelector<HTMLDialogElement>('#folder-dialog')!;
const folderForm=document.querySelector<HTMLFormElement>('#new-folder')!;
const folderName=document.querySelector<HTMLInputElement>('#folder-name')!;
let data:Library,uid='',selected='',entries:Entry[]=[],shownIds:string[]=[];
let editingFolder:Folder|undefined,organizeAfterCreate:string|undefined;
let removedEntry:{bookmark:Bookmark;memberships:Membership[]}|undefined;
const picked=new Set<string>();
function node(tag:string,text:string,cls=''){const n=document.createElement(tag);n.textContent=text;if(cls)n.className=cls;return n;}
function action(text:string,fn:()=>Promise<void>|void){
 const b=node('button',text,'btn small') as HTMLButtonElement;b.type='button';
 b.addEventListener('click',async()=>{b.disabled=true;try{await fn();}catch(e){status(e instanceof Error?e.message:'Unable to save changes.',true);}finally{b.disabled=false;}});return b;
}
function renderSelection(){
 const available=new Set(entries.map(a=>a.id));const valid=new Set(data.bookmarks.filter(b=>available.has(b.article_id)).map(b=>b.article_id));
 for(const id of picked)if(!valid.has(id))picked.delete(id);
 const hidden=[...picked].filter(id=>!shownIds.includes(id)).length;
 document.querySelector('#selection-summary')!.textContent=`${picked.size} selected${hidden?` · ${hidden} outside this view`:''}`;
 document.querySelector<HTMLElement>('#digest-selection')!.hidden=!picked.size;
 const link=document.querySelector<HTMLAnchorElement>('#print-selection')!;
 link.setAttribute('aria-disabled',String(!picked.size));link.tabIndex=picked.size?0:-1;
 link.href=picked.size?base+'/library/digest/#'+new URLSearchParams({articles:[...picked].join(',')}):'#';
 document.querySelector<HTMLButtonElement>('#clear-selection')!.disabled=!picked.size;
 document.querySelector<HTMLButtonElement>('#select-shown')!.disabled=!shownIds.length||shownIds.every(id=>picked.has(id));
 for(const input of list.querySelectorAll<HTMLInputElement>('[data-digest-id]')){input.checked=picked.has(input.dataset.digestId!);input.closest('.saved-card')?.classList.toggle('selected-for-digest',input.checked);}
}
function render(){
 cacheLibrary(uid,data);folderList.replaceChildren();
 const all=action(`Favorites (${data.bookmarks.length})`,()=>{chooseFolder('');});
 all.prepend(icon('bookmark',16));all.classList.toggle('selected',!selected);all.setAttribute('aria-pressed',String(!selected));folderList.append(all);
 for(const folder of [...data.folders].sort((a,b)=>a.name.localeCompare(b.name))){
  const b=action(folder.name,()=>{chooseFolder(folder.id);});b.prepend(icon('folder',16));
  const count=node('span',String(data.memberships.filter(m=>m.folder_id===folder.id).length),'folder-count');count.setAttribute('aria-hidden','true');
  b.append(count);b.classList.toggle('selected',selected===folder.id);b.setAttribute('aria-pressed',String(selected===folder.id));folderList.append(b);
 }
 const title=document.querySelector<HTMLElement>('#library-title')!;title.textContent=data.folders.find(f=>f.id===selected)?.name||'Favorites';title.title=title.textContent;
 document.querySelector<HTMLElement>('#folder-tools')!.hidden=!selected;document.querySelector<HTMLDetailsElement>('#library-actions')!.open=false;
 const query=document.querySelector<HTMLInputElement>('#saved-search')!.value.trim().toLowerCase();
 const order=document.querySelector<HTMLSelectElement>('#saved-sort')!.value,catalog=new Map(entries.map(a=>[a.id,a]));
 const inFolder=data.bookmarks.filter(b=>!selected||data.memberships.some(m=>m.article_id===b.article_id&&m.folder_id===selected));
 const bookmarks=inFolder.filter(b=>{const a=catalog.get(b.article_id);return !query||[a?.shortTitle,a?.source,a?.summary,...(a?.topics||[])].join(' ').toLowerCase().includes(query);}).sort((a,b)=>order==='title'?(catalog.get(a.article_id)?.shortTitle||'').localeCompare(catalog.get(b.article_id)?.shortTitle||''):order==='oldest'?a.created_at.localeCompare(b.created_at):b.created_at.localeCompare(a.created_at));
 document.querySelector('#library-count')!.textContent=query?`${bookmarks.length} of ${inFolder.length} saved articles`:`${inFolder.length} saved ${inFolder.length===1?'article':'articles'}`;
 shownIds=bookmarks.filter(b=>catalog.has(b.article_id)).map(b=>b.article_id);list.replaceChildren();
 if(!bookmarks.length){
  const empty=node('div','','empty-library'),mark=node('span','','empty-icon');mark.append(icon(query?'search':selected?'folder':'bookmark',27));
  empty.append(mark,node('h3',query?'No matching saved articles':selected?'This folder is ready':'Your reading list starts here'),node('p',query?'Try a title, journal, or a different search.':selected?'Choose Organize on any saved article to add it here.':'Use Save article on a summary to keep it here for later.'));
  if(query)empty.append(action('Clear search',()=>{document.querySelector<HTMLInputElement>('#saved-search')!.value='';render();}));
  else if(selected)empty.append(action('See all favorites',()=>{selected='';render();}));
  else {const link=node('a','Find articles','btn') as HTMLAnchorElement;link.href=base+'/articles/';link.append(icon('arrow',15));empty.append(link);}
  list.append(empty);renderSelection();return;
 }
 for(const bookmark of bookmarks){
  const article=catalog.get(bookmark.article_id),card=node('article','','saved-card');
  if(article){
   const label=node('label','','digest-check'),checkbox=document.createElement('input');checkbox.type='checkbox';checkbox.dataset.digestId=article.id;
   checkbox.setAttribute('aria-label',`Select ${article.shortTitle} for digest`);
   checkbox.addEventListener('change',()=>{if(checkbox.checked)picked.add(article.id);else picked.delete(article.id);renderSelection();});
   label.append(checkbox);card.append(label);
  }else card.append(node('span','','saved-unavailable-mark'));
  const content=node('div','','saved-card-copy');
  if(article){
   const citation=node('div','','saved-citation');citation.append(node('span',article.studyType||'Article','saved-type'));
   const date=new Date(article.firstOnlineDate+'T12:00:00Z').toLocaleDateString('en-US',{month:'short',day:'numeric',year:'numeric',timeZone:'UTC'});
   citation.append(node('span',date));content.append(citation);
   const h=node('h3',''),title=node('a',article.shortTitle,'saved-title') as HTMLAnchorElement;title.href=base+'/articles/'+article.id+'/';h.append(title);content.append(h,node('p',article.source,'saved-source'),node('p',article.summary,'saved-summary'));
  }else content.append(node('h3','Article currently unavailable'),node('p','This article may have been withdrawn or held for review.','saved-summary'));
  const assigned=data.folders.filter(f=>data.memberships.some(m=>m.article_id===bookmark.article_id&&m.folder_id===f.id));
  if(assigned.length){const chips=node('div','','saved-folder-tags');for(const f of assigned){const b=action(f.name,()=>{chooseFolder(f.id);});b.prepend(icon('folder',12));chips.append(b);}content.append(chips);}
  card.append(content);
  const actions=node('div','','saved-row-actions');const organizeButton=action('Organize',()=>organize(bookmark.article_id));organizeButton.prepend(icon('folder',15));
  const menu=document.createElement('details');menu.className='saved-menu';const summary=node('summary','•••');summary.setAttribute('aria-label','More actions for '+(article?.shortTitle||'unavailable article'));menu.append(summary);
  const removeButton=action('Remove from favorites',async()=>{
   const memberships=data.memberships.filter(m=>m.article_id===bookmark.article_id);await remove(uid,bookmark.article_id);status('');
   removedEntry={bookmark,memberships};data.bookmarks=data.bookmarks.filter(b=>b.article_id!==bookmark.article_id);data.memberships=data.memberships.filter(m=>m.article_id!==bookmark.article_id);
   document.querySelector('#toast-message')!.textContent='Removed from favorites.';document.querySelector<HTMLElement>('#library-toast')!.hidden=false;render();
  });removeButton.className='remove-saved';removeButton.setAttribute('aria-label','Remove '+(article?.shortTitle||'article'));menu.append(removeButton);actions.append(organizeButton,menu);card.append(actions);list.append(card);
 }
 renderSelection();
}
function openFolder(folder?:Folder,articleId?:string){
 document.querySelector<HTMLDetailsElement>('#library-actions')!.open=false;closeFolders();editingFolder=folder;organizeAfterCreate=articleId;folderName.value=folder?.name||'';
 document.querySelector('#folder-dialog-title')!.textContent=folder?'Rename folder':'New folder';
 document.querySelector('#save-folder')!.textContent=folder?'Save name':'Create folder';
 document.querySelector<HTMLElement>('#folder-error')!.hidden=true;folderDialog.showModal();folderName.focus();
}
function organize(id:string){
 const dialog=document.createElement('dialog');dialog.className='reader-dialog organize-dialog';
 const form=document.createElement('form');form.method='dialog';const heading=node('h2','Organize article');heading.id='organize-title';dialog.setAttribute('aria-labelledby',heading.id);
 form.append(heading,node('p','Choose folders for this article. It will stay in Favorites.'));
 for(const folder of data.folders){const label=document.createElement('label');label.className='check-line';const input=document.createElement('input');input.type='checkbox';input.value=folder.id;input.checked=data.memberships.some(m=>m.article_id===id&&m.folder_id===folder.id);label.append(input,document.createTextNode(folder.name));form.append(label);}
 const create=action('+ New folder',()=>{dialog.close();openFolder(undefined,id);});create.className='link-button';form.append(create);
 const error=node('p','','form-error');error.setAttribute('role','alert');error.hidden=true;form.append(error);
 const row=node('div','','reader-row');row.append(action('Cancel',()=>dialog.close()),action('Save folders',async()=>{
  try{
   const chosen=Array.from(form.querySelectorAll<HTMLInputElement>('input:checked')).map(i=>i.value),previous=data.memberships.filter(m=>m.article_id===id).map(m=>m.folder_id);
   const added=chosen.filter(x=>!previous.includes(x)),removed=previous.filter(x=>!chosen.includes(x));
   if(added.length)check(await supabase.from('em_folder_items').insert(added.map(folder_id=>({user_id:uid,folder_id,article_id:id}))));
   if(removed.length)check(await supabase.from('em_folder_items').delete().eq('user_id',uid).eq('article_id',id).in('folder_id',removed));
   data.memberships=data.memberships.filter(m=>m.article_id!==id).concat(chosen.map(folder_id=>({user_id:uid,article_id:id,folder_id})));dialog.close();render();status('Folders updated.');
  }catch(e){error.textContent=(e as Error).message;error.hidden=false;}
 }));row.lastElementChild!.classList.add('primary');form.append(row);dialog.append(form);document.body.append(dialog);dialog.addEventListener('close',()=>dialog.remove(),{once:true});dialog.showModal();
}
folderForm.addEventListener('submit',async e=>{
 e.preventDefault();const name=folderName.value.trim();if(!name)return;
 const button=document.querySelector<HTMLButtonElement>('#save-folder')!;button.disabled=true;
 try{
  if(editingFolder){check(await supabase.from('em_folders').update({name}).eq('id',editingFolder.id).eq('user_id',uid));editingFolder.name=name;}
  else {const folder=check(await supabase.from('em_folders').insert({user_id:uid,name}).select('id,name,user_id').single());data.folders.push(folder);if(!organizeAfterCreate)selected=folder.id;}
  const articleId=organizeAfterCreate;folderDialog.close();render();status(editingFolder?'Folder renamed.':'Folder created.');if(articleId)organize(articleId);
 }catch(e){const error=document.querySelector<HTMLElement>('#folder-error')!;error.textContent=(e as Error).message;error.hidden=false;}
 finally{button.disabled=false;}
});
document.querySelector('#create-folder')!.addEventListener('click',()=>openFolder());
document.querySelector('#cancel-folder')!.addEventListener('click',()=>folderDialog.close());
folderDialog.setAttribute('aria-labelledby','folder-dialog-title');
document.querySelector('#delete-folder')!.addEventListener('click',async()=>{
 if(!confirm('Delete this folder? Your favorite articles will remain saved.'))return;
 try{check(await supabase.from('em_folders').delete().eq('id',selected).eq('user_id',uid));data.folders=data.folders.filter(f=>f.id!==selected);data.memberships=data.memberships.filter(m=>m.folder_id!==selected);selected='';render();status('Folder deleted. Your articles are still in Favorites.');}catch(e){status((e as Error).message,true);}
});
document.querySelector('#rename-folder')!.addEventListener('click',()=>openFolder(data.folders.find(f=>f.id===selected)));
document.querySelector('#print-selection')!.addEventListener('click',e=>{if(!picked.size)e.preventDefault();});
document.querySelector('#select-shown')!.addEventListener('click',()=>{shownIds.forEach(id=>picked.add(id));renderSelection();document.querySelector<HTMLDetailsElement>('#library-actions')!.open=false;});
document.querySelector('#clear-selection')!.addEventListener('click',()=>{picked.clear();renderSelection();});
document.querySelector('#saved-search')!.addEventListener('input',render);
document.querySelector('#saved-sort')!.addEventListener('change',render);
document.querySelector('#refresh-library')!.addEventListener('click',async e=>{const b=e.currentTarget as HTMLButtonElement;b.disabled=true;try{data=await library(uid,true);if(!data.folders.some(f=>f.id===selected))selected='';render();status('Library refreshed.');}catch(e){status((e as Error).message,true);}finally{b.disabled=false;}});
document.querySelector('#dismiss-toast')!.addEventListener('click',()=>{document.querySelector<HTMLElement>('#library-toast')!.hidden=true;removedEntry=undefined;});
document.querySelector('#undo-remove')!.addEventListener('click',async e=>{
 if(!removedEntry)return;const previous=removedEntry,button=e.currentTarget as HTMLButtonElement;button.disabled=true;
 try{await save(uid,previous.bookmark.article_id);if(!data.bookmarks.some(b=>b.article_id===previous.bookmark.article_id))data.bookmarks.push(previous.bookmark);if(previous.memberships.length){check(await supabase.from('em_folder_items').upsert(previous.memberships,{onConflict:'user_id,folder_id,article_id',ignoreDuplicates:true}));data.memberships=data.memberships.filter(m=>m.article_id!==previous.bookmark.article_id).concat(previous.memberships);}removedEntry=undefined;document.querySelector<HTMLElement>('#library-toast')!.hidden=true;status('Article restored.');}
 catch(e){status((e as Error).message,true);}finally{render();button.disabled=false;}
});
(async()=>{
 const u=await requireUser();uid=u.id;document.querySelector('[data-email]')!.textContent=u.email||'';document.querySelector('[data-avatar]')!.textContent=(u.email||'R').slice(0,1).toUpperCase();
 entries=await fetch(base+'/data/articles.json').then(r=>{if(!r.ok)throw new Error('Article catalog unavailable.');return r.json();});
 data=await library(uid);render();document.querySelector('#personal-library')!.setAttribute('aria-busy','false');document.querySelector('#personal-library')!.removeAttribute('inert');status('');
 const role=check(await supabase.rpc('em_my_role'));document.querySelector<HTMLElement>('#admin-link')!.hidden=role!=='admin';
})().catch(e=>{status(e.message,true);document.querySelector('#personal-library')!.setAttribute('aria-busy','false');document.querySelector<HTMLElement>('#retry-library')!.hidden=false;});
document.querySelector('#retry-library')!.addEventListener('click',()=>location.reload());
