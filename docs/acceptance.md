# Acceptance status

## Implemented

Astro/TypeScript static publication, KP Shifts visual theme, responsive sidebar/mobile navigation, overview, search/topic/study-type/first-online date filters, client pagination, article details and review/correction labels, weekly HTML/archive, topics, methods, RSS, sitemap, canonical metadata and subpath-safe assets. Fonts are self-hosted.

Strict content/state/audit schemas, normalized DOI/PMID/URL deduplication, bounded PubMed metadata discovery, source-isolated overlapping checkpoints, queue, daily publication limit, first-online weekly eligibility, repeated-coverage protection, catch-up labels, pinned/excluded/held overrides, serialized Actions publication, stale-snapshot guard, original PDF rendering, immutable Release assets, public checksum verification and durable deployment state.

The additional editorial standard is preserved in docs/editorial-standard.md and reflected in both saved cloud task prompts: separate official guideline searches, final cross-check, clinical-impact ranking, 3-6 strong studies plus all important guidance, no filler and exact per-item summary structure.

## Evidence collected locally

- Three real primary-source-linked historical sample articles: PREOXI, DEVICE and CLOVERS. Not represented as current evidence.
- One historical sample weekly issue (June 10-16, 2024) contains PREOXI, whose first-online date falls within that week. The record was created October 26, 2026 and is explicitly marked sample.
- Redesigned sample PDF visually inspected; selectable text and clickable citations checked.
- 9 deduplication/schema/DST/missed-week/rerun/checkpoint tests passed.
- TypeScript check completed with zero errors/warnings before final deployment verification; CI repeats it on every publication.
- Static build and 172 repository-subpath local links/assets passed.
- PubMed's four configured queries verified via its live API. Official-source URL access evidence is in docs/source-verification.json; access failures are retained, not labeled successful research.
- Existing macOS Git Keychain login authenticated as samermetri and created the public samermetri/em-weekly repository. No credential was copied into the repository.

## Deployment acceptance

Pending first Actions run at document creation. Final run IDs, live URL, signed-out browser checks, PDF verification, rerun asset counts and failure-preservation evidence will be appended after actual verification.

## Cloud editorial status

NOT CLOUD-TESTED. Local Git credentials and GitHub Actions do not prove that a hosted ChatGPT task can write this repo. The current desktop session exposes only local automation creation; no repo-capable hosted scheduler/environment control is exposed here. The optional GitHub plugin directory reports that plugin disabled by administrator. A cloud environment's built-in Git connection may still work and must be tested independently.

Recurring tasks remain disabled in automation/schedules.json. The exact gate is automation/cloud-smoke-test.md: repository read → primary source retrieval → scoped repository write → workflow dispatch/trigger → Actions status → public PDF and Pages verification. Configure a supported hosted ChatGPT/Codex environment with this repository and repo-scoped Contents/Actions write access, run that test with the desktop disconnected, then create the two cloud schedules at 07:00 daily and Monday 08:00 America/Los_Angeles using the saved prompts. No paid API or local heartbeat substitute.
