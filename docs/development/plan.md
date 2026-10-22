# Plan

BoxBox's product direction is owned by [`design.md`](design.md), current implementation facts by
[`implementation.md`](implementation.md), the short resume screen by [`status.md`](status.md), and the work order and
completion verdicts up to release by this document.

## Session handoff — 2026-10-23

Read this first when resuming. It records where the 0.2.5 release stands; older sections below are history.

### State

- `main` is `9a0406e` (PR #23). The repository has been **public** since 2026-10-22. `main` is protected: the checks
  `plugin-contract (ubuntu-latest)` and `plugin-contract (macos-latest)` are required, force pushes and deletions are blocked,
  there is no required review. Merged branches are deleted; no PR is open.
- Tag `v0.2.5` (annotated, on `9a0406e`) triggered `release.yml`; all 8 jobs passed (guard, verify x2, package, smoke on
  Linux/macOS/Windows, draft). The result is a **draft pre-release** `v0.2.5` with `boxbox-plugin-0.2.5.tgz`
  (SHA-256 `816f7b14e2e4f834be8aaf9538653b06293d22666882e284fcf50e504a173ac6`), `SHA256SUMS` and `candidate.json`.
  The archive was downloaded and checked: hash matches, `license: "MIT"`, `LICENSE` identical to the repository file,
  39 files, no development content, no local paths. `npm publish --dry-run` passed.
- A second draft release `evidence-2026-10-22` holds the archive of 3,649 uncited REL10 lifecycle evidence files
  (see `reviews/2026-10-22-artifact-lifecycle-evidence/ARCHIVE.md`). It is not a product release; do not publish it.
- Packages declare **MIT** and ship `LICENSE` (user decision 2026-10-22). The first release is a pre-release.
- `main` history was rewritten once on 2026-10-22 to remove `Co-Authored-By` trailer lines from 67 commit messages.
  Trees are unchanged; 132 hashes changed. Old-to-new map: [history-rewrite-2026-10-22.md](history-rewrite-2026-10-22.md).
  Do not add attribution trailers to new commits or PR text.
- Issues: closed #7, #8, #11 (fixed by PR #14 with tests); open #6 (model/effort assignment; a pilot on 2026-10-22 did not
  support the shipped `sonnet` default, see the model section below), #9 (Python import tables), #10 (call-valued
  assignments split by callee), #12 (nested-repository hook baseline error), #13 (`-monitor` report proposal), #19
  (comma-terminated runs not reported as unsupported). Issues carry no labels and no title prefixes; the issue forms follow
  the Kubernetes layout and set no labels.

### Next steps (in order)

> **Decision needed before step 1.** The tag `v0.2.5` and the draft release archive pin the Claude inspector to
> `model: sonnet` (`product/models.json`, `selectedBy: unevaluated-default`). A pre-registered pilot did not support that
> default (see [Model and effort assignment](#model-and-effort-assignment-and-the-usage-report-issues-6-and-13)). The
> release is still a draft and nothing is on npm, so changing it costs a rebuild; after publication it costs a new version.
> Options: publish as is, or remove the model line (the inspector then follows the caller's model) and rebuild before
> publishing. The owner decides; nothing here changes the tag.

1. **npm publication (user, needs login and 2FA).** Not yet done; `npm whoami` returned E401 here.
   ```text
   cd /tmp && gh release download v0.2.5 -R Woo-JongHo/boxbox -p 'boxbox-plugin-0.2.5.tgz' --clobber && shasum -a 256 boxbox-plugin-0.2.5.tgz
   npm login
   npm publish /tmp/boxbox-plugin-0.2.5.tgz --access public
   ```
   The hash must equal the SHA-256 above. This publishes the same bytes as the GitHub release. `boxbox-plugin` was free (E404).
2. **Publish the GitHub release** (`gh release edit v0.2.5 --draft=false`; the pre-release flag stays).
3. **Verify after publication:** `npm view boxbox-plugin`, and `npx boxbox-plugin` in an isolated directory and home.
4. **Update the install text** in `README.md`, `README.ko.md`, `README.zh-CN.md` together (the status paragraph and the
   "Install the plugin" section still say publication is pending) and in `product/installer/README.md`. Keep
   `test/readme-parity.test.ts` green.
5. **Refresh stale documents:** `status.md` still describes 0.2.4 with old hashes; this plan's READINESS1 phase table is
   historical. Add a short checklist document and link it from `README.md` here (proposed, not created).

### Open verification debt

- R5 candidate rerun identity (issue-library record `BBX-20261022-019`, status `verifying`): the independent review and a
  real hosted smoke-only rerun measurement are not done. The workflow change itself is merged and the first tagged run passed.
- Authenticated host acceptance (Claude Code and Codex UI and hook events) is not established.
- Hook checks report two files as not aligned: `product/engine/common/code-text.ts` (one group) and
  `test/fixtures/python/tables.aligned.py` (four groups; possibly the new `NAME : type` colon rule). They belong to the
  chacada side; the fixture is a golden file, so decide before re-aligning it.

### Model and effort assignment and the usage report (issues #6 and #13)

Work of 2026-10-22, all on `main`. Record: issue-library `BBX-20261022-020` (model and effort) and `BBX-20261022-021`
(`-monitor`), proposals [model-effort-assignment](proposals/2026-10-22-model-effort-assignment.md) and
[boxbox-monitor](proposals/2026-10-22-boxbox-monitor.md).

**Built**

- `product/models.json` is the one source of model and effort per AI-judgment role and host; `bun run sync:plugin` stamps
  the Claude plugin agent and, in place, the development Claude and Codex agents (`development/tools/model-assignments.ts`).
  Validation refuses the `author` role, an unlisted model and an unsupported effort. The Codex plugin manifest ships no
  agents, so Codex values reach only the development definition.
- The engine returns more of what an agent used to judge: `guide --authoring` adds `columnSets` and `axisNotes` (TypeScript),
  and `check --expect-axis <axis>` returns `axisExpectation` (covered, missing, unknown) without changing the exit status.
  The authoring response grew from about 2.4 KB to 8.3 KB; whether agents read less documentation because of it is unmeasured.
- `development/tools/session-usage.ts` reads a Claude session record plus its subagent records into tokens by model,
  effort, BoxBox step and hook event; `development/tools/score-inspector-report.ts` scores an inspector report against the
  engine's own `check`. Both are development tools, not shipped.

**Measured**

- Baseline of four fresh Windows sessions on the inherited Opus (check, write, align, inspector): 0.31 to 0.34 USD each, 0.51 USD
  for an inspector request on a three-line file. BoxBox hook text was about 1,000 estimated tokens in a 94-turn real session,
  negligible against context re-reading.
- Pre-registered pilot, Sonnet inspector against the inherited one, 6 runs on a 228-line file with engine ground truth
  ([protocol](reviews/2026-10-22-inspector-model-pilot/PROTOCOL.md), [results](reviews/2026-10-22-inspector-model-pilot/RESULTS.md),
  [log](reviews/2026-10-22-inspector-model-pilot/LOG.md)): mean printed cost 0.611 against 0.724 USD (ratio 0.84, the rule needed
  at most 0.70, so **not met**), about twice the subagent turns and 1.7 times the wall time. The strict recall measure returned 0
  for every run because it could not read Korean reports; it decided nothing. Three runs per condition on one file: descriptive only,
  advice quality not graded. The six runs cost 4.0053 USD on the owner's account (5.49 USD with the baseline).
- **Errata:** output tokens in subagent session records are lower bounds (4.3 to 8.6 times low in the pilot); input and cache
  figures are exact. The first baseline table and the usage reader were corrected. A usage page must label that figure.

**Open decisions (owner)**

1. The inspector default above: keep `sonnet`, remove the model line (recommended on this evidence), or evaluate more (Haiku too).
2. May the installer write one BoxBox-owned file under `~/.codex/agents/` so Codex gets a model and effort? Without it Codex gets
   a documentation recommendation only.
3. Pass criterion and budget for a larger evaluation (more files, a scorer that reads the reports, human grading of advice).
4. `-monitor`: product command or development tool only; whether file names are hidden by default; whether a Codex page ships first.

**Next steps (in order)**

1. Settle decision 1 before publishing (callout above); if the model line goes, edit `product/models.json`, run
   `bun run sync:plugin` and the focused tests, and rebuild the candidate.
2. `-monitor` step 1: baseline v2 in `lifecycle-hook.ts` (bytes, lines and a whitespace-insensitive hash for supported files,
   readable alongside the old string shape) and a measurement of its size; then `boxbox monitor --json`, the HTML renderer and the
   `-monitor` skill argument. Acceptance criteria are in the proposal.
3. Larger inspector evaluation only after decision 3. Reproduce a run with
   `docs/development/reviews/2026-10-22-inspector-model-pilot/run-helper.ps1.txt` and `analyze_pilot.py.txt`.
4. Codex session reader after a sanitized real rollout fixture exists (the rollout format has `token_count` events; no reader yet).

**State left on chacada by this work.** `boxbox` 0.2.5 is installed for Claude Code (user scope, from CI archive `5fe739f5…`) with
a backup of the Claude settings in `Downloads\BoxBox\0.2.5\ci-39732919128-1-5fe739f5\claude-before-install`; test folders
`try-claude` and `inspector-pilot` under `Downloads\BoxBox\0.2.5`; raw outputs in `%TEMP%\bbx-sessions` and `%TEMP%\bbx-pilot` (the
latter holds `agent.orig`, the installed inspector definition, which was restored and hash-checked after the pilot); the archive
staging copy `/tmp/boxbox-0.2.5-ci-5fe739f5` in WSL. On the maintainer's Mac, `~/.claude/settings.json` still has a `statusLine`
pointing at the removed 0.2.3 HUD script; it works only while that old version folder exists.

### chacada (company desktop, WSL2)

Repository: `/mnt/c/Users/woo/woo/00_project/boxbox`. Its branches (`main`, `feat/matrix-first-readiness`,
`fix/python-grid-gaps`) have no commit missing from the rewritten `main` (compared by patch) and its worktree was clean.
After checking that no Codex session is mid-work there, run `git fetch origin && git switch main && git reset --hard origin/main`
and delete the old branches. **Never `git pull`**: it would merge the old history and bring the trailers back.

### Other open decisions

- npm trusted publishing from Actions (not configured), a `boxbox update` command, `SECURITY.md` and private vulnerability
  reporting (disabled), moving the remaining `*-evidence` folders (about 11 MB) and 45 Korean development documents out of
  the tree, and the optional GitHub Support request to purge the old PR commit refs.
- The maintainer's Mac data volume was 100% full (about 330 MB free); this caused one `ENOSPC` test failure.
  Free space before running the full check.

## Completion loop — READINESS1 (2026-10-21)

**▶ active.** The user authorized a documented plan followed by autonomous development, verification and repair
loops covering the remaining requirements, including broad pattern management. This authorization supersedes
per-file/per-task feedback waits for reversible work. Keep exactly one active parent task; independent subtasks
inside its current phase may run in parallel with explicit file ownership. Existing evidence below remains historical.
The product goal is consistent, explainable treatment of comparable structural roles across diverse situations,
with explicit exceptions; matching punctuation alone does not establish equivalent roles.

The preceding GLM critique is recorded in [pattern-management review](reviews/2026-10-21-pattern-management.md).
Accepted concerns: bounded group candidates before policy selection; visible equivalence/key normalization;
no duplicate policy authority; approval separate from per-write safety. Corrections: `gap: "blank"` is not universal,
SQLite-to-JSON export contradicts a JSON-authoritative derived index, and a 5,000-rule threshold has no measurement.
The review's AST-hash proposal cannot replace token preservation, syntax acceptance or horizontal-only Align checks.

### Requirements and completion evidence

| Phase | Work and responsible surface | Completion evidence | State |
| --- | --- | --- | --- |
| R0 | Reconcile requirements, broad pattern taxonomy, decision contracts and this execution order | Source-linked design, support/exception matrix, scoped independent critique | reviewed |
| R1 | Runtime record validation, alias portability infrastructure and pattern catalog | Negative record cases, isolated copy resolution, dependency-escape checks, validated catalog covering nine families | reviewed |
| R2 | Bounded data-driven policy experiment, consistent Check/Guide lookup and syntax reporting, authoring coverage | Existing approved rule remains byte-identical; unknown/conflicting policies refuse; layered lookup and syntax regressions; diverse positive/negative authoring cases | Python projection source/GLM and local/native Windows `2b43d24…` verification passed; new rule approval pending |
| R3 | JSON/YAML safe adapters and shared lifecycle; new convention proposals | Strict syntax, source-range edits, comments/scalars preserved, idempotence, installed preview/apply/refusal, reviewed before/after and counterexamples | implementation verified; human decisions pending |
| R4 | Complete internal alias migration, native host/HUD and supported-platform validation | No unintended relative internal imports; self-contained copy/bundle execution; native output acceptance and accurate HUD state; recorded Windows limits | aliases reviewed; local/native Windows engine and Codex upper/HUD/hooks passed; Claude statusLine passed; Claude/current Windows hooks remain open |
| R5 | Release integration, documentation and public payload hygiene | Full check, independent review/GLM closure, generated drift check, same-archive CI/OS journeys, EN/KO/zh-CN consistency, clean public payload, concrete publication prerequisites | Source `66eb978` PR/source CI passed both OSes; exact CI `ebfe6a…` passed six native core/four HUD cells and Linux/Windows hosted smoke; hosted macOS smoke queued; decisions/publication remain open |

R1's independent catalog, validation and installer work may run concurrently; broad engine import rewriting waits
until concurrent engine edits settle. R2/R3 share CLI/pipeline ownership and are integrated sequentially. Full build and
installed-artifact suites run against a frozen candidate, not while other agents mutate packaging inputs.

### Ownership, thresholds and evidence states

| Subtask | Author and owned paths | Excluded paths |
| --- | --- | --- |
| Record validation | Codex validator worker: `common/conventions.ts`, `common/examples.ts`, a validation helper, focused record tests | CLI, format pipeline, installer, approved preset |
| Alias infrastructure | Codex alias worker: `development/install.sh`, `development/tools/check-layout.ts`, development-skill tsconfig, focused layout/install tests | Engine import conversion, package metadata, live host profiles |
| Pattern catalog and integration | Main Codex agent: pattern documents/catalog/module/tests, plan/status, later shared CLI/pipeline integration | Other workers' owned files until handoff |
| Review | Sonnet/GLM: read-only supplied snapshots or scoped source | All production writes |

Before an edit, each worker saves the target's existing bytes under `/tmp/boxbox-readiness/` and patches the current
worktree; no stash/reset/checkout may discard user changes. The main agent retained the tracked pre-implementation
diff there. New untracked source is preserved by per-file snapshots, not assumed to be in Git.

R0 passes when all nine family rows in `pattern-management.md` have decision dimensions and the plan has no open
mandatory review finding. R1's catalog must have nine families, each with comparable, different-role and declared
unsupported examples; nested/separation scenarios are identified per family. Supported claims link to actual engine
or test evidence; proposals remain labeled. R1 also requires negative record tests and isolated alias execution.

Track implementation as `proposed`, `implemented`, `tested`, `reviewed` independently of rule authorization
(`candidate`, `approved`, `rejected`). A reviewed implementation does not promote a candidate rule. Only human-approved
rule data may authorize public automatic writes. Unsupported patterns can be reported but never advertised as fixed.
After three repeated unsuccessful attempts at the same failure, record the evidence and reassess the cause or use
an independent review rather than blindly retrying. Continue other authorized work; declare a blocker only when
progress actually needs a named external prerequisite. Preserve the user's existing commit/push/SSH delivery scope;
new destinations, public publication and persistent host trust require concrete authorization. Isolated temporary
verification directories are part of the authorized local tests.

### Design and authority decisions for the first implementation

- Model imports, declarations, function signatures, calls/chains, branches/exits, object/type members, arrays,
  operators and structured JSON/YAML documents using one decision vocabulary. Track coverage, unsupported cases,
  examples, counterexamples and source/version provenance; a catalog entry is not an approval.
- Language adapters expose bounded structural candidates and supported axes. Rule data selects only implemented,
  tested policies. Parser interpretation, safe edits and preservation remain code-owned. No arbitrary executable
  rule scripts, forced semantic equivalence or automatic statement reordering.
- Keep approved JSON/JSONL as the single canonical approval authority during the migration. A useful SQLite
  development index may be built from canonical records/corpus evidence with one-way reproducible import;
  it cannot author approvals or overwrite their source. Runtime SQLite is not required unless measured runtime
  needs justify it. This preserves a central rule knowledge model regardless of its physical storage format.
- Write/Refactor may change structure within scope and need behavioral evidence. Align changes approved horizontal
  whitespace only. Import aliases are Refactor changes. Blank lines are contextual policy, not a newly approved
  universal delimiter. The single-word earlier message did not choose a global blank-line rule.
- Existing two public conventions and four CC0 examples retain their exact approval/license scope. Prepare new
  rules as reviewable proposals, then request human approval for each bounded group before shipping it as approved.
  Continue independent work while required decisions are pending. Do not fabricate approvals or transfer old keys.
- Preserve all existing working changes. Do not publish a registry package, change repository visibility or grant
  persistent host trust merely because local tests pass. Prepare concrete artifacts and identify the actual final
  authorization or external credential needed. Earlier authorized SSH delivery/commit/push scope is retained;
  release publication remains distinct from development and candidate verification.

### R2 follow-up — Python outer assignment columns (2026-10-22)

Authenticated native Write and Refactor used the exact installed 0.2.4 candidate and preserved the requested
calculation behavior over 180 input combinations each. However, `subtotal = unit_price * quantity`,
`discounted = max(0, subtotal - discount)`, and `total = discounted + shipping` produced zero detected groups.
The shared engine requires identical detailed signatures; the middle call is outside the Python scalar-call
profile. Zero groups does not satisfy the requested common assignment columns.

Follow the [source-linked implementation design](proposals/2026-10-22-python-assignment-envelope.md).
Implement a bounded Python opt-in outer projection for consecutive, same-indent plain assignments whose
right-hand expressions remain opaque and byte-identical. Preserve existing detailed tables as their sole
row owners; do not merge through a detailed table, blank line, comment-only line, continuation or unsupported
statement. Use a distinct exact axis/key so the existing simple-assignment approval cannot authorize the
new detector. Keep the current Python minimum of three rows. Public writes remain unapproved until a separate
concrete proposal is reviewed and accepted.

Execution order: document the source-linked design → reproduce the actual native fixture in a failing test →
implement shared optional projection and Python bounds → verify old detailed groups, continuation refusals,
RHS/indent/newline preservation, fixed points and exact approval isolation → independent source review →
full check and rebuilt artifact verification. The old archive and source audit do not cover this new change.
The first implementation deliberately excludes rows already owned by a detailed table, even when their outer
assignment role could match neighboring rows; nested overlapping alignment is a separate design question.

The later local `2b43d24…` archive passed independent installed verification for the exact unknown key, existing
approved rules, 180-case behavior and bounded native host surfaces. The scoped GLM static source review and exact-archive SSH/native Windows verification subsequently passed. That remains local-development-candidate evidence and is separate from the later source-`35b6178` CI candidate, whose single archive passed Ubuntu/macOS/Windows engine smoke. Public approval gates remain open.

### R5 follow-up — exact-artifact lifecycle (2026-10-22)

A completion audit found REL10 still executable without pending model authentication or rule decisions. Fresh
three-OS engine smoke does not cover real host update, rollback and removal. Follow the
[exact-artifact lifecycle plan](proposals/2026-10-22-artifact-lifecycle.md) using retained 0.2.3 `f07df7…` and CI
0.2.4 `bec626…` archives in disposable profiles. Verify actual host registration/version, post-transition engine
behavior, configuration/approval-data preservation, documented removal residue and supported HUD ownership handoff.
Keep Linux/WSL, native Windows and macOS evidence distinct. Authentication-dependent host UI/hooks remain separate.
This is the current reversible R5 subtask; no new public approval, live-profile change or publication is authorized.

The first Claude cells exposed stale installed-version metadata after a successful marketplace move. The correction
now checks ownership before copying, refreshes the exact scoped registration when necessary, verifies the installed
identity and retains recoverable files after possible partial host mutation. Source review and GLM review closed
mandatory findings; the full local check passed 672 tests with five existing parser skips and zero failures.
The new local `1f1343e9…` archive passed all six core host/OS lifecycles and four supported macOS/WSL HUD
configuration ownership cells, with independent evidence reviews. A clean-source CI candidate follows with separate
exact-byte evidence. The historical
0.2.3 fixture still requires explicit manual rollback for Claude; no automatic rollback guarantee is introduced.

Final source `66eb978` has passing ordinary PR checks and clean candidate verification (677 tests on each OS).
The exact CI archive `ebfe6a7796d9d85e9cf3088c955df4fb5477e60513e8ebda97d517746d93c665` passed all six
native core and four supported HUD configuration cells with independent review, and was delivered to a new chacada
folder with matching WSL/PowerShell hashes. Linux/Windows hosted smoke passed; hosted macOS smoke remains queued.
The public payload audit and corrected release/user guidance passed. See the
[bound final matrix](reviews/2026-10-22-artifact-lifecycle-evidence/README.md#final-clean-ci-candidate).
No further product implementation gap was identified in the bounded first-release audit. Complete the queued CI job
and final record reconciliation; new rule/example, artifact license, authentication and publication gates remain open.

### R5 follow-up — candidate partial-rerun identity (2026-10-22)

Attempt 1 of candidate run `39646320662` and docs-head PR run `39649400680` ended with
macOS runner-acquisition cancellation before any job steps. Their failed jobs were rerun as attempt 2.
The candidate consumer also has a separate reproducible design defect: it constructs the producer's
artifact name from the consumer's current `github.run_attempt`. A smoke-only rerun therefore requests
attempt 2 although the successful package job uploaded attempt 1.

Bind future consumers to the upload action's immutable artifact ID through a package job output.
Reject missing or malformed IDs and digests before downloading; flatten the one ID-selected artifact
into the existing candidate directory. Keep all three OSes, the independent archive SHA check and
per-attempt evidence names. Regression tests must execute the actual workflow guard and check its
producer/consumer wiring. Independently review the change, then measure a real smoke-only rerun
without rebuilding. Missing replayed outputs must fail closed. Source patches cannot repair old runs
retrospectively; preserve their results and distinguish any explicitly bound recovery evidence.

### Loop and completion gate

For each phase: inspect current behavior → write the smallest implementation → run meaningful targeted tests →
record failures and corrections → independent read-only review → fix mandatory findings → advance automatically.
Use Codex for authorship, Sonnet for independent checks where available and GLM for the requested final critique.
Save complete reviews and command evidence under `docs/development/reviews/`; searchable issue records retain
unresolved work. Do not classify advisory structural guidance as deterministic coverage.

At the integration gate, run `bun run check`, generated-plugin validation, the local plugin guard and installed
archive scenarios. Add relevant CI checks rather than relying solely on local success. Record skips and missing
host evidence separately. Completion requires each requirement above to be implemented and verified, or explicitly
identified as waiting for a concrete user/external prerequisite; prerequisites do not count as completed work.

## Current goal and plan status

**User goal (2026-10-04): finish implementing this service to the point of a real release.** The first public scope is
**TypeScript, Python, JSON and YAML + the engine CLI + a thin agent plugin**, following the user's scope expansion
on 2026-10-21. The current source CLI accepts all four languages; JSON/YAML write rules are candidate proposals awaiting human
approval. The native HUD entry-point defect was corrected. The local `2b43d24…` archive passed the Python
common-column detector boundary and reached the authenticated Codex upper prompt, with disposable trust cleaned after
an independent finding. Scoped GLM source review and SSH/native Windows verification passed; current macOS Codex hook acceptance passed. Source `66eb978` PR/source CI verification passed; exact clean CI `ebfe6a…` passed all six native core/four HUD configuration cells and Linux/Windows hosted smoke. Hosted macOS smoke remains queued. Claude/current Windows hook acceptance, public rule/license decisions and publication remain open. The existing
10-language engine is kept, but equivalent product quality for Java, Go, Rust, JavaScript, C, C++, Swift and Kotlin is
not a completion condition of the first release.

There are two release artifacts, as in the existing design.

1. The `boxbox` engine CLI package: people, CI, hooks, editors and agents call the same `check`, `format`, `init`, `doctor`
   contract. The current test invocation uses the locally installed `boxbox` tarball; registry execution is blocked pending ownership. Node/npm artifact behavior is settled in REL3
   by an artifact install experiment.
2. A thin agent plugin: contains only `SKILL.md`, a read-only inspector, host manifests and hook adapters, and
   calls the engine CLI. Only one set of engine and rule data is shipped.

The mandatory user journey of the release is reproducing this order in a clean environment.

```text
install → boxbox init → boxbox doctor → boxbox check → boxbox format → boxbox check
     → the same engine call from a supported host → update → recheck → uninstall
```

`format` aligns approved tables directly by default. If a project formatter is configured, it runs first and BoxBox runs last. Automatic fixes are allowed only when the installed parser,
human-approved rules and the pre/post-write safety checks all pass. If any step is unclear, it only
reports and does not write the file.

This plan is an **authoring draft**. The first public scope was confirmed on 2026-10-04 and expanded by the user on 2026-10-21. Work order,
completion criteria and technical decisions are not considered confirmed until independent review, rebuttal, traceability checks and user acceptance.
The combination of supported OSes and first supported hosts is settled in REL1. Claude Code and Codex are the initial host candidates,
but this is not a confirmed support table yet. For the product name, license and public channel, REL1 records who decides and by when,
and they are settled before the REL11 freeze.

### Verification scope of this session — user decision (2026-10-04)

At first the user asked to skip a separate audit due to token limits, but later asked another model, Sol, to verify
the public data boundary. Sol, read-only, pointed out nested schemas, paths and symlinks, duplicate JSON keys,
the `example.rules` array, and exposure of sibling sections of the decision's approval document. After the fixes, the final re-review found no
further findings in this scope. The record is in the [DB boundary review](reviews/2026-10-04-public-preset-db-boundary.md).
This is a limited review of the public preset boundary and does not replace a final audit of the whole repository or a Claude Sonnet 5 / Opus
review. The requirement of full verification before release stays.

## Current evidence and limits of interpretation

- Per the code comparison in [`implementation.md`](implementation.md), there are per-language development Bun scripts and a separate Node public CLI.
  `init`, `doctor`, `check`, `guide`, `format`, the config layers, the approval gate and the formatter pipeline are implemented.
- `development/install.sh` tests local linking/copying and removal, but does not guarantee independent dependencies of a copied skill, hook registration,
  package updates or public artifact installs. `package.json` is still `private: true`.
- The shared scope of the safety gate is `06_align-tables.ts`. REL2a blocked writes in the shared engine when the parser is missing or fails to run.
  `00_normalize-imports.ts`, `00_expand-interface-members.ts`, `07_wrap-conditions.ts` and `08_function-map.ts --write`
  do not share the same gate. M1's "every write" and 169 tests from 2026-09-28 are records of that time
  and do not mean a guarantee over the current full write surface.
- The historical full machine verification record was `403 pass / 5 skip / 0 fail`, reconfirmed on 2026-10-06; later delivery results are recorded below. Reruns that day
  hit the default 5-second test timeout in 1–3 tests per run (each passed alone), due to the load sensitivity of integration tests that start
  real toolchains (javac, tsc, formatter child processes), so the `test` and `check` scripts got `--timeout 60000`.
  The two isolated artifact install tests have a separate precondition: `npm install --offline` needs `typescript@7.0.2`
  in the npm cache. Skips and unmeasured real hosts are not counted as release passes.
- The approval proof is connected to public format and GUIDE. The recommended preset now contains the two rules approved on 2026-10-21, four synthetic examples and two decisions (FIRSTUSE1 below). Other candidates remain unapproved. The existing raw writers bypass the approval policy, so they are excluded from the public artifact.
- AI model evaluation is a research tool, not a product execution path. The full E1 model evaluation, SQLite and equal quality across 10 languages
  are explicitly on hold and are not automatically promoted to first-release blockers.

## Execution discipline

Status legend: `⬜ todo` · `▶ active` · `✅ done` · `⏸ blocked/on hold`.

1. READINESS1 above is the active parent task and owns the current phase. The following is the pre-loop status: DOC1 documentation/process/storage audit is complete. The current active task is AUTHOR1, authorized by the user on 2026-10-21; HUD2 is deferred pending independent review. CODEX1 remains open: controlled native Codex evidence is audited, while Windows edit-dependent events remain blocked by native policy. DELIVERY1 issue/PR/candidate automation and installed BoxBox status are verified and accepted for continuation. FIRSTUSE1 implementation/delivery and LAYOUT1 audits are verified. Persistent trust, Claude event delivery, CODEX1 registry verification, DATA2 and PKG1 public release work remain open.
2. Each REL becomes a completion candidate only with prerequisites, current implementation, remaining work, acceptance criteria and verification evidence.
3. **Existing** in verification means it is checked with a command that exists now; **new** means the verifier must first be
   implemented in that REL. A command name appearing in the plan is not evidence.
4. On 2026-10-04 the user directed "keep going". After a verified implementation, continue to the next step without asking for
   acceptance at each step. Reversible implementation and local verification are included in this approval. Actions needing a separate decision, such as the product name, license,
   human rule approval or a public publish, are not considered approved.
5. Implementation complete, plan accepted, final audit and public release are different states. Never say "released" before a tag, push, registry publish and a real
   external install check.

## Active task — AUTHOR1 matrix-first workflows

**Carried into READINESS1 — user authorized implementation of Write, Refactor and Align with shared Check and preview (2026-10-21).**

User clarification (2026-10-21): the plugin should guide code generation into readable rows and columns, then
verify the result, with correctness and performance preserved. See the [authoring direction](design.md#authoring-direction-clarified-on-2026-10-21).
The 0.2.4 source candidate adds `guide --authoring` for existing, empty and not-yet-created files and a
standalone `align` command for approved horizontal layout changes. Write and Refactor remain agent-owned workflows;
the CLI does not generate code or certify their behavior/performance. Ordinary `guide` and the existing `format`
pipeline remain available. Implementation checks and installed-artifact verification passed; Sonnet 5.5 passed after the initial session-limit blocker. The user selected GLM instead of Opus for final audit;
GLM 5.3 passed its read-only final audit with no mandatory fixes. AUTHOR1's bounded implementation is verified;
the task remains active for the broader evaluations below. This is not a publication verdict. See [the user workflow contract](../user/modes.md) and [recorded evidence](reviews/2026-10-21-authoring-modes.md).

Verification commands: `bun run check`, `bun run sync:plugin`, the local plugin guard, and `bun run pack:installer`.
The full check completed with 554 passes, 5 existing missing-parser skips and zero failures. Three independent source-skill
scenarios and both isolated installed launchers passed within their recorded scope. Broader automatic skill activation
and authoring-quality evaluations below remain unmeasured; they are not implied by CLI or packaging success.

Acceptance work:

- Provide applicable approved guidance for new/empty files without requiring an existing matching table.
- Keep generation examples and checks tied to the same rule identities and approval proof.
- Preserve line structure, indentation and non-layout content in standalone Align; execute no external formatter.
  Refuse broader engine proposals without falling back to `format`, raw writers or agent structural edits.
- Verify preview keeps the target unchanged, explicit mode routing, and continuation through user-authorized files
  one at a time. Keep existing `guide`, `check` and `format` behavior compatible.
- Separate mechanically enforceable layout from advisory structural decisions; missing/unsupported patterns must
  not become evidence that the requested authoring style was achieved.
- Evaluate real agent tasks: new-file generation, extending an existing table, an overlong function/call, and a
  case that should remain structurally different. Check both correct skill activation and non-activation.
- Verify behavior after structural changes and measure performance when the changed work requires it. Do not
  treat an alignment check as a semantic or performance certificate.

### Matrix column follow-up — user correction, 2026-10-21

AUTHOR1 now includes the explicitly requested return-start columns across intervening processing in a block,
outer call parentheses shared by different callees/arities, and a local Refactor of `Example` so nested object types
form lower independent tables. Runtime evaluation order stays fixed. The guard grouping must cover the actual
`subjectCall`, `subscriptPartsOf` and `callLayer` examples, including their intervening loops and preparation.
New kinds use distinct lookup keys and do not inherit the existing recommended preset's write authority.
Acceptance: exact output and scope-barrier tests, preservation, syntax checks, idempotence, installed Check,
unchanged existing approved-key behavior, real-source application and independent Sonnet/GLM review.
GLM replaces Opus for this session at the user's request.

The follow-up also includes the final receiver/method dot, exact guard-row report membership and a searchable
[issue library](issue-library/README.md). The [matrix review](reviews/2026-10-21-matrix-columns.md) records the
failed intermediate checks and their corrections. These changes do not approve additional public preset keys.

Broader long-row transformations and additional approved conventions remain separate decisions.
The workflow authorization does not approve new preset rules, automatic structural rewrites or public publication.

### Import alias follow-up — user requirement, 2026-10-21

The user requested consistent configured-alias imports, including BoxBox's own code. The authoring skill now
directs Write/Refactor to use configured aliases where resolution is verified and the project contract permits them;
Align remains whitespace-only. READINESS1 migrated 169 internal specifiers across 57 engine files, shipped a
copied-skill resolver, checked package boundaries and verified copied-source plus installed-bundle execution.
`@/*` retains its engine-root meaning. One rules JSON static import and three runtime-relative URLs remain intentional;
external packages and `node:` specifiers are unchanged. The [alias report](reviews/2026-10-21-readiness-loop-evidence/alias-final-report.md)
records the exact inventory and three pre-existing development-language alignment refusals. Final GLM source review and supplementary closure passed.
See [issue 008](issue-library/records/BBX-20261021-008-import-alias.json).

Acceptance checklist retained from AUTHOR1 (implementation, local checks and final GLM audit passed):

1. Inventory static, type-only and literal dynamic internal imports, resolver boundaries and public entry points.
   Preserve external packages, `node:` specifiers, evaluation order and paths that cannot be proven equivalent.
2. Make source aliases portable through both isolated development copy installation and bundled CLI/installer
   execution. Update the product dependency checker, its tests and the repository convention together; keep checks
   against product imports escaping into development. Retain the existing `@/*` meaning unless a migration requires
   an explicit configuration change; do not replace it with machine-specific absolute paths.
3. Migrate internal imports one authorized file at a time, retaining behavior. Verify type checking, relevant tests,
   bundle inspection and isolated source-copy plus installed-archive execution without the root `tsconfig.json`.
4. Record residual exceptions and independently review the final resolver/import changes. Do not claim completion
   from visual import alignment or a source-only type check.

## Planned scope expansion — FORMAT1 JSON and YAML

The user requested JSON and YAML alongside TypeScript and Python for the first open-source plugin release,
including configuration and structured documents used in AI workflows. This approves the target formats, not
specific alignment conventions, examples or licenses. READINESS1 owns current implementation and verification.

Current implementation: dedicated JSON/YAML adapters use strict parsing and source ranges through the shared
Check/Guide/format/Align pipeline. Installed checks and refusal paths passed locally. Default write-rule approval and
example licenses remain pending; same-archive multi-OS validation and final audit are still required.

Bounded implementation and acceptance checklist:

1. Define representative before/after cases and refusals for strict `.json` and `.yaml`/`.yml` files. Start with
   adjacent sibling key/value rows; exact grouping, row floors and spacing await rule review. JSONC/JSON5,
   Markdown frontmatter and fenced blocks are separate scope decisions, not implied support.
2. Use format-aware parsing and source ranges to identify editable horizontal whitespace. Preserve tokens,
   scalar spelling/content, key order, indentation, line breaks and comments. Protect YAML block scalars;
   initially skip complex keys, anchors/aliases/tags and other unproven structures with explicit reasons.
   Do not round-trip through a generic object serializer to implement alignment.
3. Connect adapters to the shared inspection, approval, candidate verification and commit contracts. Update
   CLI/config language dispatch, result consumers, hooks and guidance together; retain the same engine for both hosts.
4. Verify syntax, preservation, idempotence, no-write preview, invalid/unsupported input handling and optional
   formatter coexistence. Exercise the installed archive on macOS/Linux/Windows before advertising support.
5. Review proposed conventions and examples before adding approved preset data. Update support claims and
   localized READMEs only to match implemented and verified behavior.

Syntax validity does not validate an application's schema: valid YAML does not prove a GitHub Actions workflow
is accepted, and valid JSON does not prove a host configuration is supported. Application-schema checks are a
separate capability. JSON uses strict `JSON.parse`; YAML uses pinned `yaml@2.9.1`, YAML 1.2 core, with duplicate keys and unresolved/forward aliases rejected. Flow collections, anchors/tags and multiline scalars remain unmodified unsupported layout.

References: [JSON RFC 8259](https://www.rfc-editor.org/rfc/rfc8259),
[YAML 1.2.2](https://yaml.org/spec/1.2.2/). This section distinguishes implemented scope from pending approval and cross-platform acceptance.

## Deferred task — HUD2 visible terminal status

**⏸ deferred pending independent review — user requested persistent BoxBox visibility in Codex and Claude (2026-10-21); AUTHOR1 is now active.**

- Implement a shared installed-runtime collector, Claude official statusLine and an explicit Codex tmux companion launcher.
- Keep host trust unchanged; label latest-project observations separately from current-session receipts.
- Packaged installation, settings preservation, real Codex/Claude terminal rendering, state changes and cleanup have been measured. Sonnet and fixed Opus review attempts returned session limits; independent review remains an unexecuted acceptance blocker.
- Terminal CLI is the working scope. Desktop and Windows HUD behavior are not assumed. Ordinary `codex` is unchanged.

## Completed task — DOC1 maintainer documentation and consistency audit

**✅ done — documentation, bounded probes/tests, Sonnet corrections and final Opus fix verification complete (2026-10-21).**

- Scope: document current architecture/process/storage with a repeatable maintenance pattern; reproduce bounded gaps; propose implementation order and SQLite decision criteria; recheck the installed HUD.
- Acceptance: current facts separated from proposed behavior, source-linked language/store matrices, actual focused tests and probes, relative-link checks and independent Sonnet/Opus review.
- Runtime/parser/schema behavior is unchanged in this documentation pass. Syntax inspection, runtime record validation and all-language result coverage are proposed follow-ups, not completed fixes.
- Entry: [maintainer documentation](README.md); [evidence and findings](reviews/2026-10-21-maintainer-docs.md). CODEX1 Windows native edit restrictions and publication boundaries remain open.

## Current implementation — DELIVERY1 GitHub candidates and Codex status

**✅ done — implementation, independent audits, operational candidate verification and delivery complete; the user directed continuation on 2026-10-21.**

- **Scope:** issue/PR templates, shared CI verification, one installer archived with source identity and SHA-256, same-archive Linux/macOS/Windows smoke journeys, and an on-request Codex development HUD.
- **GitHub result:** PR #2 preserves main history and merged the current layout as `6e74c9327c44b4121a7ec4803d3acad66ee0f071`. Final PR run39543306308 passed 496 tests with zero skips/failures on Ubuntu and macOS; types and shell passed. The first failed run exposed Rustfmt diff recognition and redundant optional fixture traversal; 0.2.2 fixes both with regression coverage.
- **Candidate result:** manual run39543872402 passed all six jobs. The same 126691-byte `boxbox-plugin-0.2.2.tgz`, SHA-256 `611858a6b7f72e1a27aaddf9593d5a1404a0baf7c705bb2ec21ea2f2bbec7137`, passed installed TypeScript/Python LF/CRLF preview/apply/recheck/idempotence on all three hosted OSes.
- **Local result:** actual Codex reports the exact downloaded 0.2.2 plugin installed/enabled. Its installed-engine doctor and read-only check passed; the unchanged HUD reads that runtime. A fresh session already accepted the project status skill. Sonnet 5.5 findings were resolved and final Opus 5.5 passed; plugin guard and actionlint passed.
- **Boundary:** the private GitHub plan returns HTTP 403 for required-check protection; PR checks run without server-enforced merge gating. Native host event acceptance and registry publication remain separate. The HUD/project skill is excluded from release artifacts. See [the delivery record and original receipts](reviews/2026-10-21-github-delivery.md).

## Current implementation — FIRSTUSE1 clean-install formatting

**✅ done for implementation and candidate delivery — native host event acceptance remains open under CODEX1. User authorized implementation on 2026-10-21 after reviewing GitHub issue [#1](https://github.com/Woo-JongHo/rowgrid/issues/1).**

- **Problem:** the 0.2.0 installer works, but explicit formatting requires both an external formatter and a user-authored approval database; the bundled preset is empty. Windows formatter execution is also refused unconditionally.
- **Scope:** standalone approved alignment by default; configured formatters remain an optional preceding stage. Preserve approval proof, parsing, token preservation, two-run fixed point, provenance and atomic replacement. Hooks remain read-only.
- **Human decision:** the user approved both concrete initial TypeScript/Python rules on 2026-10-21, including the exact scope, examples and minimum-row counterexamples. Public receipts use the privacy-preserving `maintainer` identity; the actual decision was by Woo-JongHo. Only those two rules may enter the shipped preset. The user separately authorized CC0-1.0 for the four synthetic examples only; repository/product licensing stays undecided.
- **Acceptance:** clean installed Node CLI without a custom formatter/database can preview and apply an approved table; original stays unchanged on preview/refusal/failure; rerun is byte-identical. A configured formatter must fail explicitly when unavailable or broken. Readiness distinguishes detection, approval and write verification. Windows command resolution/timeout cleanup and native Windows execution require direct evidence; hook registration and native host event delivery are reported separately.
- **Verification:** targeted process/pipeline/CLI/preset/artifact tests, full `bun run check`, isolated package installation, plugin guard, native Windows tests through `chacada`, read-only Sonnet 5 review and final Opus audit. Updated plugin delivery is authorized; public publication is separate.
- **Result:** 482 pass / 5 existing parser skips / 0 fail, TypeScript/shell and final plugin guard passed. Native Windows LF/CRLF preview/write/preservation/idempotence, unsafe-key refusals, configured formatter and timeout cleanup passed. Sonnet findings and Opus N1 were fixed; final Opus passed the implementation and prior layout findings. Candidate SHA-256 `6fc35d7c92f6eeb1b442d6d21901ed6f27c06e9654f412750b4530b638b89b8f` was delivered and verified at `C:\Users\woo\Downloads\BoxBox\0.2.1\20261021T094515-KST`. Full [evidence and limits](reviews/2026-10-21-first-use.md).

## Current implementation — LAYOUT1 source and distribution separation

**✅ done — source separation and final Opus follow-up verified (2026-10-21).**

- **Scope:** product engine, shared rules, plugin templates and installer sources under `product/`; tools, corpus, harness and development adapters under `development/`; fixtures under `test/fixtures/`; user and development documentation separated.
- **Generated output:** retain the marketplace `./plugin` path as a tracked, completely regenerable projection. npm packages stay in gitignored `dist/`. Product imports must stay inside `product/` or use external dependencies.
- **Acceptance:** existing behavior and fixture bytes preserved, complete plugin regeneration and drift detection, development link/copy installation, exact outer and nested artifact allowlists, isolated Node install/repair and read-only hooks, full checks and independent review.
- **Verification:** `bun run check`, `bun run pack:installer`, `bun run check:layout`, `bun run sync:plugin -- --check`, official plugin validation and isolated real host registration. Baseline on 2026-10-20: 448 pass / 5 existing skips / 0 fail, TypeScript and shell syntax passed.
- **2026-10-20 baseline evidence:** 452 pass / 5 existing skips / 0 fail; identity, product dependency, TypeScript and shell checks passed. The final plugin guard passed strict validation, hook/contract tests and isolated Claude Code 2.1.286 / Codex 0.163.0 registration. The 32-file installer excludes development paths; fixtures and historical machine evidence were preserved.
- **Review:** Sonnet 5 necessary findings were fixed and its follow-up passed. Opus found a dangling-output-link gap and stale paths; those were fixed and regression-tested. The 2026-10-20 Opus follow-up returned a session-limit error and was unexecuted. The actual 2026-10-21 Opus follow-up inspected and closed both carried-forward findings; no lower-model substitution was used. See [the follow-up audit](reviews/2026-10-21-first-use-evidence/opus-followup.md). See [the migration record](reviews/2026-10-20-layout.md).
- **Contract:** [layout.md](layout.md). Publication, licensing and native Windows acceptance remain separate.

## Current implementation — CODEX1 npm plugin installer

**open (deferred during AUTHOR1) — isolated native evidence audited; Windows edit-dependent events blocked by host policy; registry publication remains a separate decision. Original user direction 2026-10-16: install Codex and Claude Code plugins through npm/npx; prioritize testing Windows Codex today. ZIP transfer was explicitly rejected.**

- **Identity:** product `BoxBox`, core/plugin/skill `boxbox`, public installer candidate `boxbox-plugin`. `product.json` owns `displayName` and `npmName`. The user has no access to the occupied npm `boxbox` name and authorized an available alternative. `box-box` was rejected under npm's similarity policy; `boxbox-plugin` and `boxboxplugin` returned E404 on 2026-10-16. This is not reservation or final registry acceptance.
- **Scope:** `npx boxbox-plugin` detects supported local CLIs and installs their thin plugins and included local engine into permanent user directories. `--codex` and `--claude` select hosts explicitly. Installation must survive removal of npm's temporary cache and must not require Bun or the author checkout.
- **Acceptance:** real local npm artifact execution, permanent paths, real isolated Codex registration/enabled listing and Claude component discovery, Node-only checks, Windows command/path fixtures, and read-only hook execution without project writes. Preserve host trust settings and the Claude inspector's read-only restriction.
- **Installer baseline (2026-10-16):** dedicated installer tests (7 pass, 219 assertions), `bun run check` (440 pass, 5 existing skips, 0 fail), artifact file list and nested-engine path scans, and real local `npx --yes 'file:<installer.tgz>'` journeys. Codex 0.162.1 and Claude Code 2.1.286 accepted installation and same-version repair in isolated homes. Cache/origin deletion did not prevent doctor and read-only checks. The final scoped Opus audit passed; native Windows and interactive session acceptance were unmeasured at that baseline. After publication, verify actual registry `npx boxbox-plugin` in a clean environment.
- **Publication state:** npm authentication as `woojongho` and a publish dry run were verified for the historical `boxbox-plugin@0.2.0` candidate with `UNLICENSED` preview metadata. Current 0.2.2 is an unpublished candidate; the nested engine remains private. Public registry command success is unmeasured. Full-product release approval and license/channel decisions remain separate.
- **2026-10-21 native acceptance:** controlled macOS Codex CLI 0.163.0 sessions delivered SessionStart into native response history; native apply_patch PostToolUse feedback and one bounded Stop continuation passed, as did explicit recovery. SessionStart model acknowledgment is not claimed on either platform. Exactly three reviewed handlers remained untrusted before/after one-invocation admission, and active user config digests matched before/after. Windows Codex 0.157.1 delivered SessionStart context but refused the edit under native read-only sandbox/approval policy; its PostToolUse and failing Stop/recovery remain blocked. Sonnet 5.5 necessary findings and final Opus 5.5 findings were corrected; both fix verifications passed. See [the native evidence](reviews/2026-10-21-codex-native-hooks.md).

## Current implementation — OBS1 code shape observation DB

**✅ done — after implementation and machine verification, on 2026-10-04 the user directed to proceed to the next task. Separate audit skipped this session.** Implements a minimal collector that observes, read-only,
the structure of named TypeScript function declarations. Follows the [design review](reviews/2026-10-03-codex-code-shape-db-review.md).
This is an auxiliary experiment of S5c and not a prerequisite for loading the REL6 approval DB.

- **Scope:** explicitly selected TS files, a function's direct child statements, order, ranges, nesting and structure hashes.
  SQLite, Python function observation, automatic rule approval and GUIDE/fix connections are out of this scope.
- **Outputs:** `product/engine/typescript/09_observe-shapes.ts`,
  `test/shape-observation.test.ts`, implementation and status document updates.
- **Storage:** regenerable evidence in `.boxbox/cache/shape.jsonl`. Records the version, fingerprint, scan scope and completion so that
  and separates unclassified from not applicable. A failed scan never overwrites a valid snapshot.
- **Acceptance criteria:** verified with a real parser and files — determinism for the same input, fingerprint change on version/config change, telling apart nested, same-named and same-line functions,
  marking partial failures, no change to sources and the approval DB, and bounded cache retention.
- **Verification commands:** `bun test test/shape-observation.test.ts`, a real CLI run on a temporary project,
  import normalization and alignment checks on changed TS, `bun run check`, `git diff --check`.
- **Evidence:** the 9 dedicated tests and the real CLI's normal, partial-failure, lock and size boundaries were confirmed. Full check
  **315 pass / 5 skip / 0 fail**, type and install-script checks pass.
  The [verification record](reviews/2026-10-04-shape-observation.md) keeps the reproduction commands and limits.
- **Review status:** the implementation and machine verification results are recorded. The independent Claude Sonnet 5 review and the final Opus audit
  are skipped this session at the user's direction. This is not treated as passing an audit and does not block the session.

## Current implementation — REL2a block writes when the parser fails

**✅ done — after implementation and machine verification, the user directed continuous progress on 2026-10-04.** Within REL2's scope, the one shared re-parse check module
is improved first. It is a safety condition that refuses unverifiable writes regardless of the supported OS and host decisions.
It is not treated as confirming all of REL1 or completing all of REL2.

- **Problem solved:** paths that wrote because a missing parser returned `skipped` or a run failure was mistaken for empty diagnostics
  now end with an error. Before the change, the real Python CLI was reproduced succeeding and writing on both a missing parser and an abnormal exit.
- **Scope:** `product/engine/common/parse-check.ts` and parser-fault regression tests.
  A missing parser or a run failure ends with an error before writing. Diagnostic comparison for working tools is kept.
  The local skip of `parserAvailable` for tests and the CI required-parser contract stay separate.
- **Acceptance criteria:** errors on missing, run error, timeout, signal and abnormal exit without diagnostics, and
  the real Python `06 --write` call exits non-zero and keeps the original bytes. The required-parser environment variable cannot bypass it.
- **Verification:** dedicated fault tests, existing parse/preservation tests, real Python CLI success and failure,
  alignment and import checks on changed TS, `bun run check` and `git diff --check`.
- **Evidence:** full check **326 pass / 5 skip / 0 fail**, 11 dedicated fault tests pass.
  For the three real Python CLI failure cases, exit 1 and original bytes kept; on the normal path, idempotence after the fix was confirmed.
  The [verification record](reviews/2026-10-04-parser-fail-closed.md) keeps the reproduction and limits.
- **Not included:** TS multi-pass atomicity, the auxiliary write gate, the approval DB connection and public Result error normalization remain.
  A separate audit is not performed this session, per the user's direction.

## Current implementation — REL2b preserve the original across TS multi-pass

**✅ done — TS and line-engine safe replacement and integration verification complete.** All alignment passes and re-parse/convergence checks
finish in a temporary working copy, then a conflict with the original is checked and the file is replaced once. Verification failures, exceptions and non-convergence
never leave intermediate results in the original.

- **Scope:** the write orchestration of TS `06_align-tables.ts`, the needed file-replacement helper and regression tests.
- **Acceptance criteria:** normal output and idempotence kept; on failure during a pass, re-parse failure, exceeding the maximum passes or replacement failure,
  the original is kept; overwriting a concurrent external edit is refused; temporary files are cleaned up and the file mode is kept.
- **Verification:** real TS CLI round trips and failure-injection tests, existing TS alignment/preservation/Result tests, full check.
- **Integration evidence:** integrated through REL2c shared line-engine safe replacement and the REL3 Node artifact demonstration.
  Overall **341 pass / 5 skip / 0 fail**, tsc and install shell checks pass.
  Follows the [safe replacement and artifact record](reviews/2026-10-04-atomic-node-artifact.md).
  Separate audit skipped this session.

## Current implementation — REL4 public CLI foundation

**✅ done — command contract implemented; real Node evidence follows the REL8 corrected verification.** Implements `init`, `doctor`, `check`, help/version and the public bin.
At that time, writes were refused under the unconnected approval and formatter conditions. REL8 connected the full pipeline,
and dry-run now performs the real formatter, approval and fixed-point verification while keeping only the original.

- **Scope:** a pure CLI module, a minimal versioned config, the command/error contract, a separate private artifact for publication.
  The public artifact does not include the raw write internal runner or auxiliary writers.
- **Acceptance criteria:** user files kept on re-init, corrupt config refused, a doctor that hides no state, TS/Python check,
  JSON and exit codes, format refusal and dry-run keeping the original, running the bin of an isolated install without Bun.
- **Verification:** CLI-specific regressions, a real npm pack/offline install journey, full check and self-alignment.
- **Remaining boundaries:** the full config layering is REL5, the approval DB and GUIDE are REL6/7, real formatter execution is REL8.

## Current implementation — REL5 config layers / REL6 approval candidate preparation

**✅ done — 18 dedicated config-layer tests and installed-artifact regressions pass.** Merges Base → recommended Preset → User → Project config
deterministically. Safety conditions cannot be disabled by config.

- **Config scope:** v2 partial configs, in-memory migration of existing v1 languages, languages and explicit formatter command/args/timeout,
  fingerprint and provenance, refusing unknown, conflicting, corrupt and path-escaping input. Real formatter execution is connected in REL8.
- **Verification:** layer priority, v1 unchanged, refusal of corrupt/future versions and safety overrides, fingerprint determinism,
  CLI and isolated artifact regressions.
- **Parallel REL8 preparation:** implement the format pipeline core that verifies, in a working copy, the fixed point of explicit formatter → approval gate → BoxBox → a second full run.
  On formatter failure, timeout, insufficient approval or a
  non-fixed point, the original is kept. Public CLI connection comes after core verification.
- **Parallel REL7 preparation:** implement the approval proof check and GUIDE core that keep the existing exact lookup key.
  Eligible only when a decision with the same id as the convention, human approval information, examples and counterexamples, and content/document hashes
  are confirmed. Candidates, conflicts, rejections and stale entries are excluded from write grounds and GUIDE. No real DB approval is created.
- **Parallel REL6 preparation:** record one synthetic example, counterexample and run evidence each for a basic TS and Python pattern
  as candidates in `docs/candidates/`. They are not loaded into the preset or switched to approved before human approval.
- **Remaining decision:** adopting a candidate is chosen by the user from complete before/after comparison material.
  The product name, license and publish approval are separate. Separate audit skipped this session.

## Current implementation — REL8 public CLI integration

**✅ done — public commands and installed artifact integrated, full machine verification complete.**

- Approval core: exact lookup key, per-layer document roots, decision/example/counterexample/hash/version checks. 30 related tests pass.
- Formatter core: runs the explicit command on the working copy without a shell and applies parser → approval → BoxBox.
  The whole process runs twice to confirm a byte fixed point, then replaces once. dry-run performs the same verification.
- The two candidate rules are documented to match the real TS two-row exception and Python indentation scopes. Waiting for the user's approval answer;
  the preset data is still empty. This wait is not treated as a blocker for implementation or synthetic tests.
- Verification: GUIDE/format on a real Node 22.22.3 install, successful install with an empty npm cache. Full check
  **386 pass / 5 skip / 0 fail**, type and shell checks pass. Of 124 self-alignment files, only the existing `development/tools/eval.ts` fails.
The [integration verification record](reviews/2026-10-04-format-integration.md) keeps the Node evidence correction and remaining limits.

## Current implementation — REL6 first approval data

**⏸ waiting for an approval answer — candidates were presented, but there is no real approval yet.** Candidates are not switched to approved
before an answer. The real TS/Python lookup-key scope and before/after examples are in `docs/candidates/initial-rules.md`.
Only approved items are reflected into the three preset DBs and document hashes, and the installed-artifact journey is rechecked.
The next independent implementation is the thin CLI-calling adapter of REL9; real host acceptance is not measured yet.

## Current implementation — DATA1 real-code DB loading

**✅ done — first real corpus load and machine verification complete on 2026-10-04.**
The direction changes from feature-driven work to prioritizing data collection, verification and candidate accumulation.

- Fetches the 8 public TS/Python repositories pinned in the manifest and confirms their commits match.
- Stores the raw observation, exact lookup key, provenance and file hash of detected tables in JSONL and builds candidates by frequency.
- Exports representative before/after comparisons, separated from failures and unclassified ones, as human review material. Only successful material is counted,
  and nothing is auto-approved into the existing preset. Candidate, observation and approval data counts are reported separately.
- Verified with rerun deduplication, provenance tracking, partial-failure marking and the existing safety checks.
- Result: from 8 repositories and 7,759 files, **18,613 observations / 88 exact keys / 225 representatives** were loaded.
  213 examples pass, 11 row-mapping and 1 timeout held. Human approvals: 0.
- Self function observation was extended to 65 files, 311 functions and 154 structures.
- Full check **393 pass / 5 skip / 0 fail**, then 6 candidate-specific tests and the type check pass.
  Sources and preset unchanged; ID, hash and aggregate verification done. The scope and reproduction are recorded in the [DB status](corpus-data.md).
- Audits and external AI evaluation calls are not performed this session.

## Current work — PKG1 Claude Code and Codex plugin release structure

**⏸ on hold for CODEX1 — the shared Codex/Claude release structure is implemented; publication and real published-engine host journeys remain open.**

- **Grounds:** the official `claude plugin validate --strict` rejected the old root plugin (`agents` must be `.md` file paths).
  The directory submission checklist installs only files inside the plugin folder and requires at most 512 files, at most 256 KiB per file, no binaries,
  and exact version pins for launchers. The TS engine depends on the typescript@7 native binary (26 MB), so it cannot go into
  the plugin → per the two-artifact design of `release-contract.md`, **engine = npm CLI, plugin = thin adapter that calls the CLI**.
- **Structure:** one `plugin/` folder with `.claude-plugin/plugin.json` (Claude) and `.codex-plugin/plugin.json` (Codex compatibility overlay),
  a shared `skills/boxbox/` (CLI-only SKILL.md and copied references), `agents/` (Claude read-only inspector), `hooks/hooks.json`,
  `scripts/boxbox` (explicit local-engine shim; no registry fallback) and a README. The repository root only hosts the marketplaces: `.claude-plugin/marketplace.json` and
  `.agents/plugins/marketplace.json` point at `./plugin`.
- **Hooks:** state is written to `${CLAUDE_PLUGIN_DATA}` (also set by Codex), not the user's project. Without `--root`, the input `cwd` is used.
  The Codex edit tool `apply_patch` is in the matcher. Codex Stop input has no `stop_hook_active`, so Stop blocks at most once per session.
- **Single source:** the copied references and the version are produced by `development/tools/sync-plugin.ts`, and drift is tested with `--check`.
- **Remaining decisions (not blocking this work):** license and npm package ownership/publication. The standard shim requires `BOXBOX_CLI`; CODEX1 installs its included engine instead.
- **Acceptance criteria:** `claude plugin validate --strict ./plugin` and the marketplace validation pass, Codex marketplace registration and listing confirmed,
  sync drift, shim and hook tests and `bun run check` pass.
- **2026-10-07 implementation and verification:** `claude plugin validate --strict` passes for the plugin and the marketplace. In an isolated config (CLAUDE_CONFIG_DIR),
  a Claude Code 2.1.286 install detects 1 skill, 1 agent and 3 hooks (with an `agents` array in the manifest it showed 0 agents, so discovery was switched to the default location).
  In an isolated CODEX_HOME, Codex 0.160.1 `marketplace add` → `plugin add` → installed, enabled. The hooks.json → shim → exact-version
  npx (fake) → CLI hook E2E test passes. Overall 428 pass / 5 skip / 1 fail (the existing npm-cache-precondition node-artifact test), tsc passes.
- **Remaining work:** ① **verify ownership and publication access for the confirmed npm package `boxbox` before release; npm `boxbox` is occupied by an unrelated package (checked 2026-10-16)** (if the same version
  were published, the hooks would run someone else's code). ② After the engine is on npm, measure hooks and skills in real sessions of both hosts with the real npx (REL9). ③ No Codex inspector,
  because the Codex plugin format does not accept agents (only the development `codex/*.toml`). ④ A user decision on the default of PostToolUse blocking on
  alignment failures. ⑤ LICENSE, homepage, repository. ⑥ Add `claude plugin validate` to CI (needs the Claude CLI in CI).

## On hold — DATA2 candidate verdicts and held-case resolution

**⏸ on hold since 2026-10-07 for PKG1 — turn the most frequent candidates into release rules, based on real data.**

- The keys of the two existing initial rules covered 3.31% of observations. Judge before/after and counterexamples starting with block declarations, object properties and Python dicts.
- Use `.boxbox/cache/corpus/REVIEW.md` as the human review entry point.
- Reproduce and resolve the 11 before/after row-mapping cases and the one 60-second timeout, and keep them as regression cases.
- Load only approved candidates into the REL6 preset. Neither the amount of data nor machine verification substitutes for human approval.
- DB boundary: internal research evidence, the read-only preset shipped in the plugin, the installed user's global DB and the project DB are separate. Evidence is never auto-promoted or shipped, and examples from personal code stay in the user's repository. The release preset holds only human-approved general rules and newly written synthetic examples. Exact locations and current implementation limits are recorded in [`corpus-data.md`](corpus-data.md).
- The public CLI build is connected to the preset policy gate. It checks approval status, anonymous approver, general scope, synthetic examples, nested schemas and document hashes. JSONL is normalized from the validated objects, and only the decision's approval section is extracted with the ref rewritten. The real tarball was confirmed at 6 files with no research evidence. A semantic comparison against the source text and separating the marketplace from the whole-repository source remain.
- After download, the user's global DB is created locally as empty JSONL with `boxbox db init`, and line counts and sizes are checked with `boxbox db status`. Contents are never printed. The preset JSONL is separately owned by the maker and empty for now. Editing, importing and backing up the user DB are not implemented.

## Current implementation — H1 release tracking harness

**✅ done — on 2026-10-06 the user chose the design (location, storage format, stage scope) and it was implemented.** A run harness and evidence DB for
continuously developing and tracking release readiness (REL0–REL12) live in `development/harness/`. It is a tracking tool, not a release artifact,
and the single source of REL status is this document's REL table — the harness parses the table, joins only machine evidence and never decides status.

- **Scope:** stage orchestrator (`development/harness/run.ts`: self-align, check, pack, artifact-journey, corpus-gate, eval (opt-in)),
  evidence store (`development/harness/db.ts`: `runs.jsonl` append-only, `latest.json` atomically replaced only by complete runs),
  report (`development/harness/report.ts`: latest run, trend against the previous run, REL table join), precondition probe (`typescript@7.0.2`
  and the platform native package in the npm cache — the reproduction condition of the 2026-10-06 release-readiness review).
- **Acceptance criteria:** each run records git, host and precondition fingerprints, a stage failure does not block the rest,
  partial runs do not update `latest.json`, and the report join never changes the human verdict (status column).
- **Verification:** `bun test test/harness.test.ts`, real `bun run harness` (full and `--skip self-align`),
  `bun development/harness/report.ts`, no `bun run check` regressions.
- **Evidence:** 9 dedicated tests pass. Three measured runs recorded (`development/harness/evidence/runs.jsonl`) — the first quick run
  (check 412 pass / 5 skip / 0 fail); in the first full run, self-align detected the known documented deviations
  (37 misaligned tables in `development/tools/eval.ts` + 5 unnormalized imports); after resolving them, the full run is **ok** (self-align over 132 files
  `changed=0`, `misaligned=0`, check 412 pass / 5 skip / 0 fail, 2 packs, artifact-journey 2 pass,
  corpus gate 0 failures). The trend against the previous run correctly caught the CLI tarball change from normalizing `cli.ts`
  (35,415 B → 35,405 B, sha256 changed). It was confirmed that the report's REL join does not change the status column
  and only attaches evidence.

## Public release execution TODO

This table is the current release-stage summary, reconciled with READINESS1. The detailed stage definitions below
retain their original baseline and acceptance scope; their older gap lists are not a second active work queue.
Current remaining work is the READINESS1 phase table, the exact-artifact follow-up and named issue-library gates.

| ID | Task | Prerequisites | Status |
|---|---|---|---|
| REL0 | Canonicalize the release goal, status and execution TODO | — | Reviewed; READINESS1 is the authorized active plan |
| REL1 | Settle the release contract and support scope | REL0 accepted | Four-language scope implemented; final supported-host and license decisions remain open |
| REL2 | Fail-closed safety gate on the public write surface | REL1; independent safety improvement REL2a done first | Verified within the four-language boundaries; historical timeout 007 remains investigating |
| REL3 | Demonstrate the Node/npm runtime and release package | REL2 safety foundation | Verified Node artifacts; corrected CI candidate passed Linux/Windows smoke; hosted macOS smoke queued |
| REL4 | Integrated CLI and project lifecycle | REL3 | ✅ base commands and isolated bin verified; real format connected too |
| REL5 | Rule config and layering contract | REL4 | ✅ layers, versions, fingerprints and refusal contract implemented |
| REL6 | First data in the human approval DB | REL5 | Two approved rules/four examples shipped in the candidate; five additional rules/ten examples await decisions |
| REL7 | Approval DB write gate and minimal GUIDE loop | REL6 | Verified with existing approved data; new exact keys remain unapproved and refuse writes |
| REL8 | Formatter run-last fixed point | REL4, REL7 | ✅ public CLI and real Node artifact machine-verified |
| REL9 | Real acceptance by the confirmed supported hosts | REL4, REL7, REL8 | Bounded native Codex/HUD evidence recorded; authenticated Claude/current Windows hook gates remain open |
| REL10 | Clean artifact install, update and removal on supported OSes | REL8, REL9 | Six native core/four supported HUD cells reviewed; hosted macOS CI queued; authenticated host gates separate |
| REL11 | Freeze public assets, CI and the release allowlist | REL10 | Exact CI payload and documentation audits passed; hosted macOS CI, license/publication decisions pending |
| REL12 | Release and external reinstall check | REL11, human approval | ⬜ todo |

### REL0 — canonicalize the plan

- **Current implementation:** the M1–M1.8 history and implementation documents exist, but there was no single TODO for the release path.
- **Remaining work:** independent plan review, scope rebuttal, traceability checks, applying findings, user acceptance. DOC1's independent Sonnet 5 review and final Opus audit are unrun blockers due to the weekly Claude limit.
- **Acceptance criteria:** the REL order is tied to implementation facts, scope, holds and open decisions are separated, and the user explicitly accepts the draft.
- **Verification:** **existing** relative links and `git diff --check`; **no new** verifier. This change alone does not claim implementation completion.
### REL1 — release contract and support scope

- **Continuous development baseline:** the [first release implementation contract](release-contract.md) records the languages, runtime/OS candidates, command boundaries and
  the list of writes excluded from publication. It does not complete support measurements or user decisions such as the name and license.

- **Current implementation:** the TS/Python + CLI/plugin scope is confirmed; the confirmed product name is `boxbox`/`BoxBox` and the metadata version is 0.2.0. The release version, hosts, OSes, channel and license are undecided.
- **Remaining work:** decide supported patterns, the default preset, quality criteria, runtime candidates, supported OSes, host versions and install methods. For the other 8 languages, separate whether they ship and their write, parser and support promises per preview/report-only. Record the need and the pre-REL11 deadline for the product name, license and release channel, without blocking REL2–REL10 engineering.
- **Acceptance criteria:** the supported/excluded combinations, the public CLI/Result schema, SemVer and migration criteria, and the owners and deadlines of open decisions are pinned in one contract and approved by the user. The feasibility of runtime candidates is settled by REL3 evidence.
- **Verification:** **existing** `bun test test/plugin-contract.test.ts`; **new** a release contract schema/manifest consistency check.
### REL2 — fail-closed safety gate

- **Current implementation:** besides `06`'s token/comment preservation and parser comparison, REL2a blocked writes in the shared line engine when the parser is missing or fails to run. Auxiliary writes and full TS multi-pass restoration are outside the same gate.
- **Remaining work:** implement the public write inventory, failure and timeout handling on the TS path, temporary-file verification, atomic replacement and restore, and an equivalent gate for auxiliary writes or their exclusion from publication.
- **Acceptance criteria:** every failure in a supported language leaves byte-identical originals and a non-zero exit, and no ungated write is in the allowlist.
- **Verification:** **existing** `bun test test/preservation.test.ts test/parse-check.test.ts test/mutation.test.ts`; **new** parser fault, atomic replacement and restore, auxiliary write inventory tests.
### REL3 — runtime and release package

- **Parallel preparation:** build and pack experiments are prepared under the continuous-progress approval. They are not recorded as complete before the final
  artifact verification that integrates the REL2 safety changes. The public bin and the approval/formatter gates come after REL4.

- **Current implementation:** Bun uses `.ts` and the repository's `node_modules`; there is no evidence that a copy/marketplace artifact runs independently.
- **Remaining work:** build a Node engine bundle, a runtime dependency/data allowlist and an internal runner for verification. Removing Bun is not promised; it is demonstrated with `npm pack`. The public `bin` and command dispatcher are owned by REL4.
- **Acceptance criteria:** in an isolated environment without the repository or Bun, calling the tarball's engine through the internal runner performs TS/Python check/write/recheck without depending on files of the original development repository or the `@/` alias. If impossible, it stays incomplete and REL1's runtime contract is revisited.
- **Verification:** **existing** `bun run check`; **new** build, pack allowlist, fixture round trips through the Node-only internal runner. Public `npx` command verification comes after REL4.
### REL4 — integrated CLI and project lifecycle

- **Current implementation:** only the per-language `06`, the report and a partial installer exist; there is no integrated executable.
- **Remaining work:** implement the package `bin` and command dispatcher, `init/doctor/check/format`, config discovery, exit codes, text/JSON, dry-run, reruns and user-file preservation.
- **Acceptance criteria:** CLI entry, help/version, initialization, diagnostics, read-only checks, dry-run and exit codes work, and re-init never overwrites user files. Under unconnected config, approval and formatter conditions, `format` explicitly refuses to write. The full success journey is verified in REL10 after REL7 and REL8 are connected.
- **Verification:** **existing** `bun test test/result-json.test.ts test/install-lifecycle.test.ts`; **new** CLI contract, init idempotence, doctor/exit-code/JSON and journey E2E.
### REL5 — rule config and layers

- **Current implementation:** exact lookup and preset/project JSONL are report-only, and there is no `.boxbox/config.json` product contract.
- **Remaining work:** define Safety > Project > User > Preset > Base, rule scope/genre, formatter, schema version/migration, and refuse disabling Safety.
- **Acceptance criteria:** input and config interpretation are deterministic, and conflicting, outdated and corrupt files fail before writing.
- **Verification:** **existing** `bun test test/conventions.test.ts test/examples.test.ts`; **new** config schema, layering, conflict, migration and refusal of Safety overrides.
### REL6 — first data in the human approval DB

- **Current implementation:** the schema and corpus verdict tools exist, but the preset has 0 entries and verdicts do not flow into the approval DB.
- **Remaining work:** build candidates, counterexamples and provenance for the core TS/Python types, and have a human approve or reject them. AI experiment data stays separate from the product DB.
- **Acceptance criteria:** every approved entry has a decision, examples, counterexamples, versions and evidence hashes, runs as a test, and undecided ones are unknown.
- **Verification:** **existing** `bun development/tools/examples-check.ts`, `bun test test/corpus-judge.test.ts test/corpus-promote.test.ts`; **new** DB provenance, approval receipts, example execution tests.
### REL7 — write gate and minimal GUIDE loop

- **Current implementation:** lookup is report-only and does not feed approved rules into GUIDE.
- **Remaining work:** wire FIX for approved only and forbid writes for rejected/unknown/conflict, and build GUIDE from approved rules and examples. Also route the shipped SKILL and hook write calls through this gate.
- **Acceptance criteria:** config → human approval DB → write gate → GUIDE → REVIEW closes on fixtures and unapproved code is not fixed. Every public TS/Python write entry point goes through the same approval gate, and raw `06 --write` is excluded from the release or goes through the same gate.
- **Verification:** **existing** `bun test test/report.test.ts test/conventions.test.ts`; **new** per-status write matrix, guide golden/version, config-to-guide-to-review E2E.
### REL8 — formatter run-last

- **Current implementation:** no formatter wrapper and no fixed-point evidence.
- **Remaining work:** implement explicit formatter → BoxBox order, failure, timeout, version fingerprint, separating change amounts, and identity.
- **Acceptance criteria:** `C(file)=boxbox(formatter(file))` and `C(C(file))=C(file)` hold for TS/Python, and nothing is written when the formatter fails.
- **Verification:** **existing** `bun test test/typescript-align.test.ts test/python-align.test.ts`; **new** fixed point for the chosen TS/Python formatter combinations, child-process failure and version change tests.
### REL9 — real host acceptance

- **Current implementation:** the plugin (`plugin/`) installs in isolated Claude Code 2.1.286 and Codex 0.160.1 homes (PKG1), and Claude hooks have simulated verification. There is no evidence of real hook acceptance against the published engine.
- **Remaining work:** before host verification, align the support levels and invocation paths in the README, SKILL and package/plugin/marketplace manifests and the discovery-text pin tests. On pinned host versions, measure discovery, GUIDE, read-only REVIEW, CLI calls and error display.
- **Acceptance criteria:** the hosts settled in REL1 receive the same CLI results, keep the read-only inspector boundary, and leave versions, artifact hashes and logs. Skill invocation and authoring-hook support are marked separately.
- **Verification:** **existing** `bun test test/hook.test.ts test/plugin-contract.test.ts`; **new** acceptance scenarios on the confirmed real hosts. Simulated runs alone do not pass.
### REL10 — clean artifact install, update and removal

- **Current implementation:** reusable exact-artifact core and HUD configuration verifiers exercise real host CLIs in disposable profiles. The initial CI archive passed Codex on macOS, native Windows and Linux/WSL; Claude failed version identity acceptance on macOS/WSL. The corrected local and final clean CI archives each passed all six native core host/OS cells and four supported macOS/WSL HUD ownership cells. See the [current execution record](proposals/2026-10-22-artifact-lifecycle.md); none of these cells runs an authenticated model session.
- **Remaining work:** complete the queued hosted macOS engine smoke job. Native lifecycle, preservation and documented removal residue are reviewed for final CI bytes; authenticated host calls remain under REL9.
- **Acceptance criteria:** supported combinations pass with an artifact matching the recorded hash of the release candidate, and removal deletes only managed files. An update/rollback rehearsal between two candidate versions keeps user config and approval data.
- **Verification:** **existing** `bun test test/install-lifecycle.test.ts`; **new** OS/Node/host E2E, update migration, residue, offline and error tests.
### REL11 — freeze for publication

- **Current implementation:** the confirmed product name, undecided license, `private: true` and Bun-centered CI remain. The English translation (S8) was done on 2026-10-07, and the marketplace source is split into `plugin/` (PKG1).
- **Remaining work:** freeze the name, LICENSE, version, channel, artifact allowlist, support matrix and release CI.
- **Acceptance criteria:** identity, version and license match; secrets, scratch and corpus are excluded; install, update and removal docs and a clean CI artifact are complete.
- **Verification:** **existing** `bun run check` (including the plugin contract and the language policy test); **new** publish dry-run/allowlist, license and secret scans, artifact hash and lockfile, matrix CI.
### REL12 — release and follow-up install check

- **Current implementation:** there is no public release, tag or publish, and no external install evidence.
- **Remaining work:** after independent review, QA, rebuttal, a final audit and user approval, make the release commit, tag and publish, and rerun the journey with the published artifact.
- **Acceptance criteria:** the registry/marketplace digest matches the approved build, and install → host → update/removal is confirmed. Document the procedure to halt the release and notify users if the first release has problems, and the procedure to restore the previous version in later versions.
- **Verification:** **existing** `bun run check`; **new** artifact provenance and hash records, published-artifact E2E, tag digest and post-release smoke.

## Historical plan and working discipline

M1–M1.8 below keep the implementation history and the remaining backlog. For new release work, the order and status in the REL
list above take precedence. The partial implementations of `S3.5`, `S3.6` and `S5c` move to REL6, REL7 and REL9 and are not switched to done.

The old plan maps as S4 → REL5, S5c → REL6, S5d → REL7, M2 → REL8, S3.6 → REL9,
S6 → REL3, REL4, REL10, and S7, S8 → REL11. S3.5's additional alarms are reflected in REL4 and REL7 after REL1 sets the
public scope. S5e's shape-DB move and E1's full model evaluation are held apart from the mandatory first-release links.

**Always check:** every `.ts` file in `product/engine/`, `scripts/`, `test/` and `development/harness/` has
`misaligned=0` from `06_align-tables.ts --file`, `changed=0` from `00_normalize-imports.ts`, and
`bun run check` passes. Before completion, search the changed files directly for TODO placeholders,
`test.skip`/`test.only`, empty tests and unimplemented branches.

**Earlier status records:** M1.5 is recorded as waiting for human verdicts, and M1.6 nested tables as done on 2026-09-28.
M1 safety's 169 pass / 3 skip is a record from 2026-09-28, not evidence for the current release gate.

Status legend: `⬜ todo` · `▶ active` · `✅ done` · `⏸ blocked/on hold`

## M1 — Safety proof

| # | Task | Status |
|---|---|---|
| T0 | Baseline commit | ✅ done 2026-09-28 |
| T1 | Green self-check | ✅ done 2026-09-28 |
| T2 | Token-stream preservation | ✅ done 2026-09-28 |
| T2.5 | Import table cells | ✅ done 2026-09-28 |
| T3 | Output re-parse | ✅ done 2026-09-28 |
| T3.5 | Mutation tests | ✅ done 2026-09-28 |
| T3.6 | TEST_COMPLETED folder | ✅ done 2026-09-28 |
| T4 | Row floors per kind | ✅ done 2026-09-28 |
| T5 | Go alignment off by default | ✅ done 2026-09-28 |
| T6 | Shared `Result` JSON | ✅ done 2026-09-28 |
| T7 | Close M1 | ✅ done 2026-09-28 |

### T0 — Baseline commit

Snapshot the current working tree so every later task has a clean diff.

- **Scope:** two commits. (1) **Code:** the pre-existing work-in-progress registry changes (`grid-kinds.ts` call-statements kind and object-row property axes, with their tests), the original `woo` → placeholder rename and the English migration. These cannot be split cleanly: the same files were changed by the WIP, then moved and translated. (2) **Docs and process:** `AGENTS.md`, `CLAUDE.md`, `design.md`, `plan.md`, `reviews/`, readiness doc, CI workflow. Add `.video_agent/` to `.gitignore`.
- **Needs:** user approval of the commit split and messages.
- **Accept:** `git status` clean except ignored files; `bun run check` green at each commit.
- **Verify:** `git log --oneline -5`, `git status --short`, `bun run check`.

### T1 — Green self-check

The repository must pass its own checker (the WIP `grid-kinds.ts` changes now flag files that were aligned under the old registry).

- **Scope:** run `06_align-tables.ts --write` on the flagged scripts and tests after reading each group; fix anything that looks like a wrong detection as a registry bug instead of accepting the rewrite.
- **Accept:** every `.ts` file under `product/engine/`, `scripts/` and `test/` reports `misaligned=0`; tests green.
- **Verify:**
  ```bash
  for f in product/engine/**/*.ts development/tools/*.ts test/*.ts; do bun product/engine/typescript/06_align-tables.ts --file "$f" >/dev/null || echo "FAIL $f"; done
  bun run check
  ```

### T2 — Token-stream preservation

Today the harness compares output and input with *all* whitespace stripped, which cannot see a change inside a string literal or comment.

- **Scope:** a shared check built on the existing mask: code outside strings/comments must match token by token, and every string and comment must be byte-identical. The line engine and the TypeScript aligner call it before returning an edit; on failure the row/table is refused. The harness asserts it instead of `stripWhitespace`.
- **Accept:** a new test proves that an edit which changes spacing *inside* a string is refused; all language suites use the new assertion.
- **Verify:** `bun test`; the new negative test fails if the check is removed.

### T2.5 — Import table cells

User-confirmed rule change (2026-09-28): imports apply contract rules 8 and 35 — the `{ }` binding list is a fixed-width cell and the terminating `;` is a column — across the whole import section.

```ts
import      {
              isArrayLiteralExpression       ,
              isPropertySignatureDeclaration ,
                                               } from "typescript/unstable/ast"         ;
import type { Node, SourceFile                 } from "typescript/unstable/ast"         ;
import      { skipTrivia                       } from "typescript/unstable/ast/scanner" ;
```

- **Head cell:** always reserves the `import type` width (or a wider `import Default,`), so `{` is one column in every import.
- **Section-wide columns:** `{ }`, `from`, module and `;` are shared by all groups separated only by blank lines; code between imports starts a new section.
- **Vertical form:** one name per line on the names column, aligned commas, trailing comma, closing `}` on the table's `}` column — triggered by (A) one-line form over 120 columns, (B) names 20+ columns wider than the second-widest, (C) the aligned table still over 120 columns (widest names first).
- **Stay as written:** imports without braces and imports with attributes (they do not break the table); a lone brace import stays compact; no `;` column in files without semicolons.
- **Accept:** the rules above hold; the whole repository is realigned with every import line within 120 columns; SKILL.md STEP0 and contract rule 2 describe the new form.
- **Verify:** `bun test test/normalize-imports.test.ts` (7 cases, including re-detection of already aligned rows), standing self-check across the repository.

### T3 — Output re-parse

- **Scope:** after alignment, parse input and output with the language's official parser and require the same diagnostics. TypeScript uses the bundled `typescript@7`. Other languages use their toolchain when present — Python `ast.parse`, `gofmt -e`, `javac`, `clang -fsyntax-only`, `node --check`, `rustc` (not installed locally; CI installs it) — and the harness marks the check as skipped, never passed, when a toolchain is missing.
- **Accept:** every golden fixture's output parses with unchanged diagnostics; CI runs all eight parsers.
- **Verify:** `bun test` locally (skips listed explicitly); CI log shows no skips.

### T3.5 — Mutation tests

Generate thousands of variants from the existing fixtures and prove the invariants hold on each. Local compute only.

- **Scope:** a seeded, deterministic mutator per language: random spacing and tabs between tokens, separators (`:` `=` `;` `,` `//` `#`) injected inside strings, comments inserted between rows, CJK and emoji in strings and comments. For every variant: token-stream preservation (T2), idempotence, and re-parse (T3) where the toolchain exists. Failures are minimized and saved as regression fixtures.
- **Accept:** at least 1,000 variants per language run in `bun test` under a time budget (seed fixed; a larger run is available via an environment variable); zero invariant failures, or every failure fixed and pinned as a fixture.
- **Verify:** `bun test`; `BOXBOX_MUTATIONS=20000 bun test test/mutation.test.ts`.

### T3.6 — TEST_COMPLETED folder

A place to check aligned results by eye in an editor (design §6, L4 review, first version). An HTML page was tried first and replaced by plain files at the user's request.

- **Scope:** `bun development/tools/test-completed.ts [--samples 3]` rebuilds `TEST_COMPLETED/` (git-ignored): per language, every fixture and seeded mutation samples as aligned files, each original under `before/`, and `SUMMARY.txt` with the safety results per file (tables, refused, whitespace-only, idempotent, parse).
- **Accept:** all eight languages are present; failing files are marked `FAIL` in `SUMMARY.txt`.
- **Verify:** run the command; the user reviews the folder.

### T4 — Row floors per kind

- **Scope:** fixes apply from 3 rows, with two user-confirmed exceptions from 2 rows: TypeScript `=` declaration tables (`declaration-equals`) and imports. The line engine raises any `minRows` below 3 to 3, so `--min-rows 2 --write` no longer promotes pairs. Line-engine `=` declarations per language are decided in F1.
- **Accept:** a 2-row TypeScript `=` declaration table is aligned; a 2-row group of any other kind, and any 2-row line-engine group even with `--min-rows 2`, is left unchanged; docs no longer advertise `--min-rows 2` as a fix path.
- **Verify:** `bun test`; `grep -rn "min-rows 2" skills docs` shows only the reporting option of `01_group-regions.ts` and history notes.

### T5 — Go alignment off by default

- **Scope:** the Go aligner reports but does not write unless explicitly enabled (flag now; config key once `.boxbox/config.json` exists). Record the gofmt conflict in the Go suite as a known limitation.
- **Accept:** `06_align-tables.ts --file x.go --write` leaves the file unchanged without the opt-in flag; with the flag, behavior is as today.
- **Verify:** `bun test`; manual run on `fixtures/go/tables.go` with and without the flag.

### T6 — Shared `Result` JSON

- **Scope:** one versioned JSON schema (`schemaVersion`, file, tables, per-group state, edits, refusals) emitted with `--json` by both the TypeScript aligner and every line-engine aligner.
- **Accept:** a schema test validates the output of one TypeScript file and one file per line-engine language.
- **Verify:** `bun test`; `bun product/engine/python/06_align-tables.ts --file test/fixtures/python/tables.py --json`.

### T7 — Close M1

- **Scope:** update `design.md` §10 rows, README status, and this file; write the next milestone's tasks in detail.
- **Accept:** the M1 checklist under *Goal* is all true.

## M1.6 — Nested tables, TypeScript first (after M1, before M1.5)

Why: the engine sees one layer only. In `const STATES = new Set(["PASS", …]) ;` it aligns `=` and `;` but not the call or the list inside. Judging real data (M1.5) before this would spend verdicts on a known gap (user decision 2026-09-28).

```ts
const STATES = new Set(["PASS", "FIXABLE", "SUGGEST", "REFUSE" ]) ;
const PARSES = new Set(["ok"  , "changed", "skipped", "not-run"]) ;
```

| # | Task | Status |
|---|---|---|
| N1 | Call layer: callee, `(`, top-level `,`, `)` inside declaration values and call-statement subjects | ✅ done 2026-09-28 |
| N2 | List layer: `[ ]` / `{ }` of literals — element widths, `,` and closing column | ✅ done 2026-09-28 |
| N3 | Outliers in declaration tables: when one row is far longer, the vertical form (as for imports) | ✅ done 2026-09-28 |
| N4 | Hand-made samples: guard-row tables and subscript cells from `00_normalize-imports.ts` | ✅ done 2026-09-28 |
| N5 | Python: the same layers on the line engine's bundle rows | ✅ done 2026-09-28 |

| Layer | Aligned | Condition |
|---|---|---|
| 1 — row | `=`, `;` (existing) | declaration / call-statement table |
| 2 — call | callee name (left), `(`, top-level argument `,`, `)` | the cells share callee, arity and tail (no `.stdout ?? ""` on only some rows), in the table's row count; no argument is 20+ columns wider than the second widest in its column (import rule B) |
| 3 — list | the bracket column, each item `,` right after the widest item, the next item one space later, and the closing `]` / `}` right after the widest last item | slots: the declaration value, each argument of the layered call, and the matcher arguments of call statements; every row has the slot with the same shape (array arity, or the same object property names), every item is a string/number/boolean literal, no item is 20+ columns wider than the second widest in its column (import rule B); a trailing comma or a multi-line form refuses the slot; dropping the call layer drops the list slots inside its arguments (matcher slots survive) |

N2 implementation notes (done 2026-09-28): `callLayer` in `grid-kinds.ts` was generalized into `itemLayer`, a cell layer over items (call arguments, array elements, object properties). List slots are derived per row by `rowListCells` and tagged `layer: "call" | "list:<slot>"` with slot names `list:value`, `list:arg<i>`, `list:matcher-arg<i>`; boundaries carry slot-qualified axes (`list-arg2-comma1`, …) registered in `KIND_AXES` and `AXIS_NOTES`. `withLayers` gates the call layer as in N1 and each list slot across the run: same shape (arity or property names), all items literal, no 20+-column outlier in any item column.

N3 implementation notes (done 2026-09-28): in a declaration table whose rows share callee and arity, the row holding the outlier argument (import rule B) takes the vertical form instead of dropping the layer for everyone — arguments one per line under the `(`, non-last argument commas right after the widest argument, `);` on the statement's indentation, `=` at the table's `=` column; the remaining rows keep the call layer when no outlier is left among them. The render only inserts line breaks and padding, so `06_align-tables.ts` gates such a group with the new `preservesTokensWithBreaks` (tokens and comments byte-identical, breaks only inserted; the strict gate still covers every other edit) plus the re-parse gate. Calls with one argument, different callees, and call statements never go vertical. A vertical row leaves the table on the next run, so the write is stable.

N4 implementation notes (done 2026-09-28): two constructs from the hand-aligned `lexicalMask` in `00_normalize-imports.ts`. (1) Subscript cells — a declaration value that is a subscript read (a leading `!` is fine) gains a `subscript-close` insert axis: `]` right after the widest index, kept only when every row has the subscript on the same object with no outlier index. (2) Guard rows — a new `guard-statements` kind for consecutive one-line `if (…) { …; continue; }` statements (block ends in `continue`, no `else`): the condition's closing `)`, the first statement's `;` and the `continue` column are insert axes; the statements in between stay as written. The hand-aligned sample is the engine's fixed point. The third hand-made sample (a multi-line object literal whose continuation lines align on the first property) is not covered yet — see backlog.

N5 implementation notes (done 2026-09-28): the Python profile gains the assigned call row, `name = call(...)`, as table form 6 — the line engine's call layer. The callee travels in the axis name (`call:frozenset`), so rows calling a different callee never share a table; arity is part of the axis sequence. Two argument shapes decompose: two or more scalar arguments become cell/arg columns, and exactly one flat bundle argument (`frozenset({"a", "b"})`) folds its cells inside the call as the list layer — the Python counterpart of the milestone's `new Set([...])` example. Nesting, keyword arguments, and bare `name = {...}` values stay refused. The cell cutter is shared with bundle rows (`cellsIn`); tables need the line engine's 3-row floor.

Hand-made reference samples (user, `00_normalize-imports.ts`): guard rows `if (…) { state = … ; … continue; }` with aligned condition cell, `{ … ;` and `continue`; subscript cells `chars[index    ]!` / `chars[index + 1] ;`; a multi-line object literal whose continuation lines align on the first property.

## M1.5 — Data for TypeScript and Python (after M1.6, before M2)

Why: today's tests prove safety, not quality. Goldens were produced by the engine itself and no real code has been judged by a person. The principles are the same for every language; what makes a language solid is **judged real data**. TypeScript and Python get it first (user decision 2026-09-28); Java, Go, Rust, JavaScript, C, C++, Kotlin and Swift stay light (current fixtures plus the safety net).

| # | Task | Status |
|---|---|---|
| D1 | Pinned corpus for TypeScript and Python | ✅ done 2026-09-28 |
| D2 | Signatures: group every aligned table into types | ✅ done 2026-09-28 |
| D3 | Judging in TEST_COMPLETED and verdict records | ✅ done 2026-09-28 |
| D4 | Learning: verdicts become cases, rules and registry changes | ✅ done 2026-09-29 |
| D5 | Measures: judged share, wrong-grouping rate, unseen types | ✅ done 2026-09-29 |
| D6 | Edge inputs: CRLF, BOM, large files, Rust parser | ✅ done 2026-09-29 |
| D7 | Swift and Kotlin (light) | ✅ done 2026-09-29 |

- **D1:** `development/corpus/manifest.json` (committed) pins permissively licensed repositories by commit SHA — TypeScript candidates: vscode, prisma, trpc, zod; Python candidates: requests, fastapi, pydantic, django — plus the user's private repositories as local-only sources (never committed). Sources are fetched into `~/.cache/boxbox/corpus/`. Done 2026-09-28: `development/tools/corpus-fetch.ts` materializes each source as a shallow worktree at the pinned commit (idempotent re-runs); private repositories go into gitignored `development/corpus/local.json` (same schema, merged, duplicate ids refused); `test/corpus.test.ts` validates the manifest and the gitignore entry without network. All eight sources verified fetched at their pinned commits; per-source `paths` fields scope future scanning.
- **D2:** every detected table gets a signature (language, container context, kind, ordered axis IDs, nesting, result state — design §6 L2); thousands of tables collapse into hundreds of types, ranked by frequency × risk. Done 2026-09-28: `development/tools/corpus-signatures.ts` scans the fetched corpus (TypeScript through one TypeScript 7 server per source in batches of 25 files, capped by `--max-files` per source, `.tsx`/`.d.ts`/hidden directories skipped, symlinked directories counted once; Python through the in-process line engine) and writes the ranked type report to `~/.cache/boxbox/corpus/signatures.json` with up to three source locators per type for D3. First run (`--max-files 100`): 1,432 tables from 737 files collapse into 91 types, top type function-body `=` declaration tables (258 tables, 1,099 edits). The shipped default run (`--max-files 400`, after the symlink fix): 8,093 tables in 197 types, top type 1,077 tables / 3,962 edits — reruns are byte-identical. Both engines now carry `context` and `depth` per table (TypeScript: AST container kind and container depth; line engine: shared indent as depth), and `loadSourceFile` closes its TypeScript 7 server — the unclosed servers were accumulating gigabytes across runs. Cross-verified 2026-09-28 (see `docs/reviews/`): all pins, licenses, determinism and locators reproduced; the symlink double-visit and silent-missing-manifest findings are fixed in the same pass.
- **D3:** representatives per type are exported to `TEST_COMPLETED/corpus/<language>/<type>/` (aligned file, original, context); the user judges each type: `correct`, `different-role`, `missing-kind`, `taste`, `unsure`. Verdicts are stored as records (`development/corpus/verdicts.jsonl`, committed; no third-party code in it). `SUMMARY.txt` shows `approved` / `unjudged` per result. From the D2 cross-review: the sorted-alphabetical walk biases the census sample toward files early in sort order — D3 sampling should be stratified (design §5.2), and `call:*` representatives should be sampled per callee since the type deliberately merges callees the engine keeps apart. Done 2026-09-29: `development/tools/corpus-judge.ts` exports all 197 types (2 representatives each) into `TEST_COMPLETED/corpus/<language>/<rank>-<slug>/` and renders `SUMMARY.txt`; judge by rank with `--verdict <rank> <verdict> [--note …]`, appending to `development/corpus/verdicts.jsonl`. **Left for the user: the actual verdicts** — open `TEST_COMPLETED/corpus/SUMMARY.txt`, review each type's `rep1-original.txt` against `rep1-aligned.txt`, then record `bun development/tools/corpus-judge.ts --verdict <rank> <verdict>`.
- **D4:** each verdict becomes a minimized, synthetic-identifier case under `fixtures/<language>/<region>/<construct>/` (the construct matrix grows from data, not by hand); `different-role` becomes a grouping rule, `missing-kind` a new kind, `correct` a pinned golden (design §7). The promotion gate keeps judged results from changing silently. Done 2026-09-29 (mechanism; real promotion waits on D3 verdicts): `development/tools/corpus-promote.ts --rank <n>` scaffolds a synthetic fixture under `test/fixtures/<language>/corpus/` for a `correct` verdict, writes the engine-aligned golden and a `verdict.json` binding; `--check` is the promotion gate (every promoted fixture must still align to its committed golden) and `--report` lists pending `different-role`/`missing-kind` registry work. The fixture author refines the scaffold by hand — no third-party text is ever copied.
- **D5:** per language: share of tables in judged types, wrong-grouping rate from verdicts, share of types never seen before in a new repository. Done 2026-09-29: `development/tools/corpus-measures.ts` prints per-language judged share, table share, and the wrong-grouping rate (`different-role` + `missing-kind` over judged tables; `taste`/`unsure` are judgments, not misses); `--baseline <signatures.json>` reports the unseen-type share. Currently all shares are 0% — no verdicts exist yet.
- **D6:** CRLF and BOM files, a multi-thousand-line file with a time budget, `rustfmt` locally. Done 2026-09-29: `test/edge-inputs.test.ts`. Found and fixed a real gap — CRLF line endings made the line engine silently refuse every row (the trailing `\r` failed the row regexes and the trailing-whitespace guard); the engine now strips `\r` for profiling and restores it on output, so CRLF files align with their endings preserved. BOM lines stay untouched, and a 3,000-line single-table file aligns well inside the budget. rustfmt was already covered by the T3 skip-locally mechanism.
- **D7:** Swift and Kotlin as light languages — nested block comments, multi-line and raw strings, interpolation in the mask; re-parse with `swiftc -parse` / `kotlinc` (Kotlin in CI only); mutation tests; discovery text. Done 2026-09-29: `maskSource` gained nested block comments (`BlockCommentSpec.nested`); `scripts/swift/` and `scripts/kotlin/` profiles accept four row forms (let/val·var typed and plain bindings, assignments, quoted dictionary rows), refusing calls, containers, closures and declarations; fixtures (tables/tricky/golden) for both; `swiftc`/`kotlinc` parse gates registered (kotlinc installed by the CI workflow, so its parse gate runs there but skips locally); mutation tests registered; discovery text updated in the manifests, SKILL.md and AGENTS.md.

## M1.7 — Pattern DB slice (parallel to M1.5 verdicts, before M2)

Why: the product is a pattern checker — "does this code match the approved patterns in my database?" (user direction 2026-09-30). Design §3–4 already calls this the Registry (Convention / Evidence / Decision records), but only the collecting side exists (census, signatures, verdicts, promotion). Nothing at runtime can look a group up: the signature lives in `development/tools/corpus-signatures.ts` (not shipped), includes the result state, and the aligners never emit it.

Decisions (2026-09-30):

- **Retrieval is an exact signature-key lookup, never vector similarity.** Deterministic (invariant 7); an unknown key means `SUGGEST` / `UNCERTAIN`, never a best-effort fix (invariant 2). Similarity retrieval ("RAG") belongs only to GUIDE, where agents consume approved patterns and golden examples at authoring time.
- **The database is git-tracked JSON/JSONL files.** No server and no native dependency, so the plugin installs anywhere; approvals stay reviewable as diffs. SQLite may come later as a cache index only.
- **Two databases, layered:** the preset DB ships read-only with the plugin; the project DB is `.boxbox/conventions.json`, owned by the user. Project > Preset.
- **The DB gates, it does not draw.** The engine still computes every column; the DB only decides whether a group may be fixed. The M1 safety proof is unchanged.
- **The signature key is a public contract**: versioned, with a migration rule when its format changes.

| # | Task | Status |
|---|---|---|
| P1 | Shared signature module: identity key without result state | ✅ done 2026-09-30 |
| P2 | `signature` per group in the `Result` JSON (both engines) | ⏸ blocked (until M1.8 S5) |
| P3 | Convention record schema and loader (preset + project) | ⏸ blocked (until M1.8 S5) |
| P4 | Lookup step, report-only: `convention: approved \| rejected \| unknown` | ⏸ blocked (until M1.8 S5) |
| P5 | Promotion writes `correct` verdicts into the preset conventions | ⏸ blocked (until M1.8 S5) |

- **P1:** move `signatureOf` / `normalizeAxis` from `development/tools/corpus-signatures.ts` into `product/engine/common/signature.ts`; the identity key is `(language, context, kind, axes, depth)` with a key version, and the state is a separate field. `corpus-signatures.ts` imports it. **Verify:** regenerate `signatures.json` and compare type counts (only splits caused by removing the state may differ); `bun run check`.
  P1 implementation notes (2026-09-30): `product/engine/common/signature.ts` holds `SIGNATURE_VERSION`, `normalizeAxis`, `signatureOf` (no state argument) and `indentDepth`. The census report moves to `schemaVersion: 2` with `signatureVersion`; each type counts its results in `states` instead of being keyed by one, and its representatives prefer FIXABLE tables. `readCensusReport` refuses an older report, so judge, measures and promote never match stale keys. Rerun on the pinned corpus: 8,093 tables collapse into 182 types (was 197); the 197 old keys minus their state give exactly the 182 new keys with identical per-state counts (14 keys held more than one state). `TEST_COMPLETED/corpus/` was re-exported with the new slugs (`<rank>-<kind>-d<depth>-<hash>`).
- **P2:** every group in `--json` carries `signature`; bump `schemaVersion`. **Verify:** the schema test covers one TypeScript file and one file per line-engine language.
- **P3:** a `Convention` schema (design §4.1) and a loader for `product/rules/presets/recommended/conventions.json` and `<repo>/.boxbox/conventions.json`. **Verify:** loader unit tests — missing files, conflicts (project wins), schema errors fail loudly.
- **P4:** check mode annotates each group with its convention status; write behavior is unchanged. **Verify:** every golden fixture unchanged; `--json` shows the field.
- **P5:** `corpus-promote.ts` records a `correct` verdict as an approved preset convention (the Decision stays in `development/corpus/verdicts.jsonl`). **Verify:** one verdict end to end — verdict → convention → check reports `approved`.
- **Later:** switch the lookup into a gate (`unknown` → `SUGGEST`), give line-engine groups a real `context` and `kind` (today `""` / `"table"`, so different roles can share a key), and the GUIDE renderer — absorbed into M3, M5 and M7.

## M1.8 — language model and release (2026-09-30–)

Why: the goal became a public release. The principle is "readable code" and the value is "code is language". Guiding what gets written (GUIDE) and checking it (REVIEW) must look at the same grammar and conventions, and the DB is where those conventions and examples live. This frame is settled one layer at a time from top to bottom.

### Decisions

- **One repository.** The skill folder follows the open Agent Skills standard, so Claude Code, Codex, Gemini CLI, Copilot, Cursor and others read the same folder. Hosts differ only in manifests.
- **Two artifacts.** The engine CLI package (locally installed `boxbox`; called by CI, hooks, editors and agents alike) and a thin agent adapter (`SKILL.md` + manifests).
- **Release blockers:** R1 the TS engine does not run after a marketplace install because there is no `node_modules`, R2 bun is required, R3 usage outside agents (CI, hooks), R4 the preset DB must be versioned together with the engine, R5 name and license. Also, `source: "./"` in `marketplace.json` ships the whole repository, so the release build is split into `plugin/` (done in PKG1, 2026-10-07).
- **Five normative layers** (lower layers use only IDs from upper layers; lower layers change more often and have less authority):

| Layer | Location | Responsibility |
|---|---|---|
| 0 charter | `product/rules/references/charter.md` | principles, values, safety invariants |
| 1 grammar | `product/rules/references/grammar.md` | units (word, sentence, paragraph, text), patterns, roles, paragraph purposes, genres — defines every ID |
| 2 surface forms | `base/<language>/` (data) | pattern → kind, symbols, word order, decomposition conditions |
| 3 conventions | `presets/recommended/rules/`, user `.boxbox/rules/` | which allowed shapes to use, levels (FIX/SUGGEST/GUIDE) |
| 4 example book | preset DB, user `.boxbox/` DB (JSON/JSONL) | approved examples, verdict history |

- **How the core principles reach every model:** ① engine code and tests (enforced regardless of the model) ② the `charter.md` source ③ the top 3–5 lines of `SKILL.md` (when the skill fires) ④ the marked section of the user repository's `AGENTS.md` (written by `boxbox init`, always read by most agents). ③ and ④ are generated from ② and pinned by tests. `CLAUDE.md` (`@AGENTS.md`) stays — Claude Code reads `AGENTS.md` only when there is no `CLAUDE.md`, and older versions, Bedrock and Vertex do not have that fallback.
- **Language:** English everywhere since 2026-10-07 (AGENTS.md language policy; previously Korean during development with translation before release).
- **The first scope is TypeScript and Python** (2026-09-30). Java joins after a permissively licensed corpus is pinned (S2.5). Other languages' engines stay as they are but are not covered in grammar and convention work.

| # | Task | Acceptance check | Status |
|---|---|---|---|
| DOC1 | Document the real implementation (user request 2026-10-04): record code-based entry points, execution flow, data, safety checks and limits in `docs/implementation.md` and link it from the README. Verification record: `docs/reviews/2026-10-04-implementation-docs-review.md`. Existing product behavior does not change | compare against sources and tests, check the document's commands and relative links, record `bun run check` results and the unverified scope, independent review | ⏸ waiting to move into REL0 — document written, compared against sources, machine-verified. Independent Sonnet 5 review and final Opus audit not run due to the weekly Claude limit (blocker) |
| S0 | Record this map, hold M1.7, replace the AGENTS.md language policy, update memory | user approval, `bun run check` | ✅ done 2026-09-30 |
| S1 | `charter.md` (one page): principles, values, identity, invariants | wording confirmed | ✅ done 2026-09-30 |
| S2 | `grammar.md`: 4 units, 9 patterns (`EXIT` added, Codex review applied), roles, paragraph purposes, genres + corpus evidence. First scope TypeScript, Python (Java held as S2.5) | reconfirm 100% mapping of corpus tables (TS 7,214 · Py 879 · Java 162) | ✅ done 2026-09-30 |
| S2.5 | Pin a permissively licensed Java corpus (Apache-2.0 candidates: guava, commons-lang, spring-framework) + Java support in the census. Codex review 3 | recount Java tables from the pinned corpus, 100% pattern mapping | ⏸ on hold — Java excluded from the first scope (2026-09-30) |
| S3 | Surface-form data schema (kind → pattern) | every existing kind mapped, tests. Ambiguous Python rows (`a = v`) never grouped into one table with certain rows (grammar decision rule 3) | ✅ done 2026-09-30 |
| S3.5 | Check report + AI review loop: pass/fail of safety checks S1–S4 + alarms A1–A9 (over hard/soft limit, ambiguous, REFUSE, two-row pair, outlier cell, large change, unmapped kind, suspected cover-up by alignment) as text and `--json`. The AI reads only the alarms, proposes verdicts and fixes into `.boxbox/cache/review-queue`, and loading happens after human confirmation. Applied first to the 182 corpus types (the M1.5 verdict bottleneck) | report determinism tests, AI suggestions attached to corpus types | ⏸ waiting to move into REL6/REL7 — ① report done 2026-09-30 (`development/tools/report.ts`, `common/report.ts`), ② baseline comparison done 2026-09-30 (`--baseline <file|none>`; separates new and existing alarms against the baseline, pairs by kind and target, `docs/authoring-flow.md` section 3), A0 "pending alignment" and A12 "out-of-table padding" added, ③ first AI pre-verdict pass done 2026-09-30 (top 20, Codex; note below), ④ alarm A10 "mixed properties in a paragraph" (non-table sentences also need classification by pattern and declaration kind; exception for a guard right after a definition), A11 "source → derived" (suggest a blank line only when lower rows actually reference the top row's name and at least two table rows remain; without a reference, neutral "shape change" information). Both are suggestions only, with no automatic blank-line insertion |
| S3.6 | Authoring hooks (`docs/authoring-flow.md`, Codex review applied). **First scope:** Claude Code only, GUIDE injection before writing + a **read-only** report after writing, baseline recording and separating new/existing alarms. **Deferred:** automatic whitespace alignment (after measuring the host execution contract; forbidden if order cannot be guaranteed), Codex and Cursor adapters, DB approval wiring | write on a real host → hook fires → only new alarms delivered, latency recorded | ⏸ waiting to move into REL9 — implemented and verified by simulation 2026-09-30 (`hooks/hooks.json`, `development/tools/hook.ts`, `common/hook.ts`: 3 core lines at session start, new-file guidance once per session, read-only post-write report with only new alarms, only agent-fixable alarms A0, A1, A3, A4, A7, A9, latency recorded). Remaining: install in real Claude Code and confirm |
| S4 | Convention rule file schema + WHEN W1–W4 + user overrides (`.boxbox/config.json`: disable rules, scopes, genres; trying to disable an invariant is a schema error); convention candidate "positional argument columns" (for the same call name, argument i goes in the same column even when argument counts differ: positional arguments only, at least two shared leading arguments, padding cap, settled by verdict); line width baseline: measure in the reference environment → hard and soft limits, replacing the fixed 120 (`docs/research/column-width.md`) | schema tests, measurement record | ⬜ todo |
| S5a | **Pattern records + lookup (report only)** (= M1.7 P3–P4, Codex lookup review applied): lookup key `v1\|language\|context\|kind\|axes` (depth excluded, empty context is `-`, separate from the diagnostic signature), record id, key, pattern, status, scope, examples, evidence, versions, approvedBy (shape is S5e), preset + project layers, a conflict within the same layer, key and scope is a conflict, the report attaches approved/rejected/unknown/conflict per table. Behavior unchanged. Putting the key into the result JSON is S5d | lookup determinism, layer and conflict tests, behavior unchanged | ✅ done 2026-09-30 |
| S5b | Example and decision records (Codex DB review applied: per-rule required alarms has/lacks, test meaning per verdict, versions, status, hashes, replacement, decisions as an index pointing at document hashes, taste excluded from evidence). The evidence and tests of pattern records | every approved example runs as a test | ✅ done 2026-09-30 (`common/examples.ts`, `development/tools/examples-check.ts`, preset `examples.jsonl` and `decisions.jsonl` empty) |
| S5c | First fill: build pattern and example candidates from the top corpus types and today's decisions, and load them with user approval | approval records, tests pass | ⏸ waiting to move into REL6 — candidate generation, human approval and loading not done |
| S5d | Lookup as a gate: only approved patterns FIX, rejected ones stay as is, unknown ones SUGGEST + candidate queue | check the corpus status change report | ⬜ todo |
| S5e | Connect with M3: move shapes from code (`grid-kinds.ts` `KIND_AXES`, profiles) to the pattern DB | existing golden files identical | ⬜ todo |
| E1 | **Model evaluation harness** (`docs/research/model-eval.md`): price canon (Codex, Claude), measure precisely only when this system runs (`purpose` system/dev-review, input, cache and output separated), 7 same-condition rules, accuracy as κ, macro-F1, Wilson, McNemar, repeat σ, experiment protocol `docs/research/eval-protocol.md` (pre-registration, 0 judging guideline → 1 pilot → 2 main study, same conditions enforced by the runner's manifest), axes task × model × effort × prompt (lightweight first: gpt-6-luna, claude-haiku-4-5), escalate one level when stuck (report cost per completed item) | pilot result table, pass criteria settled | ⬜ todo |
| S6 | Package the engine CLI, split the release build into `plugin/` (R1–R3) | run after a marketplace install in a clean environment | ⬜ todo — `plugin/` split done in PKG1 (2026-10-07); engine publication pending |
| S7 | Rewire docs: AGENTS.md, SKILL.md (procedure only), design.md, dissolve `readability-contract.md` | `bun run check`, link checks | ⬜ todo |
| S8 | English translation before release (including the check report body) + Korean residue check (excluding CJK test data) | CI check passes | ✅ done 2026-10-07 (`test/language-policy.test.ts`) |

S3.5 ③ note (2026-09-30): `development/tools/corpus-triage.ts` sends representative cases of the top 20 types (public sources only) to Codex and writes proposed verdicts to `~/.cache/boxbox/corpus/review-queue.jsonl`. They show in SUMMARY.txt as an `ai=` column. **They are only suggestions; verdict records are written only by a human with `--verdict`.** Result: correct 13, taste 7, different-role and missing-kind 0 — no grouping errors in the top 20. Of the 7 taste items, 3 are padding fitted to a long exceptional element (covers-reducible) and 3 are `expect` assertion tables (call-statements). **Finding:** Codex flagged the space before `;` as "unnecessary" in almost every type (pushed-apart). The `;` column is a convention the author approved, but the AI did not know it and judged by general taste → the AI must be given the active conventions (layer 3) to judge by them. The same work fixed the backlog item where `corpus-judge.ts` ran its CLI on import (`bun run check` about 165 s → 29 s).

Evidence material (research citations, corpus measurements: pattern distribution, 51.5% in function bodies, if/for/paragraph measurements of our code) moves to `docs/research/` in S2.

## Next milestones (detailed when they become active)

| Milestone | Design phase | Outcome |
|---|---|---|
| M2 Run-last | P0.5 | `boxbox format` / `boxbox check` wrapping one configured formatter; fixed-point tests |
| M3 Declarative registry | P1 | rule identity = language + context + kind + signature; five review states |
| M4 Corpus | P1.5 | pinned open-source manifest; L1 runner; L2 signatures; judged cases |
| M5 Rules and layers | P2 | `rules/<language>/<region>/` files; preset `recommended`; `.boxbox/config.json` |
| M6 Learn | P3 | candidates from a repository; approve / reject |
| M7 Guide and feedback | P4 | agent rule generation; case recording; promotion gate |

## Backlog

Findings outside the active task. Pull into a milestone when relevant.

- Update the stale Codex `stop_hook_active` comment in `product/engine/common/lifecycle-hook.ts` with the next product change. Current OpenAI hooks documentation defines the flag and the implementation already checks it; the 2026-10-21 native evidence measures bounded continuation without collecting the input flag itself.
- Different callees in one table (`run.map(…)` next to `new RegExp(…)`): align `(` after the widest callee and `)` as the cell close, arguments compact (user idea, 2026-09-28). Deferred to M1.5 judging: comparing different calls is rarely useful and `name    (` splits a call. Decide on real data.
- The `;` axis can pad short rows far past column 120 when one row is long (seen in `stress-corpus.ts` during T1, fixed there by extracting a duplicated expression). The checker should warn when alignment pushes a table past 120 columns, pointing to the contract's "simplify the exceptional element first" step.
- `development/tools/stress-corpus.ts` still has ten lines over 130 columns that are not tables.
- Import tables are aligned from 2 rows (the pre-existing import rule), unlike other tables (3). Decide whether imports follow the 3-row floor in T4.
- Declaration tables (01.2 and 04.2): let a multi-line declaration's first line join the `=` column; keep declarations and plain assignments apart (agreed 2026-09-28). Inner layers and outliers: M1.6.
- T3: Rust re-parse is unverified locally (`rustfmt` not installed); CI installs it and runs with `BOXBOX_REQUIRE_PARSERS=1`, but the workflow change is unverified until the branch is pushed.
- T3: the TypeScript re-parse gate starts two TypeScript 7 servers per written file (~0.3 s); fine for `--write`, revisit for bulk runs. Updated 2026-09-28: `loadSourceFile` now closes its server (the unclosed ones accumulated gigabytes across runs — seen as ~30 GB in Activity Monitor during repeated checks); the corpus census instead opens one server per source in batches of 25 files.
- T3.5 findings (fixed): (1) the preservation check treated trailing whitespace after a line comment as content, so 10–57 tables per 1,000 variants were refused although the edit was safe; (2) the TypeScript aligner was not idempotent in one pass when lines contain mid-line tabs — `--write` now repeats until stable (max 5 passes).
- T3.5 cost: `bun run check` takes ~19 s with the default mutation counts (1,000 per line-engine language, 5 TypeScript variants). Large runs: `BOXBOX_MUTATIONS=20000` (~2 min, passed 140,000 variants), `BOXBOX_TS_MUTATIONS=100` (~2 min, passed).
- T3.5 deviation: TypeScript runs 5 variants by default instead of 1,000, because each variant starts TypeScript 7 servers through the CLI. A pure in-process TypeScript alignment API would lift this (M3).
- Python on its official `tokenize` / `ast` (engine-level strengthening, moved out of M1.5 on 2026-09-28): revisit when verdicts show the regex profiler missing Python structure.
- `.tsx` is not covered by the TypeScript token check (JSX text whitespace is significant); decide before supporting TSX.
- The stress corpus uses OpenJDK (GPL with classpath exception): keep it for checks only, never copy snippets into fixtures (see design §5.2).
- Product naming completed on 2026-10-16: product/CLI/skill `boxbox`, public npm installer `boxbox-plugin`, display name `BoxBox`, environment prefix `BOXBOX`.
- Choose a license before publishing.
- The rules for YAML/JSON (design §4.3, 3.4) need a horizontal-only safety rule before any implementation.
- N4 leftover: a multi-line object literal whose continuation lines align on the first property (hand-made sample, `00_normalize-imports.ts`) — not covered by the guard-row and subscript work; decide with M1.5 judging.
- ~~`development/tools/corpus-judge.ts` runs its CLI at module load~~ — fixed 2026-09-30 (`import.meta.main` guard).
- Out-of-table padding cleanup (2026-09-30): `development/tools/strip-stray-padding.ts` removed fake `;` columns on statement-regime lines (39 files, trailing whitespace only, token preservation checked per file). Lines aligned by hand into several columns, and lines forming a `;` column with a neighbor, may be tables the engine does not know yet, so they were left — about 200 hand-aligned lines remain outside tables (interfaces broken by comments, two-line blocks, config objects the engine refuses, ...). They are reviewed separately as table candidates for the engine to learn.
- S5a note (2026-09-30): `common/conventions.ts` (record validation, JSONL, layers, glob, conflicts), `lookupKeyOf` (`common/signature.ts`), the report's `conventions` column and "Pattern DB" summary line. The preset DB (`product/rules/presets/recommended/conventions.jsonl`) is still empty, so every table is unknown (to be filled by approval in S5c). Grounds for excluding depth: of 4 keys that merged types differing only by depth in the AI pre-verdicts, 3 had the same judgment, and the cause of the 1 that split (a declaration `=` table) was not depth but a two-row table and a long exceptional element (A3 and A1 caught it per table).
- AI usage records (2026-09-30): hook injections go to `.boxbox/cache/usage.jsonl` (estimated tokens: 1 per 4 ASCII characters, 1 per other character), external AI to `~/.cache/boxbox/corpus/ai-usage.jsonl` (values reported by Codex), the summary to `bun development/tools/usage-report.ts` (by model, source and event; agreement rate between AI pre-verdicts and human verdicts), and `--doc` regenerates the release cost document `docs/research/ai-cost.md`. Records keep the model and reasoning effort (Codex: gpt-6-sol, medium). Simulated measurements: session start about 121, new-file guidance about 123 (once per language per session), post-write alarms about 56–126 (only with new alarms), edits without alarms 0. Today's 5 Codex cross-reviews total 77,590 tokens (3,919–27,877 each). The first corpus pre-verdict pass (20) predates recording, so there are no numbers. Usage of the Claude session itself is checked with Claude Code's `/cost`.
- File section order rule and AST move tool (2026-10-03, verified in a real TS repository): move §1 public types → §2 constants → §3 public functions → §4 internal processing into `readability-contract.md` as a rule, and bring into `scripts/typescript/` a tool that moves only whole top-level statements with the TypeScript 7 AST (`functions`: hoisted internal functions to the end, `types`: public type/interface before the first executed declaration; excludes `typeof`-derived types, declaration merging, file headers and directives; restores everything on a re-parse mismatch after writing). It changes the order of non-whitespace tokens, so it must be an opt-in command separate from the design §2 invariants. The original implementation, tests (15 counterexamples) and 2 Codex reviews are in that repository.
- Function paragraph rule candidates (2026-10-03): F1 guard → F2 prepare → F3 process → F4 result. The survey found guards and preparation alternating is normal, and new declarations after processing starts are the main deviation (75 of 366). It is an observation/SUGGEST target, not an automatic fix, and turning it into a rule follows the approval path of the shape observation experiment below.
- Project code shape observation (2026-10-04 OBS1 implemented and machine-verified, audit skipped this session at the user's direction; S5c auxiliary experiment, `docs/reviews/2026-10-03-codex-code-shape-db-review.md`): only named TS functions; `.boxbox/cache/shape.jsonl` stores the version, input fingerprint, scan scope, completion status and unit observations (in-scan id, parent, range, segment list). Output covers per-shape counts, classifiable share, representative locations and counterexamples; only human-picked cases go down the S5b path. SQLite, all languages, rename tracking, GUIDE injection of unapproved shapes and distribution-based automatic fixes are on hold.

## Product naming decision — 2026-10-16

The user selected `BoxBox` as the product, `boxbox` as the core CLI/skill/plugin ID, and authorized `boxbox-plugin` as the public npm installer candidate; display names use `BoxBox` and environment variables use `BOXBOX`. The previous `xxx` / `XXX` placeholders are retired. This naming change does not publish either release artifact.

Naming confirmation (2026-10-16): the user selected `boxbox` as the final product name.
