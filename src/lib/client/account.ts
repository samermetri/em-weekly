import {createClient} from '@supabase/supabase-js';
export const supabase=createClient('https://vbzmghfxaorxlvoebgbj.supabase.co','sb_publishable_d1KB3RZ8-xoMfAAxlm132g_mN8u4GXW',{auth:{persistSession:true,autoRefreshToken:true,detectSessionInUrl:true},global:{fetch:(url,options)=>fetch(url,{...options,cache:'no-store'})}});
export const base=import.meta.env.BASE_URL.replace(/\/$/,'');
export function check({data,error}:{data?:any;error:any}):any{if(error)throw new Error(error.message);return data;}
export async function user(){const {data,error}=await supabase.auth.getSession();if(error)throw error;return data.session?.user??null;}
export function status(message:string,error=false){const node=document.querySelector<HTMLElement>('[data-account-status]');if(node){node.textContent=message;node.classList.toggle('error',error);}}
export async function requireUser(){const u=await user();if(!u){location.assign(`${base}/account/?next=${encodeURIComponent(location.pathname)}`);throw new Error('Please sign in to continue.');}localStorage.setItem('em-weekly:last-user',u.id);return u;}
export function safeNext(value:string|null){return value&&value.startsWith(base+'/')&&!value.startsWith('//')&&!value.includes('\\')&&!value.startsWith(base+'/account')?value:base+'/library/';}
export async function signOut(){check(await supabase.auth.signOut());for(const key of Object.keys(localStorage))if(key.startsWith('em-weekly:'))localStorage.removeItem(key);location.assign(base+'/account/');}
export type Folder={id:string;name:string;user_id:string};
export type Bookmark={article_id:string;created_at:string;user_id:string;note?:string;note_revision?:number};
export type Membership={article_id:string;folder_id:string;user_id:string};
export type Library={folders:Folder[];bookmarks:Bookmark[];memberships:Membership[]};
export async function library(uid:string,refresh=false):Promise<Library>{
 const key='em-weekly:library:'+uid;try{const cache=JSON.parse(localStorage.getItem(key)||'null');if(!refresh&&cache?.version===2&&Date.now()-cache.at<300000)return cache.data;}catch{}
 const [f,b,m]=await Promise.all([supabase.from('em_folders').select('id,name,user_id').order('name'),supabase.from('em_bookmarks').select('article_id,created_at,user_id,note,note_revision').order('created_at',{ascending:false}),supabase.from('em_folder_items').select('article_id,folder_id,user_id')]);
 const data={folders:check(f)||[],bookmarks:check(b)||[],memberships:check(m)||[]};cacheLibrary(uid,data);return data;
}
export function cacheLibrary(uid:string,data:Library){try{localStorage.setItem('em-weekly:library:'+uid,JSON.stringify({version:2,at:Date.now(),data}));}catch{}}
export async function save(uid:string,id:string,note?:Pick<Bookmark,'note'|'note_revision'>){check(await supabase.from('em_bookmarks').upsert({user_id:uid,article_id:id,...note},{onConflict:'user_id,article_id',ignoreDuplicates:true}));}
export async function remove(uid:string,id:string){check(await supabase.from('em_bookmarks').delete().eq('user_id',uid).eq('article_id',id));document.dispatchEvent(new CustomEvent('em-note-removed',{detail:id}));}
