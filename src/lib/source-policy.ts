import type {Article} from './schema';

export function approvedSource(url:string, hosts:string[]):boolean {
 try {
  const parsed=new URL(url);
  return parsed.protocol==='https:'&&!parsed.username&&!parsed.password&&hosts.some(h=>parsed.hostname===h||parsed.hostname.endsWith('.'+h));
 } catch {return false;}
}

// Apply only to the rendered view. Preserve original JSON, review labels and revisions.
// Identifiers come from the reviewed editorial record; never invent an alternate paper.
export function publicationSource(article:Article, hosts:string[]):{article:Article;notice:string|null} {
 let canonicalUrl=article.canonicalUrl;
 const notices:string[]=[];
 if(!approvedSource(canonicalUrl,hosts)) {
  const fallback=article.doi ? `https://doi.org/${article.doi}` : article.pmid ? `https://pubmed.ncbi.nlm.nih.gov/${article.pmid}/` : null;
  if(!fallback||!approvedSource(fallback,hosts)) return {article:{...article,status:'held',excluded:true},notice:`${article.id}: withheld from public output; source host unapproved and no approved DOI/PMID fallback. Correct the original record or review its official host.`};
  canonicalUrl=fallback;
  notices.push('using recorded DOI/PMID instead of unapproved primary host');
 }
 const officialPdfUrl=article.officialPdfUrl&&!approvedSource(article.officialPdfUrl,hosts)?null:article.officialPdfUrl;
 if(officialPdfUrl!==article.officialPdfUrl) notices.push('unapproved optional PDF link omitted');
 return {article:{...article,canonicalUrl,officialPdfUrl},notice:notices.length?`${article.id}: ${notices.join('; ')}.`:null};
}
