# Acceptance status

Verified October 26, 2026. The website and private database publishing bridge are deployed. The owner-approved hosted research schedules are active, with saved connector access verified by an unattended timed rerun. The GitHub timer is configured; its first timer-triggered run has not yet been observed.

## Public website

- Live: https://samermetri.github.io/em-weekly/ ; public repository: https://github.com/samermetri/em-weekly.
- Astro/TypeScript static publication with responsive navigation, self-hosted Manrope/DM Sans, article search/topic/type/first-online date filters, pagination, article details, weekly archive, topics, methods, RSS, sitemap, canonical metadata and subpath-safe assets.
- Primary-source/DOI/PMID links open in a new tab. The AI/review label sits in the compact date metadata row. Promotional copy and the Why it matters banner were removed.
- Each article has Print / Save as PDF and Share. Native sharing has clipboard and selectable-link fallbacks. Suggested print filenames identify EM Weekly, article/date or covered week. The browser controls the final save dialog.
- Weekly digests include every public article added in their site-publication week, keeping first-online dates and catch-up labels. The latest sample contains all three historical sample articles, clearly identified as 2023–2024 evidence rather than a current literature review.
- All five current article printouts, including the two new normal records, were verified as one readable page each. Print uses an abbreviated author citation and omits the duplicate study-at-a-glance table while retaining summary, findings, limitations, recommendation strength, sources and review labels. The complete three-article sample digest occupies two clean pages, with no split entries or orphan page. No production PDFs are generated or stored.

## Validation and hosted deployment

- Twelve TypeScript unit checks: normalized identifier deduplication, rerun stability, LA/DST week boundaries, missed weeks, strict schemas, isolated checkpoints, deployment timestamps, complete weekly inclusion, and safe cloud-audit paths.
- Two Python checks: safe import paths/incomplete snapshot rejection and stable content hashes/deployment-state preservation.
- TypeScript diagnostics: zero errors/warnings. Build and 227 local subpath links/assets passed.
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

## Hosted scheduling and activation

The owner approved Allow Supabase for this conversation for the EM Weekly test and recurring editorial chats. That option was explicitly applied at the first actual daily article transaction and weekly unchanged sample-issue transaction, after the earlier low-risk probe tests. The weekly write preserved exact JSON equality and advanced sample issue 2026-10-26 from revision 1 to 2. Global app permissions and OAuth organization scopes were not broadened. Scheduler Advanced shows Same chat for every run, Pacific Time, GPT-6.1 Sol with Medium effort.

- The one-time 6:15 PM Clinical test completed after that approval: automation 6adff969411c819089b5520d659556a3, probe scheduled-2026-10-26 revision 1, https://chatgpt.com/c/6adffb86-b2d0-8333-8794-b86f3eb362e8.
- Daily hosted setup runs wrote revisions 1 and 2 without another prompt. Its subsequent clock-driven test completed without operator approval at 01:50:47 UTC, revision 3: https://chatgpt.com/c/6ae0035f-7e54-8326-98c6-a163fc0b0db4.
- The weekly recurring writer independently verified both primary sources and wrote/read its own probe at revision 2 without another prompt: https://chatgpt.com/c/6ae001ce-4128-8326-85c6-fcf080fe4039.
- Actions https://github.com/samermetri/em-weekly/actions/runs/40435205845 successfully imported, validated, browser-tested and deployed those exact revisions. Acknowledged snapshot: 331da6b83cd324bb403b197cde6648fde9bd8f4564bd62c156d0a40dc75c0633. That acknowledgement was triggered by an authenticated setup push, not by the GitHub timer.
- The strict database connection proof is saved in state/audits/cloud-connection-test.json. Supabase state cloudConnection is tested. config/schedule-control editorialEnabled was activated at 2026-10-27T01:56:00Z only after the deployed revision acknowledgement.
- Daily task 6adfff3a47a48190b358587a5d3bad35 is active at 02:00 America/Los_Angeles. Weekly task 6ae0005e79308190a4ccccb115a35a8c is active Monday 03:00 America/Los_Angeles. Both were restored from temporary setup-test times and verified in the scheduler UI. Their complete operational workflow and owner editorial requirements are saved directly in the task instructions, with database config used only as reference data.

Existing Clinical literature-brief and delivery-check schedules were preserved. No local heartbeat, paid API, credits, or paid fallback is used. The initial database-prompt bootstrap refused to execute fetched instructions during the first normal research test. Both saved tasks were corrected to contain the complete owner-supplied workflow and editorial requirements directly. The retried daily task accepted the instructions and began the September 27–October 26 initial search. The corrected weekly task independently passed its normal date/eligibility workflow: October 19–25 predates launch, so it wrote nothing; its first eligible issue covers October 26–November 1, scheduled November 2. The first normal daily run saved two current summaries (AAP pediatric UTI guidance and VASSPR), audit 2026-10-26 and publishing state revision 4. They passed deployment https://github.com/samermetri/em-weekly/actions/runs/40437503911. Unsupported topic tags and a publisher URL were corrected with dated history; supported topic IDs are now provided as config/topics reference data. The NCBI API was inaccessible in the hosted run, so four source checkpoints were not advanced and lastSuccessfulResearchCheck remains null. The final prompts now permit official, fully paginated PubMed HTML searches as a fallback; this fallback has not yet completed a hosted comprehensive search. Sample articles do not count toward the normal five-per-day limit. Historical samples remain labeled.

## Deployment timer observation

GitHub's active default-branch workflow contains the offset 15-minute cron 11,26,41,56 * * * *. Push and dispatch runs have succeeded, including the exact scheduled-writer probe acknowledgement above. At the last setup check, no event=schedule run had yet appeared in GitHub's run history. Do not describe this as an observed timer-triggered deployment until one actually runs. GitHub may delay scheduled starts; no exact delivery-time guarantee is made. The private database retains content while waiting for publication, and editorial tasks check the acknowledgement rather than claiming a database save is live publication.
