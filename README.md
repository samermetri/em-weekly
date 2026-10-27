# EM Weekly

Public emergency medicine article summaries and weekly briefs. Astro + TypeScript, JSON content, GitHub Pages. No reader login or paid AI API.

- Website: https://samermetri.github.io/em-weekly/
- Repository: https://github.com/samermetri/em-weekly
- Editorial standard: [docs/editorial-standard.md](docs/editorial-standard.md)
- Architecture, printing, secrets and recovery: [docs/publishing.md](docs/publishing.md)
- Verified evidence and outstanding gates: [docs/acceptance.md](docs/acceptance.md)

## Local development

Node 24, pnpm 11.25.0: `pnpm install --frozen-lockfile`, then `pnpm dev`. Use `GITHUB_REPOSITORY=samermetri/em-weekly pnpm build` and the same environment for `pnpm preview` to test the production subpath.

Checks: `pnpm validate`, `pnpm test`, `pnpm check`, `pnpm build`, `pnpm check:links`, `pnpm test:browser`. Browser tests require Playwright Chromium locally; CI uses preinstalled Google Chrome. Self-hosted DM Sans and Manrope fonts are bundled.

Weekly digests include every public article added during the coverage week. Article summaries and issues offer browser Print / Save as PDF with local CSS and descriptive suggested filenames. No PDF assets are generated or stored. Share uses the device share sheet or copies the permanent article URL.

## Hosted editorial publishing

The Clinical ChatGPT account saves original JSON through its separate EM Weekly Supabase connection. Free organization EM Weekly, project vbzmghfxaorxlvoebgbj. The private em_weekly schema holds editorial JSON, instructions/checkpoints, and publication acknowledgements. GitHub Actions polls for changes, validates/builds the static site, and records the exact deployed document revisions. The public browser never connects to the database.

Read docs/publishing.md and automation/cloud-smoke-test.md before activation. Included cloud usage and a supported hosted scheduler are required; a desktop automation does not satisfy computer-off operation. Daily research is intended for 07:00 and the weekly digest Monday 08:00 America/Los_Angeles. Check automation/schedules.json for actual activation evidence rather than assuming these schedules are enabled.

The builder requires Python 3.12, requirements-db.txt, and the repository secret EM_WEEKLY_DATABASE_URL for its limited database role. db/schema.sql documents the bootstrap schema; do not apply it twice. db/supabase-ca.crt is Supabase's public CA certificate, downloaded from the dashboard. Never commit private credentials.

## Sources and samples

config/sources.json contains verified PubMed groups and separate official society checks. `python3 scripts/verify-sources.py` records access outcomes; `pnpm discover` queues metadata with overlap and does not claim completed research. Primary material must be retrieved before summarizing. Every record distinguishes source availability, material reviewed, and human review.

The initial articles and two issues are clearly labeled historical samples. The October 26 format preview contains all three articles added that week, with their real 2023–2024 first-online dates. They are excluded from normal current evidence and automatic research backlogs.
