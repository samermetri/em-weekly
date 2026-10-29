import fs from 'node:fs';
import {researchDirectory,researchWindowSchema,checkResearchWindow,researchDigest,researchWindows,type ResearchWindow} from '../src/lib/research-index';

const config=JSON.parse(fs.readFileSync('config/sources.json','utf8'));
const progress=JSON.parse(fs.readFileSync('state/backfill.json','utf8'));
const selected=process.env.INDEX_WINDOW||'';
if(selected&&!/^\d{4}-\d{2}-\d{2}$/.test(selected))throw Error('INDEX_WINDOW must be a research-window start date');
const windows=progress.windows.filter((w:{start:string})=>!selected||w.start===selected) as {start:string;end:string}[];
if(!windows.length)throw Error('Unknown research window');
const pause=(ms:number)=>new Promise(r=>setTimeout(r,ms));
let lastRequest=0;
async function get(url:URL):Promise<any>{
 if(url.origin!=='https://eutils.ncbi.nlm.nih.gov')throw Error('Unapproved discovery API');
 for(let attempt=0;attempt<3;attempt++){
  await pause(Math.max(0,550-(Date.now()-lastRequest)));lastRequest=Date.now();
  try{const r=await fetch(url,{signal:AbortSignal.timeout(20000),headers:{'User-Agent':'EMWeekly/1.0 (public literature metadata index)'}});if(!r.ok)throw Error(`HTTP ${r.status}`);const data=await r.json();if(data.error)throw Error(String(data.error));return data;}catch(e){if(attempt===2)throw e;await pause(1000*2**attempt);}
 }
 throw Error('Unreachable');
}
async function search(source:{id:string;query:string;url:string},start:string,end:string):Promise<{ids:string[];requests:string[]}>{
 const url=new URL(source.url);for(const [k,v] of Object.entries({db:'pubmed',retmode:'json',retmax:'1000',term:`(${source.query}) AND ("${start.replaceAll('-','/')}"[EPDAT] : "${end.replaceAll('-','/')}"[EPDAT])`,tool:'em-weekly'}))url.searchParams.set(k,v);
 const data=(await get(url)).esearchresult;const count=Number(data?.count);
 if(!data||!Number.isSafeInteger(count)||count<0||data.errorlist||data.warninglist?.quotedphrasesnotfound?.length)throw Error(`Invalid PubMed response for ${source.id}`);
 if(count>1000){
  if(start===end)throw Error(`Unresolved result cap for ${source.id} ${start}`);
  const first=Date.parse(start+'T12:00:00Z');const days=Math.round((Date.parse(end+'T12:00:00Z')-first)/86400000);const mid=new Date(first+Math.floor(days/2)*86400000).toISOString().slice(0,10);const next=new Date(Date.parse(mid+'T12:00:00Z')+86400000).toISOString().slice(0,10);
  const a=await search(source,start,mid);const b=await search(source,next,end);const ids=[...new Set([...a.ids,...b.ids])];if(ids.length!==count)throw Error('PubMed result counts changed during split; retry the snapshot');return {ids,requests:[url.href,...a.requests,...b.requests]};
 }
 const ids=data.idlist as string[];if(!Array.isArray(ids)||ids.length!==count||ids.some(id=>!/^\d+$/.test(id))||new Set(ids).size!==ids.length)throw Error('Incomplete PubMed discovery response');
 return {ids,requests:[url.href]};
}

// Commit no partial refresh: stage every requested window before replacing files.
const staged:ResearchWindow[]=[];
const cacheDirectory='tmp/research-index-staging';fs.mkdirSync(cacheDirectory,{recursive:true});
const cacheKey=researchDigest('EPDAT-v1'+JSON.stringify(config)+new Date().toISOString().slice(0,10)).slice(0,16);
for(const w of windows){
 const cachePath=`${cacheDirectory}/${cacheKey}-${w.start}.json`;
 if(fs.existsSync(cachePath)){const cached=researchWindowSchema.parse(JSON.parse(fs.readFileSync(cachePath,'utf8')));checkResearchWindow(cached);staged.push(cached);console.log(`${w.start}: reused today's complete discovery snapshot`);continue;}
 const sources:ResearchWindow['sources']=[];const memberships=new Map<string,string[]>();
 for(const source of config.sources){const result=await search(source,w.start,w.end);sources.push({id:source.id,query:source.query,count:result.ids.length,requests:result.requests});for(const id of result.ids)memberships.set(id,[...(memberships.get(id)||[]),source.id]);}
 const ids=[...memberships.keys()].sort((a,b)=>Number(a)-Number(b));const candidates:ResearchWindow['candidates']=[];
 for(let offset=0;offset<ids.length;offset+=200){
  const batch=ids.slice(offset,offset+200);const url=new URL(config.pubmedSummaryUrl);for(const [k,v] of Object.entries({db:'pubmed',retmode:'json',id:batch.join(','),tool:'em-weekly'}))url.searchParams.set(k,v);
  const result=(await get(url)).result;if(!result)throw Error('Missing PubMed summaries');
  for(const id of batch){const a=result[id];if(!a||a.error)throw Error(`Missing primary metadata for PMID ${id}`);const doi=a.articleids?.find((v:{idtype:string})=>v.idtype==='doi')?.value||null;candidates.push({pmid:id,title:a.title||a.booktitle||`Untitled PubMed record (PMID ${id})`,metadataIssue:a.title||a.booktitle?null:'PubMed supplied no title; resolve from primary material before selection',journal:a.fulljournalname||a.source||a.publishername||'',pubDate:a.pubdate||'',epubDate:a.epubdate||'',doi,types:a.pubtype||[],sourceIds:memberships.get(id)!});}
 }
 const record=researchWindowSchema.parse({version:1,start:w.start,end:w.end,retrievedAt:new Date().toISOString(),method:'PubMed electronic-date discovery; primary first-online verification required',sources,candidates});checkResearchWindow(record);staged.push(record);fs.writeFileSync(cachePath,JSON.stringify(record)+'\n');console.log(`${w.start}: ${candidates.length} indexed candidates; all four source queries retrieved`);
}
fs.mkdirSync(researchDirectory,{recursive:true});
for(const record of staged){const p=`${researchDirectory}/${record.start}.json`;fs.writeFileSync(p+'.tmp',JSON.stringify(record)+'\n');fs.renameSync(p+'.tmp',p);}
const all=researchWindows();const manifest={version:1,rangeStart:progress.rangeStart,rangeEnd:progress.rangeEnd,uniqueCandidates:new Set(all.flatMap(w=>w.candidates.map(c=>c.pmid))).size,windows:all.map(w=>({start:w.start,end:w.end,retrievedAt:w.retrievedAt,count:w.candidates.length,incompleteMetadata:w.candidates.filter(c=>c.metadataIssue).length,sha256:researchDigest(fs.readFileSync(`${researchDirectory}/${w.start}.json`,'utf8'))}))};
fs.writeFileSync(`${researchDirectory}/manifest.json.tmp`,JSON.stringify(manifest)+'\n');fs.renameSync(`${researchDirectory}/manifest.json.tmp`,`${researchDirectory}/manifest.json`);
console.log(`Saved ${all.length} research windows and ${manifest.uniqueCandidates} unique candidates. None are published article summaries.`);
