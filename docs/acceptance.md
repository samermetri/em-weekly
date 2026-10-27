# Acceptance status

## Implemented

Astro/TypeScript static publication, KP Shifts visual theme, responsive sidebar/mobile navigation, overview, search/topic/study-type/first-online date filters, client pagination, article details and review/correction labels, weekly HTML/archive, topics, methods, RSS, sitemap, canonical metadata and subpath-safe assets. Fonts are self-hosted.

Strict content/state/audit schemas, normalized DOI/PMID/URL deduplication, bounded PubMed metadata discovery, source-isolated overlapping checkpoints, queue, daily publication limit, first-online weekly eligibility, repeated-coverage protection, catch-up labels, pinned/excluded/held overrides, serialized Actions publication, stale-snapshot guard, browser Print / Save as PDF styling and durable deployment state.

The additional editorial standard is preserved in docs/editorial-standard.md and reflected in both saved cloud task prompts: separate official guideline searches, final cross-check, clinical-impact ranking, 3-6 strong studies plus all important guidance, no filler and exact per-item summary structure.

## Evidence collected locally

- Three real primary-source-linked historical sample articles: PREOXI, DEVICE and CLOVERS. Not represented as current evidence.
- One historical sample weekly issue (June 10-16, 2024) contains PREOXI, whose first-online date falls within that week. The record was created October 26, 2026 and is explicitly marked sample.
- Browser-generated print sample visually inspected: one page, selectable text and clickable citations. Production stores JSON and HTML; generated weekly PDF assets are no longer part of publishing.
- 11 deduplication/schema/DST/missed-week/rerun/checkpoint/deployment-state tests passed.
- TypeScript check completed with zero errors/warnings before final deployment verification; CI repeats it on every publication.
- Static build and 172 repository-subpath local links/assets passed.
- PubMed's four configured queries verified via its live API. Official-source URL access evidence is in docs/source-verification.json; access failures are retained, not labeled successful research.
- Existing macOS Git Keychain login authenticated as samermetri and created the public samermetri/em-weekly repository. No credential was copied into the repository.

## Deployment acceptance

Verified October 26, 2026:

- Public Pages: https://samermetri.github.io/em-weekly/ (HTTP 200, no account).
- First successful hosted publish: https://github.com/samermetri/em-weekly/actions/runs/40394232691.
- Successful post-deployment rerun: https://github.com/samermetri/em-weekly/actions/runs/40394865012. Identical release asset IDs before and after; no duplicate upload.
- All four original browser tests passed against the PUBLIC deployed site as a signed-out visitor: navigation/subpath, search/topic/online-date/reset, direct topic shortcuts, mobile navigation and overflow.
- Release PDF downloaded publicly and SHA-256 checked against the committed issue manifest. Final published PDF visually checked: one page, bundled DM Sans/Manrope typography, no orphan page, selectable text and clickable references.
- Intentional failure probe: https://github.com/samermetri/em-weekly/actions/runs/40395065297. Validation failed before deployment, as requested. The public overview remained HTTP 200 with the identical SHA-256 68acf77bb43b29357556e45654e5338b46b9ddabbb4153fc83495cd1c98bd415.
- GitHub Pages is configured with build_type=workflow. Last successful deployment and original records are in repository state. Legacy PDF releases remain available but are no longer part of the production pipeline.


## Cloud editorial status

End-to-end editorial publication remains NOT CLOUD-TESTED. A hosted Clinical ChatGPT probe confirmed web research but could not read or write GitHub. The Clinical account's GitHub installation is visibly disabled by its administrator. Personal-account access is not authorized.

A second hosted Clinical probe successfully used the Supabase connector for list_organizations, list_projects, and SELECT 1. It exposed SQL write capabilities, but no write or scheduled run has been tested yet. The user requested a separate EM Weekly organization and a free project. Provisioning and the database-to-Actions connection are pending; do not label them working.

Recurring site-publishing schedules remain disabled in automation/schedules.json. Existing Clinical literature-brief/delivery schedules have not been changed. Repository-based prompts describe the original route and are not active. They must be adapted and tested against the database route before activation. No paid API or local heartbeat substitute.

## October 26 website and database update

The browser-print update deployed successfully: https://github.com/samermetri/em-weekly/actions/runs/40399694826. New local changes open primary-source links in a new tab, compact the AI label into date metadata, remove promotional copy and the Why it matters banner, add per-article print/share actions with descriptive suggested filenames, and include all in-week site articles in the digest. Three sample articles each rendered to one readable page. The complete three-article sample digest rendered to two pages without split article entries or an orphan page. Eight browser checks, eleven TypeScript unit checks, two Python importer checks, and TypeScript diagnostics passed during this update.

Created the separate EM Weekly organization dbvujtddkrjjrfnccsum and project vbzmghfxaorxlvoebgbj after a $0/month quote. Its separate Clinical connector is named EM Weekly. Initialized private schema em_weekly and seeded article/issue/state/config JSON. The limited builder login passed CA/hostname verification; permissions confirmed no article UPDATE and no anonymous schema access. Supabase security advisor returned no lints. The unique builder credential is encrypted as EM_WEEKLY_DATABASE_URL in the repository's Actions secrets. No private credential is committed. Hosted write, Actions import/deploy acknowledgement, and actual scheduled connector access still require verification; do not infer them from these setup checks.
