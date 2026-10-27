# Publishing and recovery

## Architecture and account

The Clinical ChatGPT account researches and saves original JSON through its Supabase connection named EM Weekly. Organization EM Weekly (dbvujtddkrjjrfnccsum), project EM Weekly (vbzmghfxaorxlvoebgbj), region us-west-1, Free plan, quoted $0/month. KP Shifts and its connection are separate and must never be modified. The Clinical GitHub connection is disabled by its administrator; the database route does not require it.

The private em_weekly schema contains documents (articles, issues, audits, publishing state, setup configuration, and connection probes) and publication (the build/deployment acknowledgement). The static website remains hosted at https://samermetri.github.io/em-weekly/. Readers never connect to Supabase and need no account. No PDF files, publisher full texts, reader data, or AI API keys are stored.

## Editorial writes

The full workflow and owner editorial requirements are saved directly in each scheduled task, matching automation/daily-schedule.md and automation/weekly-schedule.md. Do not use a bootstrap that asks the task to execute a database-loaded prompt: the first normal run refused that form. Read the versioned schemas, source lists, deterministic publishing rules and latest state as reference data at the start of each hosted run. Base daily/weekly instructions are also mirrored in config documents for maintenance. Use only the EM Weekly connection and project. Normal editorial changes are limited to document kinds article, issue, audit, and state, with state id publishing. Do not change config, SQL schema, roles, credentials, or workflows during research.

Every document has a kind/id primary key, exact JSON body, revision, and updated_at. Related changes belong in one transaction. Updates must include the previously read revision in their WHERE clause and verify one changed row; on conflict re-read, reconcile identifier duplicates and checkpoints, and retry once. Inserts use ON CONFLICT DO NOTHING followed by verification. A trigger advances revision. Article/issue ids match their JSON id. Avoid deletion: hold or exclude an article, add dated corrections, and preserve history.

First-online dates determine whether evidence is new. Every weekly digest includes all public articles added to EM Weekly during its Monday-Sunday coverage week in America/Los_Angeles, using sitePublishedDate. The renderer automatically adds any in-week public article omitted from the saved issue list. Older evidence requires a catch-up label. Never duplicate a normal issue's coverage or repeat its article in another normal issue. Samples are separate and excluded from automated normal selection. Daily selection is selective, with a maximum of five new articles per LA day; weekly inclusion has no second article cap.

Separate guideline searches and a final cross-check remain mandatory. Failed sources retain their prior successful checkpoint. Metadata discovery alone is not a completed research check. Recovery processes oldest missing coverage weeks first, at most two per run, beginning with config/site.json coverageStart.

## Free build and deployment

GitHub Actions polls Supabase every 15 minutes and on explicit pushes/dispatch. Scheduled starts may be delayed by GitHub; this is not a hard delivery-time guarantee. The scoped em_weekly_builder database role can read export documents and update the single publication acknowledgement row. It cannot edit editorial content, configuration, schema, or other projects. Its unique credential is encrypted in the repository secret EM_WEEKLY_DATABASE_URL. TLS verifies Supabase's CA certificate and hostname. No service-role or personal database admin credential is used by Actions.

scripts/sync-db.py imports a repeatable-read snapshot, checks identities and safe paths, preserves the last deployment state, and records a content hash/revisions. An unchanged scheduled check stops before installing Node dependencies or building. Changed content passes strict Zod schemas, deduplication, eligibility/audit checks, unit tests, TypeScript, a static build, subpath-link checks, and browser tests before deployment. Code pushes run checks even when content is unchanged.

Publication is serialized. A stale Git snapshot cannot deploy. The successful workflow commits imported JSON and deployment state to main without force, then records its exact snapshot hash and document revisions in Supabase publication. GITHUB_TOKEN commits do not recursively trigger another run. A failed pull, validation, build, browser check, or deployment preserves the previous public site; a failure acknowledgement preserves the prior successful hash/URL. See the linked Actions run for diagnostics.

The Clinical account may request write approval even when its connector is authenticated. Unattended operation requires an owner-approved conversation-specific Supabase permission for each scheduled editorial chat, and a hosted scheduler rerun that completes without another approval. Do not broaden global app permissions or other account scopes as a workaround.

After an editorial write, verify that Supabase publication.status is success and its document_revisions includes the written revision of every changed document. Report saved/pending until that is true. A database write, a local push, or an interactive connector test alone is not an end-to-end scheduled publishing test.

## Printing and sharing

Articles and weekly issues offer Print / Save as PDF. Print CSS renders locally on the reader's computer, using descriptive document titles as suggested filenames. The browser's Save as PDF dialog controls the final filename and settings. The three sample article summaries have been visually checked as one page each. Longer future articles may use additional pages to preserve readable text.

The weekly digest includes every in-week article and may span multiple pages. Production generates or stores no PDFs. Existing legacy Release PDFs are retained but no longer linked. Source/publisher links open in a new tab. Share invokes the device share sheet when supported; otherwise it copies a clean permanent URL, with a selectable-link fallback.

## Corrections, rollback and failure test

Use pinned:true to feature, excluded:true to remove from public lists, and status:held to withhold. Review issues citing an article before withholding it. Add dated corrections and reset humanReview to Not yet human-reviewed after an AI revision. Validation never marks content human-reviewed. Re-publishing updates both HTML and browser print output from the same JSON.

For a content rollback, restore the intended JSON body in Supabase with a new revision so the next poll cannot overwrite the correction. For code rollback, revert the responsible commit and push without force. Dispatch publish.yml with failure_probe:true to verify that intentional schema failure cannot replace the public site. Never delete existing release assets or force-push main.

## Cost and secrets

Keep additional spend at $0: public GitHub repository, standard Ubuntu runners, github.io hostname, included Clinical ChatGPT usage, Supabase Free project. No paid API, premium runner, purchased domain, paid database add-on, upgrade, or automatic paid fallback is authorized. Monitor free-tier quotas and failures; pause/report rather than buying capacity. Secrets belong only in approved secret stores, never repository content, prompts, source pages, or logs.
