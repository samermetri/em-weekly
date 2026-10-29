import fs from 'node:fs';
import crypto from 'node:crypto';
import {z} from 'zod';

export const researchCandidateSchema=z.object({pmid:z.string().regex(/^\d+$/),title:z.string().min(1),metadataIssue:z.string().nullable().default(null),journal:z.string(),pubDate:z.string(),epubDate:z.string(),doi:z.string().nullable(),types:z.array(z.string()),sourceIds:z.array(z.string()).min(1)}).strict();
export const researchWindowSchema=z.object({version:z.literal(1),start:z.iso.date(),end:z.iso.date(),retrievedAt:z.iso.datetime(),method:z.literal('PubMed electronic-date discovery; primary first-online verification required'),sources:z.array(z.object({id:z.string(),query:z.string(),count:z.number().int().nonnegative(),requests:z.array(z.url()).min(1)}).strict()).min(1),candidates:z.array(researchCandidateSchema)}).strict();
export type ResearchWindow=z.infer<typeof researchWindowSchema>;
export const researchDirectory='state/research-index';
export function researchWindows():ResearchWindow[]{return fs.existsSync(researchDirectory)?fs.readdirSync(researchDirectory).filter(f=>/^\d{4}-\d{2}-\d{2}\.json$/.test(f)).sort().map(f=>{const w=researchWindowSchema.parse(JSON.parse(fs.readFileSync(`${researchDirectory}/${f}`,'utf8')));if(f!==`${w.start}.json`)throw Error('Discovery filename mismatch');return w;}):[];}
export const researchDigest=(text:string)=>crypto.createHash('sha256').update(text).digest('hex');
export function checkResearchWindow(w:ResearchWindow){
 if(w.end<w.start)throw Error('Reversed discovery interval');
 if(new Set(w.sources.map(s=>s.id)).size!==w.sources.length)throw Error('Duplicate discovery source');
 const ids=new Set(w.candidates.map(c=>c.pmid));if(ids.size!==w.candidates.length)throw Error(`Duplicate candidate in ${w.start}`);
 for(const s of w.sources){if(w.candidates.filter(c=>c.sourceIds.includes(s.id)).length!==s.count)throw Error(`Incomplete ${s.id} candidate index for ${w.start}`);for(const url of s.requests)if(new URL(url).origin!=='https://eutils.ncbi.nlm.nih.gov')throw Error('Unapproved discovery origin');}
 if(w.candidates.some(c=>c.sourceIds.some(id=>!w.sources.some(s=>s.id===id))))throw Error('Unknown discovery source');
}
