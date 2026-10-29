import type {Article} from '../schema';
import {paragraphs} from '../paragraphs';
import {isGuidance} from '../guidance';
const base=import.meta.env.BASE_URL.replace(/\/$/,'');
type DigestEntry=Pick<Article,'studyType'|'section'|'guidelineStrength'|'id'|'title'|'shortTitle'|'authors'|'source'|'firstOnlineDate'|'summary'|'whyItMatters'|'limitations'|'findings'|'canonicalUrl'|'doi'|'pmid'|'fullTextStatus'|'reviewedMaterial'|'aiGenerated'|'humanReview'|'evidenceNotes'|'corrections'|'sample'>;
const list=document.querySelector<HTMLElement>('#digest-articles')!;const sheet=document.querySelector<HTMLElement>('#personal-digest')!;const status=document.querySelector<HTMLElement>('#digest-status')!;const print=document.querySelector<HTMLButtonElement>('#print-digest')!;
function node(tag:string,text:string,cls=''){const n=document.createElement(tag);n.textContent=text;if(cls)n.className=cls;return n;}
function section(title:string,text:string){const s=node('section','','digest-copy');s.append(node('h4',title),...paragraphs(text).map(p=>node('p',p)));return s;}
const date=(value:string)=>new Date(value+'T12:00:00Z').toLocaleDateString('en-US',{month:'short',day:'numeric',year:'numeric',timeZone:'UTC'});
function entry(a:DigestEntry,index:number){
 const guidance=isGuidance(a);const article=node('section','','digest-entry'+(guidance?' guidance-entry':''));const header=node('header','','digest-entry-heading');header.append(node('span',String(index+1).padStart(2,'0'),'digest-number'),node('h3',a.shortTitle));article.append(header,node('p',a.title,'digest-full-title'),node('p',`${a.source} · First online ${date(a.firstOnlineDate)}`,'digest-citation'));
 if(a.sample)article.append(node('p','Historical sample; not current weekly evidence.','digest-review'));
 article.append(section('Summary',a.summary),section('Why it matters',a.whyItMatters),section('Limitations',a.limitations));
 const findings=node('section','','digest-findings digest-copy');findings.append(node('h4',guidance?'Key recommendations':'Main findings'));const ul=document.createElement('ul');a.findings.forEach(f=>ul.append(node('li',f)));findings.append(ul);article.append(findings);if(a.guidelineStrength)article.append(section('Recommendation strength',a.guidelineStrength));
 const sources=node('div','','digest-sources');const primary=node('a',a.doi?`DOI: ${a.doi}`:a.canonicalUrl) as HTMLAnchorElement;primary.href=a.doi?'https://doi.org/'+a.doi:a.canonicalUrl;primary.target='_blank';primary.rel='noopener noreferrer';sources.append(primary);
 const full=node('a','Full EM Weekly summary') as HTMLAnchorElement;full.href=base+'/articles/'+a.id+'/';sources.append(full);article.append(sources);
 article.append(node('p',`${a.fullTextStatus} · Material reviewed: ${a.reviewedMaterial}. ${a.aiGenerated?'AI-generated':'Editor-written'} · ${a.humanReview}.`,'digest-review'),node('p',a.evidenceNotes,'digest-evidence'));
 if(a.corrections.length){const c=a.corrections.at(-1)!;article.append(node('p',`Latest correction (${date(c.date)}): ${c.description}`,'digest-correction'));}
 return article;
}
print.addEventListener('click',()=>{const previous=document.title;const today=new Date().toLocaleDateString('en-CA');document.title=`EM Weekly - Reading Digest - ${list.children.length} articles - ${today}`;window.addEventListener('afterprint',()=>{document.title=previous;},{once:true});window.print();});
document.querySelector<HTMLSelectElement>('#digest-format')!.addEventListener('change',e=>sheet.dataset.format=(e.target as HTMLSelectElement).value);
let generation=0;let catalogPromise:Promise<DigestEntry[]>|undefined;
async function loadDigest(){
 const turn=++generation;print.disabled=true;sheet.hidden=true;list.replaceChildren();status.textContent='Loading your selection…';
 const ids=[...new Set((new URLSearchParams(location.hash.slice(1)).get('articles')||'').split(',').filter(id=>/^[a-z0-9][a-z0-9-]{0,120}$/.test(id)))].slice(0,5000);
 if(!ids.length){status.textContent='Select articles in My Library to create a digest.';return;}
 if(!catalogPromise)catalogPromise=fetch(base+'/data/digest.json').then(r=>{if(!r.ok)throw Error('The article catalog could not be loaded. Please try again.');return r.json() as Promise<DigestEntry[]>;}).catch(e=>{catalogPromise=undefined;throw e;});const all=await catalogPromise;if(turn!==generation)return;const catalog=new Map(all.map(a=>[a.id,a]));const chosen=ids.map(id=>catalog.get(id)).filter((a):a is DigestEntry=>!!a);
 if(!chosen.length){status.textContent='These articles are currently unavailable. Return to My Library to update your selection.';return;}
 chosen.forEach((a,i)=>list.append(entry(a,i)));document.querySelector('#digest-meta')!.textContent=`${chosen.length} selected ${chosen.length===1?'article':'articles'} · Prepared ${new Date().toLocaleDateString('en-US',{month:'long',day:'numeric',year:'numeric'})}`;
 status.textContent=ids.length===chosen.length?'Your digest is ready. Choose Print / Save as PDF.':`${ids.length-chosen.length} unavailable ${ids.length-chosen.length===1?'article was':'articles were'} omitted. Your remaining ${chosen.length} ${chosen.length===1?'article is':'articles are'} ready.`;sheet.hidden=false;print.disabled=false;
}
function updateDigest(){loadDigest().catch(e=>status.textContent=e instanceof Error?e.message:'Unable to prepare the digest. Please try again.');}
window.addEventListener('hashchange',updateDigest);updateDigest();
