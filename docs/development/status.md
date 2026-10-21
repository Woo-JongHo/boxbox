# Release readiness

**Active: READINESS1 completion loop.** The user authorized plan, implementation and verification of the accumulated
requirements without per-step confirmation. See the [phase table and acceptance gate](plan.md#completion-loop--readiness1-2026-10-21).
Earlier sections below preserve their scoped results; they are not a final release verdict.

Current loop: R1 record validation, the development-only SQLite catalog and safe copy installation passed focused
checks and independent review. Four-language syntax checks, JSON/YAML adapters and effective approval facts are
implemented; reviewed preservation fixes passed the frozen integration run: **632 passed, five existing missing-parser
skips, zero failures**, plus TypeScript and shell checks. Internal aliases were migrated and verified in copied skills
and installed bundles. The 45 catalog scenarios remain design-only, and new JSON/YAML preset rules plus four example
licenses await human decisions. Native testing found a macOS symlink-path HUD entry-point defect; the correction passed that
full run and 24 focused HUD tests. One later test-only upgrade regression passed separately. GLM source audit passed
with no mandatory findings; the supplemental test binding check also passed. Current-candidate CI/host acceptance remains open. These facts supersede historical snapshots below.


## Active work — AUTHOR1 matrix-first workflows

The user authorized Write, Refactor and Align with shared Check and preview on 2026-10-21. The 0.2.4 source
candidate adds `guide --authoring` before composing code and a standalone `align` command that never runs an external
formatter. Write and Refactor are host-agent workflows; their behavior and performance need separate verification.
Alignment preserves line structure, indentation and non-layout content and refuses proposals beyond that boundary.
At the AUTHOR1 snapshot, ordinary `guide`, `check` and `format` supported TypeScript/Python;
JSON/YAML were planned. READINESS1 above records the later integration. See [workflow selection](../user/modes.md) and [acceptance work](plan.md#active-task--author1-matrix-first-workflows).

Implementation verification passed: `bun run check` completed with 554 passes, 5 existing missing-parser skips and no failures.
The final archive registered in both native hosts using disposable profiles; both installed launchers completed the new
Guide/Align/Check flow. Sonnet 5.5 review passed after the initial session-limit blocker. At the user's request,
GLM 5.3 replaced Opus for this task's final audit and returned PASS with no mandatory fixes. Both reviews were static;
broader native skill activation and authoring-quality evaluation remain open. See the [AUTHOR1 evidence](reviews/2026-10-21-authoring-modes.md). Active local profiles
remain on 0.2.3; this candidate has not been publicly released. Prior HUD evidence has separate coverage.

## Matrix follow-up and remaining release work — 2026-10-21

The subsequent matrix changes passed **571 tests, 5 existing parser skips and zero failures**, plus type checking,
plugin validation, isolated installed-launcher checks and scoped Sonnet/GLM reviews. This supersedes the 554-test
implementation snapshot above for the matrix scope; it is not a fresh cross-platform release verdict. See the
[matrix evidence](reviews/2026-10-21-matrix-columns.md). New guard/call/dot keys have no additional public preset approval.

| Remaining work | Observable completion |
| --- | --- |
| Consistent internal aliases | Migration and isolated copy/bundle execution passed; final integrated GLM closure remains open. See [alias acceptance](plan.md#import-alias-follow-up--user-requirement-2026-10-21). |
| Authoring quality and rule coverage | Real host Write/Refactor scenarios, missing-boundary reporting and rule-specific approvals cover the requested patterns. |
| JSON/YAML | FORMAT1 adapters, preservation/refusal cases, approved examples and installed verification pass. |
| Syntax and stored records | Read-only syntax and runtime record validation implemented and tested. Derived development SQLite indexing is implemented; it is not runtime approval authority. |
| Hosts and HUD | Complete outstanding native hook/HUD acceptance within the declared host/OS support table. |
| Release candidate | Run the existing CI/candidate pipeline against the final version; verify supported OS installs, public payload contents, documentation, licensing and publication access before tagging/publishing and external installation. |

The configured `@/` alias serves internal engine imports as well as tests/development tools. READINESS1 migrated
169 module specifiers across 57 files and verified copied-skill resolution, dependency boundaries and release bundles. [Issue 008](issue-library/records/BBX-20261021-008-import-alias.json)
tracks this distinction. Active host profiles still use 0.2.3.

## Deferred work — HUD2 terminal visibility

The 0.2.3 local candidate is installed for Codex and Claude Code on this Mac. Claude uses its official statusLine;
`~/.local/bin/boxbox-codex` launches actual Codex with a separate tmux HUD pane. Ordinary `codex` is unchanged.
Native captures prove both screens show engine readiness and respond to an invalid project config and recovery.
Codex exit code 0 and owned-server cleanup were measured. Hook trust was not granted; temporary workspace trust
was accepted only for the empty native test project. Desktop and Windows HUDs are outside this adapter's scope.

Sonnet and fixed Opus review attempts both returned the provider's session-limit response. At that snapshot independent review was
**unexecuted and blocking final acceptance**. READINESS1 later obtained Sonnet review, fixed findings and passed
its scoped closure; current-candidate native rendering and the requested GLM final audit remain pending. See the
[HUD record](reviews/2026-10-21-terminal-hud.md) and [user instructions](../user/hud.md).

## Documentation and consistency audit — DOC1

Current request: detailed maintainable docs, consistent inspection stages, storage/grammar validation and HUD status.
Start at the [maintainer index](README.md). Architecture, inspection, storage and change recipes use a common structure.
Current versus proposed behavior is explicit. The [audit](reviews/2026-10-21-maintainer-docs.md) records tests and gaps:
at that audit baseline read-only check did not validate syntax, runtime record validation was incomplete, and common result tests omitted
Swift/Kotlin. READINESS1 subsequently implemented a derived development pattern index; it has no runtime approval authority. At the DOC1 audit baseline, HUD was an on-request development panel; HUD2 above adds terminal adapters.
DOC1 is complete: Sonnet corrections and final Opus fix verification passed. Proposed runtime improvements remain open;
CODEX1 remains open while AUTHOR1 is active. The DOC1 pass changed no package, engine, approved rule or host trust setting.

Updated: 2026-10-21 (AUTHOR1 bounded implementation verified; Sonnet and GLM audits passed) · Source baseline: `07f568c`

## Goal and current verdict

The first public target is **TypeScript, Python, JSON and YAML + the CLI + a thin agent plugin**, expanded by the
user on 2026-10-21. Current source and installed candidates execute TypeScript/Python/JSON/YAML checks; JSON/YAML default write approvals
and current-candidate host acceptance remain pending in [FORMAT1](plan.md#planned-scope-expansion--format1-json-and-yaml).
The earlier user-selected host test target is **Windows Codex on another PC** (2026-10-16).
Safe writes, the Node package, the public CLI foundation, config layers, approval proofs and the formatter core are implemented.
GUIDE and format are connected in the public CLI and the installed artifact. The plugin folder `plugin/` installs in both
Claude Code and Codex. **This is not a completed public release.**

- [Execution TODO](plan.md): the canonical source of status and next work
- [Real implementation](implementation.md): structure, execution paths, limits
- [Real corpus DB](corpus-data.md): provenance, observations, candidates, examples, verification numbers
- [First release contract](release-contract.md): support candidates and surfaces excluded from publication
- [Handoff for verification by another AI](handoff-2026-10-05.md): code map, 12 held IDs, reproduction commands and independent review questions
- [Release tracking harness](../../development/harness/README.md): run history DB (`runs.jsonl`, `latest.json`) and a report against the REL table

## Open work — CODEX1 native hook acceptance

Controlled macOS Codex CLI 0.163.0 sessions loaded the unchanged BoxBox 0.2.2 plugin in a disposable profile.
Native transcripts prove SessionStart developer context, an apply_patch PostToolUse FAIL delivered as context/tool
feedback, exactly one Stop continuation, and a passing recovery. The HUD reads the recovery receipts as recorded/PASS;
its hostAcceptance stays unverified because receipts alone do not attest delivery. Default untrusted SessionStart/Stop
were skipped, and all three reviewed hook hashes remained untrusted after the one-invocation tests.

Windows Codex 0.157.1 delivered SessionStart context, but its native read-only sandbox/approval policy rejected the
requested edit despite workspace-write argv. The fixture stayed unchanged; PostToolUse and failing Stop/recovery
acceptance remain blocked there. Sonnet 5.5 fixes and final Opus 5.5 fix verification passed. Persistent active-profile trust,
desktop behavior, Claude event delivery and public registry publication remain separate. See [the native evidence](reviews/2026-10-21-codex-native-hooks.md).

## Completed delivery — DELIVERY1

The user-selected issue forms → PR verification → candidate generation pipeline is operational on private GitHub
`Woo-JongHo/rowgrid`. PR #2 preserved main history/LICENSE and merged the current development layout. Its final
Ubuntu/macOS verification passed 496 tests on each OS with zero skips/failures. Actual manual candidate run39543872402
passed all six jobs, including same-archive Linux/macOS/Windows installed TypeScript/Python journeys.

The exact downloaded 0.2.2 archive is 126691 bytes, SHA-256
`611858a6b7f72e1a27aaddf9593d5a1404a0baf7c705bb2ec21ea2f2bbec7137`. It is installed/enabled in local Codex; installed
doctor/check and the development HUD passed. In a fresh session invoke `$boxbox-status` for the on-request panel.
Sonnet 5.5 findings were resolved; final Opus 5.5 passed. Full reports and destination delivery details are in
[the operational delivery record](reviews/2026-10-21-github-delivery.md).

The private GitHub plan cannot enforce required checks (HTTP 403); visibility is unchanged. Public npm publication,
native host hook-event acceptance and full Windows development-suite support are separate from these passes.
DELIVERY1 is verified; the user authorized continuation on 2026-10-21. No public release is claimed.

## First-use formatting — 2026-10-21

The user authorized the fix for [GitHub issue #1](https://github.com/Woo-JongHo/rowgrid/issues/1) and approved two exact
recommended rules: TypeScript top-level single-call variable declarations (2+ rows, `.ts`) and Python simple assignments
(3+ rows at the same indentation). Only the four synthetic examples were separately authorized for CC0-1.0.

The 0.2.1 candidate aligns those patterns without an external formatter or personal approval DB. A configured formatter
still runs first and fails explicitly when broken. Check reports provisional approval eligibility and points to dry-run
for actual parser/preservation/fixed-point verification. Hooks stay read-only.

Native Windows Node 24.12.0 / Python 3.14.0 / Codex 0.157.1 passed isolated npx installation, installed/enabled listing,
approved GUIDE, dry-run with original hash preserved, explicit Python format, token/parse checks and byte-identical
rerun. An optional configured formatter also passed. A shadowing unrelated `codex.exe` exposed during the first test is
now skipped using a bounded identity probe. Native host event delivery remains unverified and is not implied by registration.
Full verification passed 482 tests / 5 existing skips / 0 failures, with TypeScript/shell and plugin guard checks.
Sonnet review fixes and the final Opus follow-up passed; the latter also closed the prior layout findings. The tested
0.2.1 candidate was delivered to chacada; this is an unpublished worktree candidate.
See [the complete evidence and destination receipt](reviews/2026-10-21-first-use.md).

## Layout migration — 2026-10-20

The source/development/distribution separation is implemented; [layout.md](layout.md) owns the directory contract.
Product sources are in `product/`, internal tools and data in `development/`, fixtures in `test/fixtures/`, and docs in
`docs/user/` and `docs/development/`. `plugin/` is completely regenerable and `dist/` remains generated output.

Migration baseline (2026-10-20): **452 pass / 5 existing skips / 0 fail**, TypeScript and shell syntax passed; the plugin guard and both isolated host registrations passed.

Sonnet 5 review fixes passed its follow-up. The first Opus audit identified dangling output links and stale paths;
those were fixed with regression coverage. The 2026-10-20 Opus follow-up was unexecuted because the provider returned a session-limit error. The actual
2026-10-21 Opus follow-up has now closed both carried-forward findings; no lower model was substituted.
See [the migration evidence](reviews/2026-10-20-layout.md). Publication remains pending.

## Implemented and remaining

| Area | Implemented and verified | Remaining |
|---|---|---|
| Safe writes | parser missing/failure blocked, TS multi-pass and line-engine working-copy verification with one replacement, external-edit conflicts refused | TS native API timeout, measurements on other OSes |
| Node release candidate | isolated bin run after confirming real Node, offline and empty-npm-cache installs | Linux and supported-host checks |
| CLI | init, doctor, check, guide, format, run, status, hook, `db init/status` local user DB, synthetic approval journey on the installed artifact | DB editing, import, backup; broader real-project approval coverage and real-session host event delivery |
| Config | Base → Preset → User → Project, in-memory schema 1 migration, schema 2 partial config, fingerprint | real user project journey |
| Approval and GUIDE | exact key, scope, layers; full proof checks; two rules and four examples approved on 2026-10-21 | other candidates remain unapproved |
| Formatter | optional explicit command → parser → approval → BoxBox, fixed point over two full runs, verified on the installed artifact and dry-run | a real project formatter case |
| Evidence DB | 8 public repositories, 7,759 files → 18,613 table observations / 88 rule keys, 311 own functions | review and promote frequent candidates; SQLite not introduced |
| Hosts | Isolated Codex/Claude installer registration and repair passed; macOS Codex 0.163.0 PostToolUse/Stop control flow passed; SessionStart delivered into native response history on macOS/Windows, without a model acknowledgment claim; Windows explicit CLI acceptance and scoped final audit passed | Windows native editing blocked by host policy; persistent trust, Claude event delivery, publication/registry installation remain separate |
| Product finish | brand confirmed: boxbox/BoxBox, 0.2.2, private; docs and code in English (S8 done 2026-10-07) | license, channel, update/removal, release |

## Verification state

Latest dual-host installer verification: `bun run check` **440 pass / 5 skip / 0 fail** (2026-10-16); TypeScript and install-shell syntax checks passed.
The first run failed because the offline artifact install required `typescript@7.0.2` in npm's cache. After an isolated online
install populated that dependency, the full rerun passed. The five Rust/Kotlin parser skips remain unexecuted, not passes.
Claude Code 2.1.286 and Codex 0.162.1 both accepted the renamed plugin in isolated homes; this does not prove real-session hook acceptance.

The unpublished `boxbox-plugin@0.2.0` installer is **113,430 B / 32 files**, with SHA-256
`86b16fdca7f517c5869c51fda96d15c72af2ed0646725cebb4bea87486f0be36`. Its dedicated suite passed seven tests and 219 assertions.
Real npx single-bin inference, both hosts' initial installation and repair, cache/origin removal, permanent doctor/check,
and the Codex cached launcher passed on macOS. The npm publish dry run passed; npm authentication is complete as `woojongho`. Both the initial and focused final Opus audits passed for the installer scope. Actual public publication still needs its separate decision.

The items from Sol's read-only review of the public preset boundary were fixed, and the last re-review found no further
findings in that scope. This is not a final independent audit of the whole repository.
See the [DB boundary record](reviews/2026-10-04-public-preset-db-boundary.md).

On 2026-10-06, reruns hit the default 5-second test timeout in 1–3 tests (java re-parse 5.7 s, the public CLI format refusal
loop and others — 1–2 s when run alone), because integration tests that start real toolchains (javac, tsc, formatter child
processes) exceed 5 s under full-suite load. The `test` and `check` scripts in `package.json` use `--timeout 60000`.
When citing these numbers as evidence, state the network and cache preconditions.

Latest `bun run pack:cli` (2026-10-16): `boxbox@0.2.0` tarball **40,629 B compressed / 163,240 B unpacked, 6 files**.
It carries only the CLI bundle, README, manifest and three empty preset JSONL files, and the public artifact test ran the real
Node isolated install journey. That historical 0.2.0 package had no approved preset rows; the current 0.2.1 candidate has the two approved rules described above.

## Next resume point

DOC1 documentation is complete. AUTHOR1 is active; HUD2 is deferred pending independent review; CODEX1 remains open. Controlled native evidence is audited; Windows edit-dependent events remain blocked by
the effective native read-only sandbox/approval policy. Registry publication remains a separate decision.
FIRSTUSE1 explicit formatting and candidate delivery, DELIVERY1 CI/HUD, and LAYOUT1 separation/audit are verified.
Public registry publication and native acceptance outside the measured test scope remain open. The two exact preset rules have human approval; broader
candidates still require a decision. Research evidence is kept separately in `~/.cache/boxbox/corpus/`;
the observation JSONL is **18,613 lines / 11,207,375 B** and the aggregated signatures **175,183 B**. Including the public repository
checkouts, the whole research cache is **715,920 KiB (about 699 MiB)**. None of this data is in the npm artifact.

The plugin user DB is created with `boxbox db init` as three empty JSONL files in `$XDG_CONFIG_HOME/boxbox` or `~/.config/boxbox`, and
`db status` prints only line counts and bytes. The three public preset JSONL files are a separate release boundary owned by the maker
and now contain 2 conventions, 4 examples and 2 decisions. The 88 candidates and 225 representative examples (213 pass, 12 held) are review material.

Release blockers: real host event acceptance, remaining other-OS journeys, license/channel decisions and final full-product security review,
and **publication approval and registry installation of the selected `boxbox-plugin` installer are pending; core CLI and skill IDs remain `boxbox`**. The npm tarball excludes the research DB but
includes the 159,096 B runtime JavaScript bundle, so the CLI implementation is not kept private by design.

There is no dedicated ESLint command. `bun run check` runs tests, the TypeScript type check and install-shell syntax. The repository's
own aligner and normalizer keep the standing criteria (`misaligned=0`, `changed=0`) over the TypeScript files in
`product/engine/`, `scripts/`, `test/` and `development/harness/`, and the self-align stage of the release tracking harness verifies this on every run.

Git baseline: GitHub main `e8362d2` includes the merged development layout, CI and delivery records. Native-hook
evidence branches from this baseline; source/plugin bytes and the delivered 0.2.2 archive are unchanged.
No npm publish or tag has been made.

## Product naming and distribution decision — 2026-10-16

The user selected **BoxBox**. Core CLI, private engine, skill and plugin IDs use `boxbox`; environment variables use `BOXBOX`.
The repository is `98_BoxBox`. `product.json` owns `displayName` and the public installer `npmName`, now **`boxbox-plugin`**.
The user authorized an available npm name after confirming they do not own npm `boxbox`. The chosen `boxbox-plugin` returned E404;
that does not reserve it. The machine is authenticated as `woojongho`; publication and real registry `npx boxbox-plugin` are pending.

The installer targets **Codex and Claude Code**, with native Windows Codex as today's test priority. It installs permanent
local engine/plugin files rather than relying on an npx cache or ZIP transfer. See [installation status](../user/codex-windows-test.md)
and the [current migration record](reviews/2026-10-16-boxbox-rename.md).
Earlier naming evidence remains historical: [first pass](reviews/2026-10-12-boxbox-rename.md), [EggBox pass](reviews/2026-10-12-eggbox-rename.md).
The separate full-product audit and release remain open.

Syntax-case collection now precedes new layout policy (user direction 2026-10-12). The first version-pinned TS/Python inventory and 291 parser-verified synthetic examples are in `development/corpus/syntax/`; see [scope, counts and remaining variants](research/2026-10-12-syntax-case-inventory.md). All alignment decisions remain unreviewed; these records are not approved presets.

Syntax collection continuation: added 1,200 multirow variants and 16 expected syntax-rejection counterexamples, reproducible via `development/tools/build-syntax-variants.py`. Combined 1,507 inputs passed expected parsing outcomes. Alignment decisions remain unreviewed; this is bounded TS/Python collection, not exhaustive combination or aligner verification.
