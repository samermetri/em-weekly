# EM Weekly

A public emergency medicine reading room with original, source-linked summaries and weekly literature briefs. Astro + TypeScript, static output, GitHub Pages. No login, server, paid AI API, purchased domain, or subscription beyond existing ChatGPT usage.

- Website: https://samermetri.github.io/em-weekly/
- Repository: https://github.com/samermetri/em-weekly
- Editorial requirements: [docs/editorial-standard.md](docs/editorial-standard.md)
- Publishing, secrets, corrections and rollback: [docs/publishing.md](docs/publishing.md)
- Current acceptance evidence and blockers: [docs/acceptance.md](docs/acceptance.md)

## Local development

Install Node 24 and pnpm 11.25.0. Run `pnpm install --frozen-lockfile`, then `pnpm dev`. To test the deployed repository subpath use `GITHUB_REPOSITORY=samermetri/em-weekly pnpm build` and the same environment for `pnpm preview`. A root deployment can set BASE_PATH=/ and SITE_URL=https://your-host. Self-hosted Manrope and DM Sans font assets ship with the site.

Checks: `pnpm validate`, `pnpm test`, `pnpm check`, `pnpm build`, `pnpm check:links`. Browser checks: `pnpm exec playwright install chromium` then `GITHUB_REPOSITORY=samermetri/em-weekly pnpm test:browser`. Weekly briefs and articles are JSON records. The weekly page offers Print / Save as PDF using local browser printing and print CSS. No weekly PDF assets are generated or stored.


## GitHub Pages setup

Use a PUBLIC GitHub repository, standard Ubuntu Actions runners, and GitHub Pages → Build and deployment → Source: GitHub Actions. Push main. The publish workflow validates JSON, builds, tests, uploads a Pages artifact and deploys. Built-in GITHUB_TOKEN permissions are contents:write, pages:write and id-token:write for this workflow only. No paid service or custom secret is required for this part. See publishing.md for GITHUB_TOKEN recursion restrictions and failure recovery.

## Cloud editorial setup

First configure a supported hosted ChatGPT/Codex environment with this GitHub repository and a repository-limited write connection. Enable web access to approved source domains and GitHub Actions status/dispatch access. Test `automation/cloud-smoke-test.md` in that environment while the desktop is disconnected. This is separate from the verified GitHub Actions pipeline. Do not enable recurring editorial schedules before the test passes.

In ChatGPT's Scheduled view (or a chat with a supported Cloud environment): create a new scheduled task, choose the configured CLOUD environment, paste automation/daily.md as its instructions and set daily 07:00, timezone America/Los_Angeles. Create a second task with automation/weekly.md, Monday 08:00, same timezone/environment. Review the scheduler's timezone and next-fire time across DST. Record the two schedule IDs and first hosted run evidence in automation/schedules.json. If the account UI does not expose a hosted repo-capable environment or the connection cannot push/dispatch, leave schedules disabled and resolve that exact access gap. A desktop Codex automation cannot satisfy computer-off operation.

The prompts are complete and version-controlled; cadence is separate in automation/schedules.json. The linked setup may differ by account, so verify the actual controls rather than assuming availability. Official guidance: https://learn.chatgpt.com/docs/automations and https://developers.openai.com/training/walkthroughs/scheduled-tasks.

## Adding sources

Edit config/sources.json in a reviewed setup change. PubMed groups use verified esearch URLs and journal queries; check docs/source-verification.json for live probe results. `python3 scripts/verify-sources.py` rechecks query translation and URLs and records errors. Sources requiring a browser/challenge are not assumed verified by HTTP status alone. No RSS/feed URL is fabricated: society pages are explicit manual/cloud web checks. Add official domains only, document reuse/access restrictions, verify first-online date fields, then update the separate guideline and final-cross-check lists. Respect NCBI request limits. `pnpm discover` queues metadata with overlap; it does not write summaries or claim full research success.

## Editorial format

Typical issue: 3–6 strong studies plus all important new guidelines, fewer when appropriate. Separate guideline search is mandatory. Use first-online dates and avoid repeated coverage. Major missed items receive a catch-up label once. Each item includes Summary, Why it matters, Limitations, Source and Full text, with AI/material-reviewed/human-review labels. Read the full editorial standard before selecting. The initial historical sample demonstrates format and is excluded from current weekly selection.
