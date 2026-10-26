import type {APIRoute} from 'astro';import {href} from '../lib/data';
export const GET:APIRoute=({site})=>new Response(`User-agent: *\nAllow: ${href()}\nSitemap: ${new URL(href('sitemap.xml'),site)}\n`,{headers:{'Content-Type':'text/plain'}});
