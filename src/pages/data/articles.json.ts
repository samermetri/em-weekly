import type {APIRoute} from 'astro';import {articles} from '../../lib/data';
export const GET:APIRoute=()=>new Response(JSON.stringify(articles.map(({id,shortTitle,source,firstOnlineDate,summary})=>({id,shortTitle,source,firstOnlineDate,summary}))),{headers:{'Content-Type':'application/json; charset=utf-8','Cache-Control':'public, max-age=600'}});
