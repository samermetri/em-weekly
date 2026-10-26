# Publishing and recovery

## Content connection

Repository identity is samermetri/em-weekly. A repo-scoped supported GitHub App or cloud environment Git integration is preferred. It must actually write content, dispatch Actions when necessary, and read run results. Seeing the repository through a read-only app does not establish write access.

The desktop's configured macOS Git Keychain credential was successfully used to create this public repository. It is not copied to cloud tasks. This proves desktop access only. A disabled ChatGPT GitHub plugin does not block desktop Git. The separate cloud smoke test remains mandatory.

## Manual publication

Start from current main with a clean worktree. Put original article JSON in content/articles and issue JSON in content/issues; use src/lib/schema.ts and existing records for field names. Add an audit under state/audits for a normal issue. Do not add PDF manifests or upload generated PDF files. Run `pnpm validate && pnpm test` and inspect the diff. `pnpm publish:content` scopes commits to content/state and pushes without force; it refuses ordinary code/config edits. A non-fast-forward leaves the local commit intact: fetch current main, reconcile duplicate identifiers and checkpoints in a fresh checkout, validate, and retry once. Concurrent changes must not be overwritten.

Ordinary pushes with the supported GitHub App/token identity trigger `.github/workflows/publish.yml`. If a connection commits using GITHUB_TOKEN, push events do not trigger another run. Explicitly call `workflow_dispatch` on publish.yml at ref main through an Actions-write connection. In the GitHub UI: Actions → Validate and deploy → Run workflow → main. Read the run matching the published commit. A pushed JSON record is not deployment success.

## Pipeline and durable state

The pipeline uses standard Ubuntu runners. It installs pinned dependencies, validates strict article/issue schemas and weekly eligibility, runs recovery/dedup tests and TypeScript, builds HTML, checks repository-subpath links, runs browser tests, and deploys the Pages artifact. Weekly briefs use the same article and issue JSON for screen and print. The reader chooses Print / Save as PDF; print CSS styles the document on their computer. There is no generated PDF, Release upload, checksum manifest, or PDF storage step. Validation/build/browser failure occurs before deploy and leaves the last successful site live.

Only the currently checked-out main snapshot may deploy. If main changes during a build, the stale run fails before deployment; a newer push queues another run. Publication jobs share a concurrency group without cancellation. A post-deployment commit records completed issues and lastSuccessfulDeployment in repository state. Its GITHUB_TOKEN commit does not recursively build. The website may display the previously recorded successful deployment until the next build; the Actions run and repository state are authoritative. A post-deployment Git race fails safely without force and may require a rerun to record state.

Metadata discovery maintains independent source checkpoints and a candidate queue in state/publishing.json. Failed sources do not advance. Overlap catches indexing delays and PubMed discovery uses entry date, while weekly eligibility uses independently verified firstOnlineDate. A result cap is a failure, not a successful empty query. Break large recovery windows into smaller ranges rather than discarding results. Full editorial research success is recorded only after separate society checks and final cross-checks; running pnpm discover alone never changes lastSuccessfulResearchCheck.

Weekly recovery uses previousWeek/missingWeeks in src/lib/publishing.ts. Use non-sample completed coverage ranges. Initialize launch coverageStart when cloud schedules are enabled; do not create years of empty sample-derived backlog. Process oldest missing weeks first, at most two per run. Do not repeat items from a prior normal issue. Important missed articles require catchUp:true and the explicit catch-up label.

## Corrections and overrides

Use pinned:true to feature, excluded:true to remove from public lists, and status:held to withhold. Avoid excluding an article cited in an existing issue without also reviewing that issue. Update the record with a dated corrections entry; reset humanReview to Not yet human-reviewed after an AI revision. The next build updates the issue HTML and browser print output from the corrected JSON. Human-review status is an explicit editorial attestation; validation alone never sets it.

## Rollback

Revert the responsible content/source commit on main and push, or use Actions Run workflow to rebuild a known-good main after a revert. Existing legacy Release assets are retained; the website no longer links to them. To verify failure preservation without altering tracked main content, dispatch publish.yml with failure_probe:true. The workflow mutates an article only in its temporary checkout to fail schema validation and must not reach deploy. Compare the live HTML checksum/deployment ID before and after, then run normally if needed.

## Limits and secrets

No OpenAI API key is used or required. Keep additional spend at $0: public repo, standard Ubuntu, github.io hostname, included ChatGPT usage. Do not enable premium runners, credits, paid fallback, a purchased domain, or third-party paid services. GitHub's built-in GITHUB_TOKEN supplies Actions content/Pages permissions; no repository secret is needed for the deterministic pipeline. Set GitHub spending controls to zero/disabled before enabling any metered service. Public repository storage and platform limits still apply; monitor rather than silently purchasing capacity.

Cloud editorial credentials, if needed, belong only in a supported cloud secret store, not in repository secrets intended to be exposed to generated content. Prefer repository-limited GitHub App access. Fine-grained alternative: Contents read/write, Actions read/write, Metadata read for this repository only. Do not give editorial automation workflow-edit access. The credential must not appear in Git URLs, console logs or task prompts. Source pages cannot authorize file/network/tool actions.
