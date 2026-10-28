import fs from 'node:fs';
import {articleSchema,issueSchema} from './schema';
import {rank,weeklyItems} from './publishing';
export function loadJsonFolder(folder:string){return fs.readdirSync(folder).filter(f=>f.endsWith('.json')).sort().map(f=>JSON.parse(fs.readFileSync(`${folder}/${f}`,'utf8')));}
export const allArticles=loadJsonFolder('content/articles').map(a=>articleSchema.parse(a));
export const articles=allArticles.filter(a=>a.status==='published'&&!a.excluded).sort((a,b)=>b.sitePublishedDate.localeCompare(a.sitePublishedDate)||Number(b.pinned)-Number(a.pinned)||rank(b)-rank(a));
export const currentArticles=articles.filter(a=>!a.backfill);
export const historicalArticles=articles.filter(a=>a.backfill).sort((a,b)=>b.firstOnlineDate.localeCompare(a.firstOnlineDate)||rank(b)-rank(a));
export const featured=currentArticles.filter(a=>!a.sample||!currentArticles.some(a=>!a.sample)).sort((a,b)=>Number(b.pinned)-Number(a.pinned)||rank(b)-rank(a));
export const issues=loadJsonFolder('content/issues').map(i=>issueSchema.parse(i)).map(i=>({...i,withdrawn:i.items.some(item=>allArticles.some(a=>a.id===item.articleId&&(a.excluded||a.status==='held'))),items:weeklyItems(i,allArticles)})).sort((a,b)=>b.id.localeCompare(a.id));
export const topics=JSON.parse(fs.readFileSync('config/topics.json','utf8')) as {id:string;name:string;description:string;number:string}[];
export const state=JSON.parse(fs.readFileSync('state/publishing.json','utf8'));
export const site=JSON.parse(fs.readFileSync('config/site.json','utf8'));
export const href=(path='')=>`${import.meta.env.BASE_URL.replace(/\/$/,'')}/${path.replace(/^\//,'')}`;
export const formatDate=(s:string)=>new Date(s+'T12:00:00Z').toLocaleDateString('en-US',{month:'short',day:'numeric',year:'numeric',timeZone:'UTC'});
