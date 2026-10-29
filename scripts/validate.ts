import fs from 'node:fs';
import assert from 'node:assert/strict';
import {allArticles,issues,topics,site} from '../src/lib/data';
import {auditSchema,connectionTestSchema,stateSchema,cloudProbeSchema,backfillSchema} from '../src/lib/schema';
import {duplicate} from '../src/lib/publishing';
import {backfillCompletionErrors} from '../src/lib/backfill-completion';
import {researchWindows,researchDirectory,researchDigest,checkResearchWindow} from '../src/lib/research-index';
const state=stateSchema.parse(JSON.parse(fs.readFileSync('state/publishing.json','utf8')));
if(fs.existsSync('state/cloud-probes'))for(const file of fs.readdirSync('state/cloud-probes').filter(f=>f.endsWith('.json'))){const probe=cloudProbeSchema.parse(JSON.parse(fs.readFileSync('state/cloud-probes/'+file,'utf8')));assert(file===probe.id+'.json','Probe filename must match id');}
const config=JSON.parse(fs.readFileSync('config/sources.json','utf8'));
for(const f of fs.readdirSync('state/audits').filter(f=>f.endsWith('.json'))){const d=JSON.parse(fs.readFileSync('state/audits/'+f,'utf8'));if(f==='cloud-connection-test.json')connectionTestSchema.parse(d);else auditSchema.parse(d);}
if(state.cloudConnection.status==='tested'){assert(state.cloudConnection.testAudit,'Cloud evidence path required');const d=connectionTestSchema.parse(JSON.parse(fs.readFileSync(state.cloudConnection.testAudit!,'utf8')));assert(d.status==='passed','Cloud test must pass');}
const topicIds=new Set(topics.map(t=>t.id));
const ids=new Set<string>();
for(const [n,a] of allArticles.entries()){
 assert(!ids.has(a.id),`Duplicate slug ${a.id}`);ids.add(a.id);
 assert(!duplicate(a,allArticles.slice(0,n)),`Duplicate identifiers for ${a.id}`);
 for(const link of [a.canonicalUrl,a.officialPdfUrl].filter(Boolean) as string[]){const host=new URL(link).hostname;assert(config.allowedPrimaryHosts.some((h:string)=>host===h||host.endsWith('.'+h)),`Unapproved primary source host ${host}`);}
 assert(a.topics.every(t=>topicIds.has(t)),`Unknown topic on ${a.id}`);
 assert(fs.existsSync(`content/articles/${a.id}.json`),'Article filename must match id');
}
const days=new Map<string,number>();for(const a of allArticles.filter(a=>a.status==='published'&&!a.sample&&!a.backfill)){days.set(a.sitePublishedDate,(days.get(a.sitePublishedDate)||0)+1);}for(const [d,n] of days)assert(n<=site.maxNewArticlesPerDay,`${d}: daily publication limit exceeded`);
const cited=new Set<string>();const coverage=new Set<string>();
for(const i of [...issues].reverse()){
 assert(!coverage.has(`${i.sample}:${i.coverageStart}`),'Duplicate issue coverage');coverage.add(`${i.sample}:${i.coverageStart}`);
 assert(i.coverageEnd>=i.coverageStart,'Reversed coverage');
 const start=new Date(i.coverageStart+'T12:00:00Z');const end=new Date(i.coverageEnd+'T12:00:00Z');assert(start.getUTCDay()===1&&end.getUTCDay()===0&&(end.valueOf()-start.valueOf())===6*86400000,'Coverage must be Monday-Sunday');
 assert(fs.existsSync(`content/issues/${i.id}.json`),'Issue filename must match id');
 const localIds=new Set<string>();for(const item of i.items){const a=allArticles.find(a=>a.id===item.articleId);assert(a&&a.status==='published'&&!a.excluded,'Unavailable cited article');assert(!localIds.has(a.id),'Repeated article in issue');localIds.add(a.id);
 if(!i.sample){assert(!a.sample,'Samples cannot enter normal issues');assert(!cited.has(a.id),'Article repeated across issues');assert(item.catchUp||(a.sitePublishedDate>=i.coverageStart&&a.sitePublishedDate<=i.coverageEnd),'Outside site publication week without catch-up label');assert(a.firstOnlineDate>=i.coverageStart||item.catchUp,'Older evidence requires a catch-up label');cited.add(a.id);}}
 if(!i.sample){assert(i.searchAudit&&fs.existsSync(i.searchAudit),'Search audit required');assert(/^state\/audits\/[a-z0-9-]+\.json$/.test(i.searchAudit!),'Audit must be in state/audits');const audit=auditSchema.parse(JSON.parse(fs.readFileSync(i.searchAudit!,'utf8')));assert(audit.coverageStart===i.coverageStart&&audit.coverageEnd===i.coverageEnd,'Audit coverage mismatch');const checked=new Set(audit.sources.map(s=>s.sourceId));for(const source of [...config.sources,...config.manualChecks])assert(checked.has(source.id),'Audit missing source '+source.id);assert(audit.guidelineSearchCompleted&&audit.finalCrossCheckCompleted,'Separate guideline search and final cross-check required');}
}
console.log(`Validated ${allArticles.length} articles, ${issues.length} issues, and daily limits.`);

if(fs.existsSync('state/backfill.json')){const progress=backfillSchema.parse(JSON.parse(fs.readFileSync('state/backfill.json','utf8')));const audits=Object.fromEntries(fs.readdirSync('state/audits').filter(f=>f!=='cloud-connection-test.json'&&f.endsWith('.json')).map(f=>[f.slice(0,-5),auditSchema.parse(JSON.parse(fs.readFileSync('state/audits/'+f,'utf8')))]));const completionErrors=backfillCompletionErrors(progress,audits,[...config.sources,...config.manualChecks].map(s=>s.id));assert(!completionErrors.length,completionErrors.join('\n'));let next=progress.rangeStart;for(const w of progress.windows){assert(w.start===next&&w.end>=w.start&&w.end<=progress.rangeEnd,'Historical research windows must be contiguous');const d=new Date(w.end+'T12:00:00Z');d.setUTCDate(d.getUTCDate()+1);next=d.toISOString().slice(0,10);for(const id of w.articleIds){const a=allArticles.find(a=>a.id===id);assert(a?.backfill&&a.firstOnlineDate>=w.start&&a.firstOnlineDate<=w.end,'Historical window article mismatch');}if(w.status==='complete'){assert(w.auditId&&fs.existsSync('state/audits/'+w.auditId+'.json'),'Completed backfill window requires an audit');const audit=auditSchema.parse(JSON.parse(fs.readFileSync('state/audits/'+w.auditId+'.json','utf8')));assert(audit.coverageStart===w.start&&audit.coverageEnd===w.end&&audit.guidelineSearchCompleted&&audit.finalCrossCheckCompleted,'Historical audit incomplete');for(const source of [...config.sources,...config.manualChecks])assert(audit.sources.some(s=>s.sourceId===source.id&&s.status==='success'),'Historical audit missing a successful source: '+source.id);}}const last=progress.windows.at(-1);assert(last?.end===progress.rangeEnd,'Historical windows must cover the full requested range');assert(progress.status!=='complete'||progress.windows.every(w=>w.status==='complete'),'Historical project cannot be complete with unfinished windows');for(const a of allArticles.filter(a=>a.backfill)){assert(!a.sample&&a.firstOnlineDate>=progress.rangeStart&&a.firstOnlineDate<=progress.rangeEnd,'Backfill article outside requested interval');assert(progress.windows.some(w=>w.articleIds.includes(a.id)),'Historical article missing from progress records');}}

if(fs.existsSync(researchDirectory)){
 const indexed=researchWindows();const manifest=JSON.parse(fs.readFileSync(`${researchDirectory}/manifest.json`,'utf8'));const progress=backfillSchema.parse(JSON.parse(fs.readFileSync('state/backfill.json','utf8')));
 assert(manifest.version===1&&manifest.rangeStart===progress.rangeStart&&manifest.rangeEnd===progress.rangeEnd,'Discovery range mismatch');
 assert(manifest.windows.length===indexed.length,'Discovery manifest has missing or extra windows');
 assert(manifest.uniqueCandidates===new Set(indexed.flatMap(w=>w.candidates.map(c=>c.pmid))).size,'Discovery total mismatch');
 for(const w of indexed){
  checkResearchWindow(w);assert(progress.windows.some(p=>p.start===w.start&&p.end===w.end),'Unknown discovery interval');
  assert(w.sources.length===config.sources.length,'Missing discovery source');
  for(const source of config.sources){const captured=w.sources.find(s=>s.id===source.id);assert(captured,'Missing discovery source');assert(captured.query===source.query,'Discovery query mismatch');for(const request of captured.requests){const url=new URL(request);const term=url.searchParams.get('term')||'';const match=term.match(/ AND \("(\d{4}\/\d{2}\/\d{2})"\[EPDAT\] : "(\d{4}\/\d{2}\/\d{2})"\[EPDAT\]\)$/);assert(url.pathname==='/entrez/eutils/esearch.fcgi'&&match&&term===`(${source.query})${match[0]}`,'Unexpected discovery query');const from=match[1].replaceAll('/','-');const to=match[2].replaceAll('/','-');assert(from>=w.start&&to<=w.end&&to>=from,'Discovery request outside interval');}}

  const entry=manifest.windows.find((m:{start:string})=>m.start===w.start);assert(entry&&entry.end===w.end&&entry.retrievedAt===w.retrievedAt&&entry.count===w.candidates.length&&entry.incompleteMetadata===w.candidates.filter(c=>c.metadataIssue).length,'Discovery manifest entry mismatch');assert(entry.sha256===researchDigest(fs.readFileSync(`${researchDirectory}/${w.start}.json`,'utf8')),'Discovery digest mismatch');
 }
 console.log(`Validated ${indexed.length} cached PubMed discovery windows (unreviewed candidates).`);
}
