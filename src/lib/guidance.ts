import type {Article} from './schema';
export const isGuidance=(a:Pick<Article,'studyType'|'section'>)=>a.studyType==='Guideline'||a.studyType==='Consensus statement'||a.section==='Guidelines & Statements';
