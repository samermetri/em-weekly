import fs from 'node:fs';
import assert from 'node:assert/strict';
import {allArticles,issues,topics,site} from '../src/lib/data';
import {auditSchema,connectionTestSchema,stateSchema} from '../src/lib/schema';
import {duplicate} from '../src/lib/publishing';
const state=stateSchema.parse(JSON.parse(fs.readFileSync('state/publishing.json','utf8')));
const config=JSON.parse(fs.readFileSync('config/sources.json','utf8'));
for(const f of fs.readdirSync('state/audits').filter(f=>f.endsWith('.json'))){const d=JSON.parse(fs.readFileSync('state/audits/'+f,'utf8'));if(f==='cloud-connection-test.json')connectionTestSchema.parse(d);else auditSchema.parse(d);}
if(state.cloudConnection.status==='tested'){assert(state.cloudConnection.testAudit,'Cloud evidence path required');const d=connectionTestSchema.parse(JSON.parse(fs.readFileSync(state.cloudConnection.testAudit!,'utf8')));assert(d.status==='passed','Cloud test must pass');}
const topicIds=new Set(topics.map(t=>t.id));
const ids=new Set<string>();
for(const [n,a] of allArticles.entries()){
 assert(!ids.has(a.id),`Duplicate slug ${a.id}`);ids.add(a.id);
 assert(!duplicate(a,allArticles.slice(0,n)),`Duplicate identifiers for ${a.id}`);
 assert(a.topics.every(t=>topicIds.has(t)),`Unknown topic on ${a.id}`);
 assert(fs.existsSync(`content/articles/${a.id}.json`),'Article filename must match id');
}
const days=new Map<string,number>();for(const a of allArticles.filter(a=>a.status==='published'&&!a.sample)){days.set(a.sitePublishedDate,(days.get(a.sitePublishedDate)||0)+1);}for(const [d,n] of days)assert(n<=site.maxNewArticlesPerDay,`${d}: daily publication limit exceeded`);
const cited=new Set<string>();const coverage=new Set<string>();
for(const i of [...issues].reverse()){
 assert(!coverage.has(i.coverageStart),'Duplicate issue coverage');coverage.add(i.coverageStart);
 assert(i.coverageEnd>=i.coverageStart,'Reversed coverage');
 const start=new Date(i.coverageStart+'T12:00:00Z');const end=new Date(i.coverageEnd+'T12:00:00Z');assert(start.getUTCDay()===1&&end.getUTCDay()===0&&(end.valueOf()-start.valueOf())===6*86400000,'Coverage must be Monday-Sunday');
 assert(fs.existsSync(`content/issues/${i.id}.json`),'Issue filename must match id');
 const localIds=new Set<string>();for(const item of i.items){const a=allArticles.find(a=>a.id===item.articleId);assert(a&&a.status==='published'&&!a.excluded,'Unavailable cited article');assert(!localIds.has(a.id),'Repeated article in issue');localIds.add(a.id);
 if(!i.sample){assert(!a.sample,'Samples cannot enter normal issues');assert(!cited.has(a.id),'Article repeated across issues');assert(item.catchUp||(a.firstOnlineDate>=i.coverageStart&&a.firstOnlineDate<=i.coverageEnd),'Outside first-online window without catch-up label');cited.add(a.id);}}
 if(!i.sample){assert(i.searchAudit&&fs.existsSync(i.searchAudit),'Search audit required');assert(/^state\/audits\/[a-z0-9-]+\.json$/.test(i.searchAudit!),'Audit must be in state/audits');const audit=auditSchema.parse(JSON.parse(fs.readFileSync(i.searchAudit!,'utf8')));assert(audit.coverageStart===i.coverageStart&&audit.coverageEnd===i.coverageEnd,'Audit coverage mismatch');const checked=new Set(audit.sources.map(s=>s.sourceId));for(const source of [...config.sources,...config.manualChecks])assert(checked.has(source.id),'Audit missing source '+source.id);assert(audit.guidelineSearchCompleted&&audit.finalCrossCheckCompleted,'Separate guideline search and final cross-check required');}
 if(i.pdf.status==='ready')assert(i.pdf.releaseUrl?.startsWith(`https://github.com/${site.repository}/releases/download/issue-${i.id}/`),'PDF URL must belong to the issue release');
}
console.log(`Validated ${allArticles.length} articles, ${issues.length} issues, and daily limits.`);
