import fs from 'node:fs';
import {allArticles,site} from '../src/lib/data';
import {upsertQueue,sourceCheckpoint} from '../src/lib/publishing';
const config=JSON.parse(fs.readFileSync('config/sources.json','utf8'));
const statePath='state/publishing.json';const state=JSON.parse(fs.readFileSync(statePath,'utf8'));
const now=new Date();const today=now.toISOString().slice(0,10);
const minus=(d:string,n:number)=>{const t=new Date(d+'T12:00:00Z');t.setUTCDate(t.getUTCDate()-n);return t.toISOString().slice(0,10);};
const pause=(ms:number)=>new Promise(r=>setTimeout(r,ms));
async function get(url:URL){if(url.origin!=='https://eutils.ncbi.nlm.nih.gov')throw Error('Unapproved API origin');for(let attempt=0;attempt<=config.retries;attempt++){try{await pause(550);const r=await fetch(url,{signal:AbortSignal.timeout(config.timeoutMs),headers:{'User-Agent':'EMWeekly/1.0 (metadata discovery)'}});if(!r.ok)throw Error(`HTTP ${r.status}`);return await r.json();}catch(e){if(attempt===config.retries)throw e;await pause(1000*2**attempt);}}}
let failures=0;
for(const source of config.sources){const old=state.sources[source.id]||{};const from=minus(old.successfulThrough||today,old.successfulThrough?site.discoveryOverlapDays:site.firstDiscoveryDays);try{
 const ids:string[]=[];let count=0;
 for(let start=0;start<config.maxResultsPerSource;start+=200){const u=new URL(source.url);for(const [k,v] of Object.entries({db:'pubmed',retmode:'json',retmax:'200',retstart:String(start),datetype:'edat',mindate:from,maxdate:today,term:source.query,tool:'em-weekly'}))u.searchParams.set(k,String(v));const data=await get(u);if(!data.esearchresult?.idlist||data.esearchresult.errorlist||data.esearchresult.warninglist?.quotedphrasesnotfound?.length)throw Error('Invalid query or response');count=Number(data.esearchresult.count);if(count>config.maxResultsPerSource)throw Error('Result cap exceeded; split catch-up interval before advancing checkpoint');ids.push(...data.esearchresult.idlist);if(ids.length>=count)break;}
 const incoming=ids.map(pmid=>({pmid,doi:null,canonicalUrl:`https://pubmed.ncbi.nlm.nih.gov/${pmid}/`,discoveredDate:today,sourceId:source.id,status:'needs-primary-review'}));
 state.queue=upsertQueue(state.queue,incoming,allArticles);
 state.sources[source.id]=sourceCheckpoint(old,{ok:true,through:today,at:now.toISOString(),count});
 console.log(`${source.id}: ${ids.length} candidates found`);
 }catch(e){failures++;state.sources[source.id]=sourceCheckpoint(old,{ok:false,at:now.toISOString(),error:String(e)});console.error(`${source.id}: ${String(e)}`);}
 fs.writeFileSync(statePath+'.tmp',JSON.stringify(state,null,2)+'\n');fs.renameSync(statePath+'.tmp',statePath);
}
// This script discovers metadata only. The editorial task records research success
// only after official guidance checks, primary review, and final cross-check.
if(failures)process.exitCode=1;
