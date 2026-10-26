import { defineConfig } from 'astro/config';
const repo = process.env.GITHUB_REPOSITORY;
const [owner, name] = repo?.split('/') ?? [];
export default defineConfig({
  output: 'static', trailingSlash: 'always',
  site: process.env.SITE_URL || (owner ? `https://${owner}.github.io` : 'http://localhost:4321'),
  base: process.env.BASE_PATH ?? (name && name !== `${owner}.github.io` ? `/${name}` : '/'),
});
