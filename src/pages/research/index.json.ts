import fs from 'node:fs';
import type {APIRoute} from 'astro';
export const GET:APIRoute=()=>new Response(fs.existsSync('state/research-index/manifest.json')?fs.readFileSync('state/research-index/manifest.json','utf8'):JSON.stringify({version:1,windows:[],uniqueCandidates:0}),{headers:{'Content-Type':'application/json','Cache-Control':'public, max-age=600','X-Robots-Tag':'noindex'}});
