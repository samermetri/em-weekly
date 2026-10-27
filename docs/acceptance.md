# Acceptance status

Verified October 26, 2026. The website and private database publishing bridge are deployed. Unattended editorial scheduling is awaiting conversation-specific Supabase write permission and a rerun without approval.

## Public website

- Live: https://samermetri.github.io/em-weekly/ ; public repository: https://github.com/samermetri/em-weekly.
- Astro/TypeScript static publication with responsive navigation, self-hosted Manrope/DM Sans, article search/topic/type/first-online date filters, pagination, article details, weekly archive, topics, methods, RSS, sitemap, canonical metadata and subpath-safe assets.
- Primary-source/DOI/PMID links open in a new tab. The AI/review label sits in the compact date metadata row. Promotional copy and the Why it matters banner were removed.
- Each article has Print / Save as PDF and Share. Native sharing has clipboard and selectable-link fallbacks. Suggested print filenames identify EM Weekly, article/date or covered week. The browser controls the final save dialog.
- Weekly digests include every public article added in their site-publication week, keeping first-online dates and catch-up labels. The latest sample contains all three historical sample articles, clearly identified as 2023–2024 evidence rather than a current literature review.
- All three sample article printouts were visually verified as one readable page each. The complete three-article sample digest occupies two clean pages, with no split entries or orphan page. No production PDFs are generated or stored.

## Validation and hosted deployment

- Eleven TypeScript unit checks: normalized identifier deduplication, rerun stability, LA/DST week boundaries, missed weeks, strict schemas, isolated checkpoints, deployment timestamps, complete weekly inclusion.
- Two Python checks: safe import paths/incomplete snapshot rejection and stable content hashes/deployment-state preservation.
- TypeScript diagnostics: zero errors/warnings. Build and 193 local subpath links/assets passed.
- All eight browser tests passed against the signed-out PUBLIC site, including print invocation, filenames, native/copy sharing, all three digest articles, filtering and mobile navigation.
- Deployment of the website changes and database bridge: https://github.com/samermetri/em-weekly/actions/runs/40430357795 (success).
- Normal database-driven rerun: https://github.com/samermetri/em-weekly/actions/runs/40431034931 (success), with stable snapshot hash and identifiers.
- Deliberate validation failure: https://github.com/samermetri/em-weekly/actions/runs/40430892420. It failed before deploy; public overview SHA-256 remained 0c0a027adc23e60887e86da1982a32b11adee16fabf06fc1a074d7d166b3944f. Supabase retained the previous successful hash and deployment URL while reporting the failure. Normal rerun restored success.
- Public source access/query evidence remains in docs/source-verification.json. Retrieval failures are retained rather than represented as successful research.

## Free database bridge

- Separate organization EM Weekly: dbvujtddkrjjrfnccsum. Project EM Weekly: vbzmghfxaorxlvoebgbj, us-west-1. Creation quote: $0/month, Free plan.
- Separate Clinical Supabase connection named EM Weekly. KP Shift Tracker and other organizations were not modified.
- Private em_weekly.documents holds original JSON, configuration, checkpoints and probes. em_weekly.publication acknowledges exact deployed revisions. No reader data, publisher full texts or PDFs are stored.
- Builder role has read access to export documents and update access to its single publication row. Verified: no article UPDATE and no anonymous schema access. RLS is enabled. Security advisor returned no lints.
- The unique builder credential is encrypted as GitHub secret EM_WEEKLY_DATABASE_URL, never committed. TLS verifies Supabase's CA and hostname. The temporary plaintext setup credential was removed.
- Actions uses a repeatable-read snapshot, strict validation, serialized publication and stale-Git protection. Unchanged scheduled checks skip the site build. A 15-minute polling schedule is configured; platform delays are possible.
- The hosted Clinical test independently inserted and read probe:hosted-2026-10-26 revision 1. Actions acknowledged that exact revision and snapshot 46a3ae2107fd1aa59395dec69bdc5b28184c91ebcd99b7361ed875fac608100b in the successful deployment above.

## Scheduled editorial gate

A real one-time Clinical cloud schedule was created for October 26 at 6:15 PM America/Los_Angeles: automation 6adff969411c819089b5520d659556a3. It generated chat https://chatgpt.com/c/6adffb86-b2d0-8333-8794-b86f3eb362e8 and reached a Supabase INSERT for the correct project and probe:scheduled-2026-10-26. ChatGPT paused it at an explicit write-approval prompt. No scheduled probe has been inserted yet.

The approval menu offers Allow Supabase for this conversation. The owner has been asked to approve this persistent, conversation-specific permission for the test and the two editorial chats. This approval is still pending. Do not change global app permissions or broaden OAuth organization scopes. After approval, complete a scheduler rerun without another prompt and verify its deployed revision before enabling normal daily/weekly operation.

Daily/weekly site-publishing schedules remain disabled in automation/schedules.json. Existing Clinical literature-brief and delivery-check schedules have been preserved. The complete versioned daily/weekly prompts are saved in automation/ and mirrored in Supabase configuration. Preferred cadence remains daily 07:00 and Monday 08:00 America/Los_Angeles. No local heartbeat, paid API, credits, or paid fallback is used.
