import {test} from 'node:test';import assert from 'node:assert/strict';import fs from 'node:fs';
import {backfillCompletionErrors} from '../src/lib/backfill-completion';import {backfillSchema,auditSchema} from '../src/lib/schema';
const sources=JSON.parse(fs.readFileSync('config/sources.json','utf8'));const ids=[...sources.sources,...sources.manualChecks].map(s=>s.id);
const baseline=()=>{
 const progress=backfillSchema.parse(JSON.parse(fs.readFileSync('state/backfill.json','utf8')));
 const audit=auditSchema.parse(JSON.parse(fs.readFileSync('state/audits/backfill-2025-04-06.json','utf8')));
 const window=progress.windows.find(w=>w.start==='2025-04-06')!;window.status='complete';window.auditId='qa-audit';
 audit.guidelineSearchCompleted=true;audit.finalCrossCheckCompleted=true;audit.sources.forEach(s=>s.status='success');
 return {progress,audit,audits:{'qa-audit':audit}};
};
test('complete research windows require matching successful saved audits',()=>{
 const {progress,audits,audit}=baseline();assert.deepEqual(backfillCompletionErrors(progress,audits,ids),[]);
 audit.sources[0].status='failed';assert.match(backfillCompletionErrors(progress,audits,ids).join(),/source check failed/);
 audit.sources[0].status='success';audit.sources.pop();assert.match(backfillCompletionErrors(progress,audits,ids).join(),/missing source check/);
 assert.match(backfillCompletionErrors(progress,{},ids).join(),/no saved audit/);
});
test('duplicate checks, wrong intervals and unfinished guidance cannot close a window',()=>{
 const {progress,audits,audit}=baseline();audit.sources.push({...audit.sources[0]});audit.coverageEnd='2025-04-13';audit.guidelineSearchCompleted=false;
 const errors=backfillCompletionErrors(progress,audits,ids).join();assert.match(errors,/duplicate source/);assert.match(errors,/coverage does not match/);assert.match(errors,/remains incomplete/);
});
test('a project cannot finish while windows or important candidates remain unresolved',()=>{
 const {progress,audits}=baseline();progress.status='complete';const errors=backfillCompletionErrors(progress,audits,ids).join();assert.match(errors,/unfinished windows/);assert.match(errors,/unresolved candidates/);
});
