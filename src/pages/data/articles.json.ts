import type {APIRoute} from 'astro';import {articles} from '../../lib/data';
export const GET:APIRoute=()=>new Response(JSON.stringify(articles.map(({id,shortTitle,source,firstOnlineDate,summary,studyType,topics})=>({id,shortTitle,source,firstOnlineDate,summary,studyType,topics}))),{headers:{'Content-Type':'application/json; charset=utf-8','Cache-Control':'public, max-age=600'}});
