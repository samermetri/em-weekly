# EM Weekly

Public emergency medicine article summaries and weekly briefs. Astro + TypeScript, JSON content, GitHub Pages. Optional reader accounts; no paid AI API.

- Website: https://emweekly.samermetri.com/
- Repository: https://github.com/samermetri/em-weekly
- Editorial standard: [docs/editorial-standard.md](docs/editorial-standard.md)
- Architecture, printing, secrets and recovery: [docs/publishing.md](docs/publishing.md)
- Verified evidence and outstanding gates: [docs/acceptance.md](docs/acceptance.md)

## Local development

Node 24, pnpm 11.25.0: `pnpm install --frozen-lockfile`, then `pnpm dev`. Use `pnpm build` and `pnpm preview` to test the production root paths.

Checks: `pnpm validate`, `pnpm test`, `pnpm check`, `pnpm build`, `pnpm check:links`, `pnpm test:browser`. Browser tests require Playwright Chromium locally; CI uses preinstalled Google Chrome. Self-hosted DM Sans and Manrope fonts are bundled.

Weekly digests include every public article added during the coverage week. Article summaries and issues offer browser Print / Save as PDF with local CSS and descriptive suggested filenames. No PDF assets are generated or stored. Share uses the device share sheet or copies the permanent article URL.

## Hosted editorial publishing

The Clinical ChatGPT account saves original JSON through its separate EM Weekly Supabase connection. Free organization EM Weekly, project vbzmghfxaorxlvoebgbj. The private em_weekly schema holds editorial JSON, instructions/checkpoints, and publication acknowledgements. GitHub Actions polls for changes, validates/builds the static site, and records the exact deployed document revisions. Public reading never connects to the database. Optional Supabase Auth accounts save private favorites and folders; only account interactions contact the database. Verified owner accounts can manage articles through a protected editorial workspace.

Read docs/publishing.md and automation/cloud-smoke-test.md before activation. Included cloud usage and a supported hosted scheduler are required; a desktop automation does not satisfy computer-off operation. Daily research is active at 02:00 and the weekly digest Monday 03:00 America/Los_Angeles. Hosted connector writes and a timed daily rerun passed. See automation/schedules.json and docs/acceptance.md for exact evidence and the separate GitHub deployment-timer observation status.

The builder requires Python 3.12, requirements-db.txt, and the repository secret EM_WEEKLY_DATABASE_URL for its limited database role. db/schema.sql documents the bootstrap schema; db/accounts.sql and db/account-limits.sql add optional reader accounts and protected admin RPCs. Do not apply these bootstrap files twice. db/supabase-ca.crt is Supabase's public CA certificate, downloaded from the dashboard. Never commit private credentials.

## Sources and samples

config/sources.json contains verified PubMed groups and separate official society checks. `python3 scripts/verify-sources.py` records access outcomes; `pnpm discover` queues metadata with overlap and does not claim completed research. Primary material must be retrieved before summarizing. Every record distinguishes source availability, material reviewed, and human review.

The initial articles and two issues are clearly labeled historical samples. The October 26 format preview contains all three articles added that week, with their real 2023–2024 first-online dates. They are excluded from normal current evidence and automatic research backlogs.

## Reader accounts and caching

Public HTML, search, weekly briefs and `/data/articles.json` are built once and served statically. Cloudflare cache rules cover only emweekly.samermetri.com: public origin TTLs, one-year hashed assets, and bypass for `/account`, `/library`, `/admin`. Account API fetches use no-store. Private libraries have a five-minute local cache per user, an explicit Refresh button, and no polling or Realtime subscriptions. Signing out clears local library data.

RLS isolates each user’s favorites/folders; composite foreign keys prevent cross-user associations. The verified owner allowlist is private and cannot be changed through signup metadata. Admin edits use optimistic revisions and dated history; Delete withdraws and can be restored. New manual articles begin held for review. All public changes still pass the publishing workflow.

Supabase uses Resend custom SMTP from emweekly@updates.samermetri.com for confirmation and password reset. Credentials remain in Supabase settings. Storage limits are 100 folders, 5,000 saved published articles and 10,000 folder associations per user. Free-tier capacity is finite; upgrades and paid fallback are not authorized.
