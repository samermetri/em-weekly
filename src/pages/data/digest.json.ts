import type {APIRoute} from 'astro';
import {articles} from '../../lib/data';
// Public published material only. Private folder names, users and bookmarks are
// never part of this static catalog or the print request.
export const GET:APIRoute=()=>new Response(JSON.stringify(articles.map(({id,title,shortTitle,authors,source,firstOnlineDate,summary,whyItMatters,limitations,findings,canonicalUrl,doi,pmid,fullTextStatus,reviewedMaterial,aiGenerated,humanReview,evidenceNotes,corrections,sample})=>({id,title,shortTitle,authors,source,firstOnlineDate,summary,whyItMatters,limitations,findings,canonicalUrl,doi,pmid,fullTextStatus,reviewedMaterial,aiGenerated,humanReview,evidenceNotes,corrections,sample}))),{headers:{'Content-Type':'application/json; charset=utf-8','Cache-Control':'public, max-age=600'}});
