import type {z} from 'zod';
import {auditSchema,backfillSchema} from './schema';
type Progress=z.infer<typeof backfillSchema>;
type Audit=z.infer<typeof auditSchema>;
// Publication must never turn a failed or missing audit into a completed week.
export function backfillCompletionErrors(progress:Progress,audits:Record<string,Audit>,sourceIds:string[]):string[]{
 const errors:string[]=[];const expected=new Set(sourceIds);
 for(const window of progress.windows.filter(w=>w.status==='complete')){
  const prefix=window.start+': ';const audit=window.auditId?audits[window.auditId]:undefined;
  if(!audit){errors.push(prefix+'completed window has no saved audit');continue;}
  if(audit.coverageStart!==window.start||audit.coverageEnd!==window.end)errors.push(prefix+'audit coverage does not match window');
  if(!audit.guidelineSearchCompleted||!audit.finalCrossCheckCompleted)errors.push(prefix+'guideline or final cross-check remains incomplete');
  const seen=new Set<string>();
  for(const source of audit.sources){
   if(seen.has(source.sourceId))errors.push(prefix+'duplicate source '+source.sourceId);
   seen.add(source.sourceId);
   if(!expected.has(source.sourceId))errors.push(prefix+'unknown source '+source.sourceId);
   if(source.status!=='success')errors.push(prefix+'source check failed: '+source.sourceId);
  }
  for(const id of expected)if(!seen.has(id))errors.push(prefix+'missing source check: '+id);
 }
 if(progress.status==='complete'){
  if(progress.windows.some(w=>w.status!=='complete'))errors.push('Project marked complete with unfinished windows');
  if(progress.candidateQueue.length)errors.push('Project marked complete with unresolved candidates');
 }
 return errors;
}
