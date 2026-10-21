# AUTHOR1 documentation integration

## Owned files

README.md, README.ko.md, README.zh-CN.md, docs/development/plan.md, docs/development/status.md, docs/development/design.md.

## Changes

- Added equivalent workflow sections in EN/KO/zh-CN: Write and Refactor are host-agent workflows, Align is a bounded horizontal-layout engine operation, Check remains read-only, and preview preserves the target.
- Added identical authoring-guide and align command forms plus docs/user/modes.md links in all root README languages.
- Labeled the new work as the 0.2.4 source candidate; integration verification and independent review remain in progress. Preserved historical HUD0.2.3 installation and evidence claims without expanding their scope.
- Corrected language support labels: TypeScript/Python are implemented; JSON/YAML are first-release target additions, not implemented support.
- Made AUTHOR1 the sole active task under the user's latest implementation authorization. Deferred HUD2 pending independent review without claiming it passed. CODEX1 remains open/deferred.
- Added explicit workflow boundaries in design and distinguished LEARN/GUIDE/REVIEW data-lifecycle concepts from user edit modes. Removed the stale blanket statement that BoxBox has no agent refactoring workflow; deterministic CLI versus host-agent responsibilities remain clear.
- Preserved earlier documentation/localization/HUD changes and historical evidence. No runtime, approval data, generated plugin, package version or installer mutations in this pass.

## Verification

- All three README code-block bodies match (5 blocks each), link targets match (22 links each), and the new command forms are identical.
- Local Markdown file link targets in all six owned documents exist. Anchor names newly added match the target heading; old removed heading anchors are not referenced elsewhere under docs/ or root READMEs.
- git diff --check passed for all six owned files.
- The actual active task marker belongs to AUTHOR1; HUD2 is deferred. Status-legend mentions do not count as tasks.
- Runtime tests and independent review were not run by this documentation worker and are not claimed complete.

## Full current diff (includes preserved earlier changes)

```diff
diff --git a/README.md b/README.md
index de0546c..753af8d 100644
--- a/README.md
+++ b/README.md
@@ -1,5 +1,9 @@
 # BoxBox
 
+[English](README.md) | [한국어](README.ko.md) | [简体中文](README.zh-CN.md)
+
+The linked detailed documentation is primarily in English.
+
 **Read code down. Compare it across.**
 
 This project treats repeated code like a spreadsheet: each same-role statement is a row, and its corresponding parts are columns. It helps coding agents simplify uneven structures, then aligns the remaining syntax into a compact, readable grid.
@@ -49,6 +53,21 @@ The alignment stage changes whitespace only. It checks preservation and compares
 
 The public `format` command requires complete human-approval evidence. It runs a project formatter first when one is configured, then verifies parsing, checks rule approvals and applies alignment. Without a configured formatter, it aligns approved patterns directly. The entire cycle runs twice to verify a fixed point, then replaces the target once. Changes made by the external formatter are separate from the alignment stage's whitespace-only guarantee.
 
+## Write, Refactor, Align and Check
+
+The 0.2.4 source candidate separates agent workflows from engine changes:
+
+- **Write:** the agent implements requested behavior using approved authoring guidance.
+- **Refactor:** the agent improves existing structure and separately verifies behavior and relevant performance.
+- **Align:** the engine adjusts approved horizontal layout whitespace without wrapping lines, changing indentation or running an external formatter.
+- **Check:** inspect existing code without changing it. Missing groups do not establish whole-file style coverage.
+
+`guide --file <file> --authoring --json` supplies approved guidance for an existing, empty or not-yet-created file;
+examples are guidance, not write approval. `align --file <file> --dry-run --json` previews alignment and
+`align --file <file> --json` applies it. Write and Refactor use the host agent, not a CLI generation command.
+Preview leaves the target unchanged; the existing `format` pipeline remains a separate operation.
+Integration verification and independent review are in progress. See [workflow selection and verification limits](docs/user/modes.md).
+
 ## Install the plugin
 
 The public npm installer is being prepared as `boxbox-plugin`; registry publication is pending.
@@ -66,6 +85,22 @@ npm exec --yes --package '/absolute/path/to/dist/installer/boxbox-plugin-<versio
 Replace `<version>` with the version in `package.json`, or use the exact archive path printed by `pack:installer`. This local artifact journey requires the checkout for building. The installed plugin uses its permanent Node engine.
 The public installer needs Node.js 22.22.3 or later and npm; Python formatting additionally needs `python3`.
 
+## Terminal HUD
+
+The local installer candidate supports an opt-in BoxBox HUD on macOS/Linux:
+
+```sh
+npm exec --yes --package '/absolute/path/to/dist/installer/boxbox-plugin-<version>.tgz' -- boxbox --codex --claude --hud
+~/.local/bin/boxbox-codex
+```
+
+Claude Code uses its own status line after restart. Codex uses a separate tmux pane when launched with
+`boxbox-codex`; ordinary `codex` is unchanged. Install tmux first and launch outside existing tmux sessions.
+The HUD shows engine readiness, approved-rule count and observed checks; unknown receipts stay unknown.
+Codex shows history for the pinned startup project, not proof of the current session's acceptance.
+Windows and desktop HUDs are not supported by this adapter. Setup preserves unrelated settings, refuses another
+Claude status line, and does not grant hook trust. See [HUD setup, limitations and removal](docs/user/hud.md).
+
 ## Develop BoxBox
 
 Product sources live in `product/`; development tools, research and evidence live in `development/`.
@@ -86,7 +121,8 @@ sources; `--copy` creates a managed copy. Development authoring hooks require se
 
 | Surface | Coverage |
 | --- | --- |
-| First public CLI scope | TypeScript and Python |
+| Implemented public CLI languages | TypeScript and Python |
+| First release target additions | JSON and YAML (planned, not implemented) |
 | Development alignment engines | TypeScript, Python, Java, Go, Rust, JavaScript, C, C++, Swift and Kotlin |
 | TypeScript detection | TypeScript 7 AST tools and a table-kind registry |
 | Other language detection | A shared line engine with language-specific profiles |
@@ -107,6 +143,8 @@ For verified behavior and remaining work, read [release readiness](docs/developm
 
 ## Contributing
 
+Start with the [maintainer documentation](docs/development/README.md) for architecture, inspection stages, storage contracts and repeatable change patterns.
+
 ```bash
 bun install
 bun run check
diff --git a/docs/development/design.md b/docs/development/design.md
index 492454d..658caf4 100644
--- a/docs/development/design.md
+++ b/docs/development/design.md
@@ -1,12 +1,20 @@
 # BoxBox — Design
 
+**Reading note (2026-10-21):** This draft includes historical implementation notes and proposed commands. Use the [maintainer index](README.md), [current inspection process](inspection-process.md) and [storage contract](storage.md) for current behavior. In particular, public `check` does not run the formatter/parse/fixed-point pipeline; raw parser equivalence is not zero-error validation; the approved TypeScript rule has a two-row exception. The old implementation table below is historical, not the current capability map.
+
 Status: Draft
 Date: 2026-09-28
 Product name: **BoxBox** (confirmed by the user on 2026-10-16); display name: `BoxBox`; environment prefix: `BOXBOX`
 
+**Release target expansion (2026-10-21 user decision):** include JSON and YAML alongside TypeScript and Python,
+covering source code and structured configuration/documents used in AI workflows. Current public execution remains
+TypeScript/Python only. See [FORMAT1 in the plan](plan.md#planned-scope-expansion--format1-json-and-yaml) for the
+proposed safety boundary and acceptance work. Specific JSON/YAML conventions, parser choices and embedded Markdown
+support are not approved or implemented by this decision.
+
 ## 1. Summary
 
-BoxBox is a code readability plugin that aligns code into a readable, table-like layout.
+BoxBox is a code readability plugin that guides matrix-first authoring and checks and aligns comparable rows.
 
 - It is **agent-agnostic**: any coding agent (Claude Code, Codex, ZCode, Pi, or a plain rules file) can plug it in. The engine and data live in one place; hosts get thin adapters.
 - **Current phase: learn and harden.** We collect evidence from real code, find where the engine is wrong, and turn every verdict into a permanent test or registry entry.
@@ -17,10 +25,49 @@ BoxBox is a code readability plugin that aligns code into a readable, table-like
 
 Philosophy: **Simplify first. Align second. Verify always.** — *Follow the structure. Don't force it.*
 
+### Authoring direction clarified on 2026-10-21
+
+The user's central goal is to read code as a matrix. BoxBox must guide agents to author comparable rows and
+syntax-defined columns from the start, then check their work. Post-hoc whitespace alignment is one part of that
+workflow. Row ownership, column roles and syntax boundaries such as commas, closing parentheses, semicolons and
+arrows must be defined by context and nesting, not by matching raw punctuation.
+
+The existing axis registry and authoring contract support this direction. Ordinary `guide` inspects an existing file
+and selects guidance from detected approved groups. The AUTHOR1 0.2.4 source candidate adds `guide --authoring`
+to retrieve approved guidance before an existing, empty or not-yet-created file is authored. The same rule identities
+and approval proofs feed guidance and checks; example availability is not proof that an arbitrary proposed file is safe to write.
+Integration verification and independent review remain in progress.
+
+Structural authoring guidance must distinguish enforceable layout conditions from judgments about
+function purpose, grouping and simplification. Absence of detected tables is not proof that an authoring request was
+satisfied. Unknown patterns must remain visible rather than being silently accepted or forced into a table.
+
+Correctness and performance constrain readability choices: do not add work, allocations, indirection or change
+evaluation order solely to make rows match. Structural edits require appropriate functional verification and,
+where performance may change, workload-specific measurements. Whitespace preservation checks do not establish
+semantic or performance equivalence for agent-authored structural changes. This direction does not approve new
+preset rules or enable automatic refactoring.
+
+### User workflows approved on 2026-10-21
+
+| Workflow | Responsibility | Change boundary |
+|---|---|---|
+| Write | Host agent composes requested behavior using approved guidance | Authorized new implementation; separate behavior verification |
+| Refactor | Host agent improves an existing structure | Required behavior, public contracts and execution dependencies remain constraints |
+| Align | Deterministic engine applies approved layout | Horizontal layout whitespace only; preserve indentation, physical lines and non-layout content |
+| Check | Deterministic engine reports detected groups | Read-only; absent or unsupported groups do not establish whole-file compliance |
+
+Preview is shared: it presents a proposal without modifying the target. The standalone `align` candidate executes no
+external formatter and refuses changes outside its boundary. The existing `format` pipeline remains a distinct operation
+for projects that intend the optional formatter step. Explicit user requests select the workflow; an ambiguous fix starts
+with inspection and clarification when the change scope matters. Multi-file authorization is executed one file at a time.
+See [the user contract](../user/modes.md) and [AUTHOR1 acceptance](plan.md#active-task--author1-matrix-first-workflows).
+
 ### What BoxBox is not
 
 - Not a formatter that normalizes all whitespace (Prettier, rustfmt, black).
-- Not an AI refactoring tool. No LLM sits on the review/fix path.
+- The deterministic CLI does not generate or refactor code. Write and Refactor are explicit host-agent workflows;
+  engine alignment checks do not certify those structural changes.
 - Not a column-alignment switch like clang-format's `AlignConsecutive*` or gofmt's struct alignment. Those group rows by syntax only. BoxBox groups rows by **role**, checks for simplification before aligning, and refuses when it is not sure.
 
 ## 2. Invariants (never change, never configurable)
@@ -31,7 +78,8 @@ Philosophy: **Simplify first. Align second. Verify always.** — *Follow the str
 4. **Relative layout only.** Conventions store slots, anchors and spacing relations — never absolute columns. Width is the minimum the current group needs. Groups never share widths.
 5. **Layer precedence.** Safety > Project > User > Preset > Base. Nothing overrides Safety.
 6. **Only humans approve.** Evidence never auto-promotes into a convention. Agents inspect and propose only.
-7. **Deterministic decisions.** Same input and config → same result. LLMs are used only to consume guides and to pre-triage review queues.
+7. **Deterministic engine decisions.** Same input and config → same engine result. Host-agent Write/Refactor workflows
+   consume approved guidance and require separate verification; they cannot alter the approval policy.
 8. **Single source, thin adapters.** Engine, registry and cases live in this repository. Hosts differ only by install location and manifest. The result JSON schema is versioned as a public contract.
 9. **BoxBox runs last.** BoxBox is the final pass after the project's code formatter. The canonical form of a file is `C(file) = boxbox(formatter(file))`, and it must be a fixed point: `C(C(file)) == C(file)`. The ordering is guaranteed only through the `boxbox format` / `boxbox check` wrapper, which runs the formatter itself (see 3.5).
 
@@ -39,6 +87,10 @@ Philosophy: **Simplify first. Align second. Verify always.** — *Follow the str
 
 ### 3.1 Modes
 
+LEARN/GUIDE/REVIEW below describe the data lifecycle, not extra user-facing edit modes. The current user workflows
+are Write/Refactor/Align with read-only Check and preview, as defined above. LEARN remains a research path rather than
+a public CLI learning command.
+
 | Mode | Question it answers | Output |
 |---|---|---|
 | **LEARN** | How does this repository write same-role code? | Evidence + convention candidates |
diff --git a/docs/development/plan.md b/docs/development/plan.md
index 6f81d4c..cc49e2b 100644
--- a/docs/development/plan.md
+++ b/docs/development/plan.md
@@ -7,7 +7,9 @@ completion verdicts up to release by this document.
 ## Current goal and plan status
 
 **User goal (2026-10-04): finish implementing this service to the point of a real release.** The first public scope is
-**core TypeScript and Python features + the engine CLI + a thin agent plugin**, as chosen by the user. The existing
+**TypeScript, Python, JSON and YAML + the engine CLI + a thin agent plugin**, following the user's scope expansion
+on 2026-10-21. The implemented public CLI still accepts only TypeScript and Python; JSON/YAML are release targets,
+not implemented capabilities. The existing
 10-language engine is kept, but equivalent product quality for Java, Go, Rust, JavaScript, C, C++, Swift and Kotlin is
 not a completion condition of the first release.
 
@@ -30,7 +32,7 @@ install → boxbox init → boxbox doctor → boxbox check → boxbox format →
 human-approved rules and the pre/post-write safety checks all pass. If any step is unclear, it only
 reports and does not write the file.
 
-This plan is an **authoring draft**. Only the choice of the first public scope was confirmed by the user on 2026-10-04. Work order,
+This plan is an **authoring draft**. The first public scope was confirmed on 2026-10-04 and expanded by the user on 2026-10-21. Work order,
 completion criteria and technical decisions are not considered confirmed until independent review, rebuttal, traceability checks and user acceptance.
 The combination of supported OSes and first supported hosts is settled in REL1. Claude Code and Codex are the initial host candidates,
 but this is not a confirmed support table yet. For the product name, license and public channel, REL1 records who decides and by when,
@@ -55,13 +57,12 @@ review. The requirement of full verification before release stays.
   `00_normalize-imports.ts`, `00_expand-interface-members.ts`, `07_wrap-conditions.ts` and `08_function-map.ts --write`
   do not share the same gate. M1's "every write" and 169 tests from 2026-09-28 are records of that time
   and do not mean a guarantee over the current full write surface.
-- The latest full machine verification record is `403 pass / 5 skip / 0 fail`, reconfirmed on 2026-10-06. Reruns that day
+- The historical full machine verification record was `403 pass / 5 skip / 0 fail`, reconfirmed on 2026-10-06; later delivery results are recorded below. Reruns that day
   hit the default 5-second test timeout in 1–3 tests per run (each passed alone), due to the load sensitivity of integration tests that start
   real toolchains (javac, tsc, formatter child processes), so the `test` and `check` scripts got `--timeout 60000`.
   The two isolated artifact install tests have a separate precondition: `npm install --offline` needs `typescript@7.0.2`
   in the npm cache. Skips and unmeasured real hosts are not counted as release passes.
-- The approval proof is connected to public format and GUIDE, but the preset DB is empty. It waits for the human
-  approval answer on two concrete candidates. The existing raw writers bypass the approval policy, so they are excluded from the public artifact.
+- The approval proof is connected to public format and GUIDE. The recommended preset now contains the two rules approved on 2026-10-21, four synthetic examples and two decisions (FIRSTUSE1 below). Other candidates remain unapproved. The existing raw writers bypass the approval policy, so they are excluded from the public artifact.
 - AI model evaluation is a research tool, not a product execution path. The full E1 model evaluation, SQLite and equal quality across 10 languages
   are explicitly on hold and are not automatically promoted to first-release blockers.
 
@@ -69,7 +70,7 @@ review. The requirement of full verification before release stays.
 
 Status legend: `⬜ todo` · `▶ active` · `✅ done` · `⏸ blocked/on hold`.
 
-1. There is always exactly one `▶ active`. The current active task is CODEX1, resumed by the user on 2026-10-21: controlled native Codex evidence is audited, while Windows edit-dependent events remain blocked by native policy. DELIVERY1 issue/PR/candidate automation and installed BoxBox status are verified and accepted for continuation. FIRSTUSE1 implementation/delivery and LAYOUT1 audits are verified. Persistent trust, Claude event delivery, CODEX1 registry verification, DATA2 and PKG1 public release work remain open.
+1. There is always exactly one active task. DOC1 documentation/process/storage audit is complete. The current active task is AUTHOR1, authorized by the user on 2026-10-21; HUD2 is deferred pending independent review. CODEX1 remains open: controlled native Codex evidence is audited, while Windows edit-dependent events remain blocked by native policy. DELIVERY1 issue/PR/candidate automation and installed BoxBox status are verified and accepted for continuation. FIRSTUSE1 implementation/delivery and LAYOUT1 audits are verified. Persistent trust, Claude event delivery, CODEX1 registry verification, DATA2 and PKG1 public release work remain open.
 2. Each REL becomes a completion candidate only with prerequisites, current implementation, remaining work, acceptance criteria and verification evidence.
 3. **Existing** in verification means it is checked with a command that exists now; **new** means the verifier must first be
    implemented in that REL. A command name appearing in the plan is not evidence.
@@ -79,6 +80,86 @@ Status legend: `⬜ todo` · `▶ active` · `✅ done` · `⏸ blocked/on hold`
 5. Implementation complete, plan accepted, final audit and public release are different states. Never say "released" before a tag, push, registry publish and a real
    external install check.
 
+## Active task — AUTHOR1 matrix-first workflows
+
+**▶ active — user authorized implementation of Write, Refactor and Align with shared Check and preview (2026-10-21).**
+
+User clarification (2026-10-21): the plugin should guide code generation into readable rows and columns, then
+verify the result, with correctness and performance preserved. See the [authoring direction](design.md#authoring-direction-clarified-on-2026-10-21).
+The 0.2.4 source candidate adds `guide --authoring` for existing, empty and not-yet-created files and a
+standalone `align` command for approved horizontal layout changes. Write and Refactor remain agent-owned workflows;
+the CLI does not generate code or certify their behavior/performance. Ordinary `guide` and the existing `format`
+pipeline remain available. Integration tests, artifact verification and independent review are in progress; this is
+not a completion or publication verdict. See [the user workflow contract](../user/modes.md).
+
+Acceptance work:
+
+- Provide applicable approved guidance for new/empty files without requiring an existing matching table.
+- Keep generation examples and checks tied to the same rule identities and approval proof.
+- Preserve line structure, indentation and non-layout content in standalone Align; execute no external formatter.
+  Refuse broader engine proposals without falling back to `format`, raw writers or agent structural edits.
+- Verify preview keeps the target unchanged, explicit mode routing, and continuation through user-authorized files
+  one at a time. Keep existing `guide`, `check` and `format` behavior compatible.
+- Separate mechanically enforceable layout from advisory structural decisions; missing/unsupported patterns must
+  not become evidence that the requested authoring style was achieved.
+- Evaluate real agent tasks: new-file generation, extending an existing table, an overlong function/call, and a
+  case that should remain structurally different. Check both correct skill activation and non-activation.
+- Verify behavior after structural changes and measure performance when the changed work requires it. Do not
+  treat an alignment check as a semantic or performance certificate.
+
+New layout templates, broader long-row transformations and additional approved conventions remain separate decisions.
+The workflow authorization does not approve new preset rules, automatic structural rewrites or public publication.
+
+## Planned scope expansion — FORMAT1 JSON and YAML
+
+The user requested JSON and YAML alongside TypeScript and Python for the first open-source plugin release,
+including configuration and structured documents used in AI workflows. This approves the target formats, not
+specific alignment conventions, examples, licenses or parser dependencies. AUTHOR1 remains the active implementation task.
+
+Current gap: there are no dedicated JSON/YAML product adapters. CLI/config admission and the public write pipeline
+are restricted to TypeScript/Python. Adding filename extensions alone would not establish support.
+
+Proposed bounded implementation:
+
+1. Define representative before/after cases and refusals for strict `.json` and `.yaml`/`.yml` files. Start with
+   adjacent sibling key/value rows; exact grouping, row floors and spacing await rule review. JSONC/JSON5,
+   Markdown frontmatter and fenced blocks are separate scope decisions, not implied support.
+2. Use format-aware parsing and source ranges to identify editable horizontal whitespace. Preserve tokens,
+   scalar spelling/content, key order, indentation, line breaks and comments. Protect YAML block scalars;
+   initially skip complex keys, anchors/aliases/tags and other unproven structures with explicit reasons.
+   Do not round-trip through a generic object serializer to implement alignment.
+3. Connect adapters to the shared inspection, approval, candidate verification and commit contracts. Update
+   CLI/config language dispatch, result consumers, hooks and guidance together; retain the same engine for both hosts.
+4. Verify syntax, preservation, idempotence, no-write preview, invalid/unsupported input handling and optional
+   formatter coexistence. Exercise the installed archive on macOS/Linux/Windows before advertising support.
+5. Review proposed conventions and examples before adding approved preset data. Update support claims and
+   localized READMEs only to match implemented and verified behavior.
+
+Syntax validity does not validate an application's schema: valid YAML does not prove a GitHub Actions workflow
+is accepted, and valid JSON does not prove a host configuration is supported. Application-schema checks are a
+separate capability. Parser selection and YAML dialect policy remain open.
+
+References: [JSON RFC 8259](https://www.rfc-editor.org/rfc/rfc8259),
+[YAML 1.2.2](https://yaml.org/spec/1.2.2/). This section records scope and proposed acceptance work, not completion.
+
+## Deferred task — HUD2 visible terminal status
+
+**⏸ deferred pending independent review — user requested persistent BoxBox visibility in Codex and Claude (2026-10-21); AUTHOR1 is now active.**
+
+- Implement a shared installed-runtime collector, Claude official statusLine and an explicit Codex tmux companion launcher.
+- Keep host trust unchanged; label latest-project observations separately from current-session receipts.
+- Packaged installation, settings preservation, real Codex/Claude terminal rendering, state changes and cleanup have been measured. Sonnet and fixed Opus review attempts returned session limits; independent review remains an unexecuted acceptance blocker.
+- Terminal CLI is the working scope. Desktop and Windows HUD behavior are not assumed. Ordinary `codex` is unchanged.
+
+## Completed task — DOC1 maintainer documentation and consistency audit
+
+**✅ done — documentation, bounded probes/tests, Sonnet corrections and final Opus fix verification complete (2026-10-21).**
+
+- Scope: document current architecture/process/storage with a repeatable maintenance pattern; reproduce bounded gaps; propose implementation order and SQLite decision criteria; recheck the installed HUD.
+- Acceptance: current facts separated from proposed behavior, source-linked language/store matrices, actual focused tests and probes, relative-link checks and independent Sonnet/Opus review.
+- Runtime/parser/schema behavior is unchanged in this documentation pass. Syntax inspection, runtime record validation and all-language result coverage are proposed follow-ups, not completed fixes.
+- Entry: [maintainer documentation](README.md); [evidence and findings](reviews/2026-10-21-maintainer-docs.md). CODEX1 Windows native edit restrictions and publication boundaries remain open.
+
 ## Current implementation — DELIVERY1 GitHub candidates and Codex status
 
 **✅ done — implementation, independent audits, operational candidate verification and delivery complete; the user directed continuation on 2026-10-21.**
@@ -114,7 +195,7 @@ Status legend: `⬜ todo` · `▶ active` · `✅ done` · `⏸ blocked/on hold`
 
 ## Current implementation — CODEX1 npm plugin installer
 
-**▶ active — isolated native evidence audited; Windows edit-dependent events blocked by host policy; registry publication remains a separate decision. Original user direction 2026-10-16: install Codex and Claude Code plugins through npm/npx; prioritize testing Windows Codex today. ZIP transfer was explicitly rejected.**
+**open (deferred during AUTHOR1) — isolated native evidence audited; Windows edit-dependent events blocked by host policy; registry publication remains a separate decision. Original user direction 2026-10-16: install Codex and Claude Code plugins through npm/npx; prioritize testing Windows Codex today. ZIP transfer was explicitly rejected.**
 
 - **Identity:** product `BoxBox`, core/plugin/skill `boxbox`, public installer candidate `boxbox-plugin`. `product.json` owns `displayName` and `npmName`. The user has no access to the occupied npm `boxbox` name and authorized an available alternative. `box-box` was rejected under npm's similarity policy; `boxbox-plugin` and `boxboxplugin` returned E404 on 2026-10-16. This is not reservation or final registry acceptance.
 - **Scope:** `npx boxbox-plugin` detects supported local CLIs and installs their thin plugins and included local engine into permanent user directories. `--codex` and `--claude` select hosts explicitly. Installation must survive removal of npm's temporary cache and must not require Bun or the author checkout.
diff --git a/docs/development/status.md b/docs/development/status.md
index ced01a1..eb32ab4 100644
--- a/docs/development/status.md
+++ b/docs/development/status.md
@@ -1,10 +1,47 @@
 # Release readiness
 
-Updated: 2026-10-21 (native Codex evidence audited; Windows editing blocked) · Source baseline: `e8362d2`
+## Active work — AUTHOR1 matrix-first workflows
+
+The user authorized Write, Refactor and Align with shared Check and preview on 2026-10-21. The 0.2.4 source
+candidate adds `guide --authoring` before composing code and a standalone `align` command that never runs an external
+formatter. Write and Refactor are host-agent workflows; their behavior and performance need separate verification.
+Alignment preserves line structure, indentation and non-layout content and refuses proposals beyond that boundary.
+Ordinary `guide`, `check` and `format` remain available. TypeScript/Python are the implemented language scope;
+JSON/YAML remain planned. See [workflow selection](../user/modes.md) and [acceptance work](plan.md#active-task--author1-matrix-first-workflows).
+
+Integration verification, installed-artifact checks and independent review are in progress. This candidate has not
+been accepted or publicly released. Prior HUD test results do not verify these new commands or agent workflows.
+
+## Deferred work — HUD2 terminal visibility
+
+The 0.2.3 local candidate is installed for Codex and Claude Code on this Mac. Claude uses its official statusLine;
+`~/.local/bin/boxbox-codex` launches actual Codex with a separate tmux HUD pane. Ordinary `codex` is unchanged.
+Native captures prove both screens show engine readiness and respond to an invalid project config and recovery.
+Codex exit code 0 and owned-server cleanup were measured. Hook trust was not granted; temporary workspace trust
+was accepted only for the empty native test project. Desktop and Windows HUDs are outside this adapter's scope.
+
+Sonnet and fixed Opus review attempts both returned the provider's session-limit response. Independent review is
+**unexecuted and blocking final acceptance**, not passed or replaced by another model. See the
+[HUD record](reviews/2026-10-21-terminal-hud.md) and [user instructions](../user/hud.md).
+
+## Documentation and consistency audit — DOC1
+
+Current request: detailed maintainable docs, consistent inspection stages, storage/grammar validation and HUD status.
+Start at the [maintainer index](README.md). Architecture, inspection, storage and change recipes use a common structure.
+Current versus proposed behavior is explicit. The [audit](reviews/2026-10-21-maintainer-docs.md) records tests and gaps:
+read-only check does not validate syntax, runtime record validation is incomplete, and common result tests omit
+Swift/Kotlin. SQLite is not integrated; a derived index is a conditional proposal. At the DOC1 audit baseline, HUD was an on-request development panel; HUD2 above adds terminal adapters.
+DOC1 is complete: Sonnet corrections and final Opus fix verification passed. Proposed runtime improvements remain open;
+CODEX1 remains open while AUTHOR1 is active. The DOC1 pass changed no package, engine, approved rule or host trust setting.
+
+Updated: 2026-10-21 (AUTHOR1 implementation candidate; verification pending) · Source baseline: `07f568c`
 
 ## Goal and current verdict
 
-The first public scope is **core TypeScript and Python features + the CLI + a thin agent plugin**. The immediate user-selected target is a **Windows Codex test on another PC** (2026-10-16).
+The first public target is **TypeScript, Python, JSON and YAML + the CLI + a thin agent plugin**, expanded by the
+user on 2026-10-21. Current public execution supports TypeScript/Python only; JSON/YAML adapters and their approval,
+host and installed-artifact verification are planned in [FORMAT1](plan.md#planned-scope-expansion--format1-json-and-yaml).
+The earlier user-selected host test target is **Windows Codex on another PC** (2026-10-16).
 Safe writes, the Node package, the public CLI foundation, config layers, approval proofs and the formatter core are implemented.
 GUIDE and format are connected in the public CLI and the installed artifact. The plugin folder `plugin/` installs in both
 Claude Code and Codex. **This is not a completed public release.**
@@ -16,7 +53,7 @@ Claude Code and Codex. **This is not a completed public release.**
 - [Handoff for verification by another AI](handoff-2026-10-05.md): code map, 12 held IDs, reproduction commands and independent review questions
 - [Release tracking harness](../../development/harness/README.md): run history DB (`runs.jsonl`, `latest.json`) and a report against the REL table
 
-## Active work — CODEX1 native hook acceptance
+## Open work — CODEX1 native hook acceptance
 
 Controlled macOS Codex CLI 0.163.0 sessions loaded the unchanged BoxBox 0.2.2 plugin in a disposable profile.
 Native transcripts prove SessionStart developer context, an apply_patch PostToolUse FAIL delivered as context/tool
@@ -119,7 +156,7 @@ Node isolated install journey. That historical 0.2.0 package had no approved pre
 
 ## Next resume point
 
-The active task is CODEX1. Controlled native evidence is audited; Windows edit-dependent events remain blocked by
+DOC1 documentation is complete. AUTHOR1 is active; HUD2 is deferred pending independent review; CODEX1 remains open. Controlled native evidence is audited; Windows edit-dependent events remain blocked by
 the effective native read-only sandbox/approval policy. Registry publication remains a separate decision.
 FIRSTUSE1 explicit formatting and candidate delivery, DELIVERY1 CI/HUD, and LAYOUT1 separation/audit are verified.
 Public registry publication and native acceptance outside the measured test scope remain open. The two exact preset rules have human approval; broader

```

## Untracked translated README snapshots

### README.ko.md

# BoxBox

[English](README.md) | [한국어](README.ko.md) | [简体中文](README.zh-CN.md)

링크된 상세 문서는 주로 영어로 제공됩니다.

**코드의 흐름을 따라 읽고, 나란히 놓인 차이를 비교하세요.**

BoxBox는 반복되는 코드를 스프레드시트처럼 다룹니다. 같은 역할의 문장을 행으로, 대응하는 구성 요소를 열로 봅니다. 코딩 에이전트가 불균일한 구조를 단순화하도록 돕고, 남은 구문을 간결하고 읽기 쉬운 표 형태로 정렬합니다.

```typescript
// Before
const name = "deploy";
const retries = 3;
const timeoutMs = 1000;

// After
const name      = "deploy" ;
const retries   = 3        ;
const timeoutMs = 1000     ;
```

위 정렬 예시는 실제 TypeScript 엔진의 출력입니다. 이름, 값, 실행 순서는 유지하면서 대응하는 구문을 더 쉽게 비교할 수 있게 합니다.

제품명은 **BoxBox**이며, 핵심 CLI·스킬·플러그인 ID는 `boxbox`입니다(2026-10-16 확정). npm 설치 패키지 후보는 `boxbox-plugin`이며, 확인 당시에는 등록되지 않은 이름이었습니다. 목표 설치 명령은 `npx boxbox-plugin`입니다. npm 로그인은 완료했으며, 패키지 게시는 아직 대기 중입니다. [Windows 플러그인 설치 안내](docs/user/codex-windows-test.md)를 참고하세요.

## 코드를 표로 읽는 이유

반복되는 코드는 서로 다른 데이터에 같은 작업을 수행하는 경우가 많습니다. 문단처럼 읽으면 매 줄을 따로 해석해야 하지만, 표처럼 읽으면 차이가 드러납니다.

- 식별자, 타입, 인수, 값을 위아래로 비교합니다.
- 각 그룹의 실제 내용에 맞춰 열 너비를 정합니다.
- 역할이 다른 코드는 한 표로 늘려 맞추지 않고 분리합니다.
- 유독 긴 행 하나가 나머지 행의 폭까지 늘리기 전에 그 구조를 단순화합니다.

목표는 프로그램의 흐름을 위에서 아래로 따라가기 쉬운 일관된 형태입니다.

## 단순화. 정렬. 검증.

### 1. 구조 단순화

스킬은 에이전트가 반복되는 행과 그 코드를 사용하는 부분을 함께 살펴보도록 안내합니다. 에이전트는 표를 넓히는 불필요한 래퍼, 중복 표현식, 구현 세부 사항을 줄이는 방법을 제안합니다. 구조 변경은 에이전트와 사람이 판단합니다.

### 2. 비교 가능한 행 정렬

결정적 엔진은 지원되는 연속 구문을 그룹으로 묶고 구문 경계를 정렬합니다. 빈 줄, 들여쓰기, 호환되지 않는 행 구조가 그룹의 경계가 됩니다. 각 그룹에는 필요한 최소 열 너비를 적용합니다.

지원 패턴에는 선언, 대입, 가져오기, 객체의 행, 일부 호출이 포함됩니다. 지원 범위는 언어와 패턴에 따라 다르며, 엔진이 가능한 모든 구문을 분류하지는 않습니다.

### 3. 쓰기 전 변경 검증

정렬 단계는 공백 문자만 변경합니다. 파일을 교체하기 전에 내용 보존 여부를 확인하고 변경 전후 파서 진단을 비교합니다. 구조를 확실하게 분해할 수 없거나, 파서를 사용할 수 없거나, 파일 상태가 안전하지 않으면 쓰기를 거부할 수 있습니다.

공개 `format` 명령에는 완전한 사람의 승인 증거가 필요합니다. 프로젝트 포매터가 설정되어 있으면 먼저 실행한 뒤, 구문 분석을 검증하고 규칙 승인을 확인한 다음 정렬합니다. 포매터가 설정되어 있지 않으면 승인된 패턴을 직접 정렬합니다. 전체 과정을 두 번 실행해 결과가 더 이상 바뀌지 않는 고정점인지 검증한 뒤, 대상 파일을 한 번 교체합니다. 외부 포매터의 변경은 정렬 단계의 공백만 변경한다는 보장과 별개입니다.

## 작성·구조 개선·정렬·검사

0.2.4 소스 후보는 에이전트 작업과 엔진의 변경 범위를 구분합니다.

- **Write — 작성:** 에이전트가 승인된 작성 안내를 참고하여 요청한 기능을 구현합니다.
- **Refactor — 구조 개선:** 에이전트가 기존 구조를 개선하고 동작과 필요한 성능을 별도로 검증합니다.
- **Align — 정렬:** 엔진이 승인된 가로 배치 공백을 조정합니다. 줄바꿈·들여쓰기를 바꾸거나 외부 포매터를 실행하지 않습니다.
- **Check — 검사:** 기존 코드를 수정하지 않고 조사합니다. 탐지된 그룹이 없다고 파일 전체의 스타일이 검증된 것은 아닙니다.

`guide --file <file> --authoring --json`은 기존 파일, 빈 파일, 아직 만들지 않은 파일에 적용할 승인된 안내를 제공합니다.
예제는 작성 안내이며 해당 파일의 쓰기 승인 증거가 아닙니다. `align --file <file> --dry-run --json`으로 정렬을 미리 보고,
`align --file <file> --json`으로 적용합니다. Write와 Refactor는 CLI 생성 명령이 아니라 호스트 에이전트의 작업입니다.
미리보기는 대상을 변경하지 않으며, 기존 `format` 파이프라인은 별도 작업으로 유지합니다.
통합 검증과 독립 검토는 진행 중입니다. [작업 모드 선택과 검증의 한계](docs/user/modes.md)를 참고하세요.

## 플러그인 설치

공개 npm 설치 패키지는 `boxbox-plugin`이라는 이름으로 준비 중이며, 레지스트리 게시는 아직 대기 중입니다.
Codex와 Claude Code용 플러그인 및 로컬 Node 엔진을 설치합니다. 현재 미리보기 상태와 호스트 요구 사항은
[설치 안내](docs/user/codex-windows-test.md)를 참고하세요.

로컬에서 빌드한 설치 패키지를 사용하려면:

```sh
bun install
bun run pack:installer
npm exec --yes --package '/absolute/path/to/dist/installer/boxbox-plugin-<version>.tgz' -- boxbox --codex
```

`<version>`을 `package.json`의 버전으로 바꾸거나, `pack:installer`가 출력한 정확한 아카이브 경로를 사용하세요. 로컬 패키지를 빌드하려면 저장소 체크아웃이 필요합니다. 설치된 플러그인은 영구 설치된 자체 Node 엔진을 사용합니다.
공개 설치 프로그램에는 Node.js 22.22.3 이상과 npm이 필요하며, Python 포맷에는 `python3`가 추가로 필요합니다.

## 터미널 HUD

로컬 설치 후보에서 macOS/Linux용 BoxBox HUD를 선택적으로 켤 수 있습니다.

```sh
npm exec --yes --package '/absolute/path/to/dist/installer/boxbox-plugin-<version>.tgz' -- boxbox --codex --claude --hud
~/.local/bin/boxbox-codex
```

Claude Code는 재시작 후 자체 상태줄을 사용합니다. Codex는 `boxbox-codex`로 실행하면 별도의 tmux 영역에
표시하며, 일반 `codex` 명령은 바뀌지 않습니다. tmux를 먼저 설치하고 기존 tmux 세션 밖에서 실행하세요.
HUD에는 엔진 준비 상태, 승인 규칙 수, 관측한 검사 결과가 나옵니다. 기록이 없으면 알 수 없음으로 표시합니다.
Codex는 시작할 때 고정한 프로젝트의 이력을 보여주며, 현재 세션의 결과 수용을 증명하지 않습니다.
이 어댑터는 Windows와 데스크톱 앱 HUD를 지원하지 않습니다. 설치는 관련 없는 설정을 보존하고, 다른 Claude
상태줄이 있으면 덮어쓰지 않으며, 훅 신뢰를 부여하지 않습니다. [HUD 설정·제약·해제](docs/user/hud.md)를 참고하세요.

## BoxBox 개발

제품 소스는 `product/`에, 개발 도구·연구·증거는 `development/`에 있습니다.
`plugin/`은 제품 템플릿에서 생성되며, `dist/`에는 생성된 패키지가 저장됩니다.
[개발 안내](development/README.md)와 [디렉터리 구조 계약](docs/development/layout.md)을 참고하세요.

```sh
bun install
bun run check
./development/install.sh codex
bun product/packages/cli/entry.ts check --file path/to/file.ts --json
```

개발용 스킬은 Claude Code, Codex, ZCode, pi를 지원합니다. 기본 링크 설치는 현재 제품 소스를 따라가며,
`--copy`는 관리 대상 복사본을 만듭니다. 개발용 저작 훅은 호스트에 별도로 등록해야 합니다.

## 언어 지원 범위

| 구분 | 지원 범위 |
| --- | --- |
| 구현된 공개 CLI 언어 | TypeScript, Python |
| 첫 배포 목표의 추가 언어 | JSON, YAML (계획 단계, 미구현) |
| 개발용 정렬 엔진 | TypeScript, Python, Java, Go, Rust, JavaScript, C, C++, Swift, Kotlin |
| TypeScript 탐지 | TypeScript 7 AST 도구와 표 종류 레지스트리 |
| 기타 언어 탐지 | 언어별 프로필을 사용하는 공통 줄 단위 엔진 |

개발용 엔진이 10개 언어를 다룬다고 해서 배포 지원 수준이 모두 같다는 뜻은 아닙니다. 쓰기 검증에는 해당 언어의 파서 도구가 필요합니다. 언어별 한계는 [구현 현황](docs/development/implementation.md)을 참고하세요.

## 프로젝트 설정과 규칙

프로젝트 설정은 `.boxbox/`에 저장됩니다. 설정은 Base → Preset → User → Project 순서로 적용되며, 안전 불변 조건은 항상 지켜야 합니다.

권장 프리셋에는 승인된 규칙 2개, 합성 예제 4개, 결정 기록 2개가 있습니다. 규칙은 TypeScript 최상위 호출 선언(2행 이상)과 Python 단순 대입(3행 이상)입니다. 연구 후보는 별도로 보관하며 자동으로 승인하지 않습니다. 현재 규칙은 [가독성 계약](product/rules/references/readability-contract.md), 에이전트 작업 흐름은 [플러그인 스킬](product/plugin/skills/boxbox/SKILL.md)을 참고하세요.

## 개발 현황

현재는 개발 중이며 공개 배포가 완료된 상태가 아닙니다. 로컬 CLI 패키지와 스킬 어댑터는 구현되어 있지만, 공개 배포·호스트 네이티브 이벤트 수용·배포 패키지의 라이선스 메타데이터 작업은 남아 있습니다. 기본 `plugin/` 실행 연결 스크립트에는 명시적인 로컬 엔진 설정이 필요합니다. Windows Codex 시험에는 포함된 엔진을 영구 로컬 디렉터리에 설치하는 [npm 설치 프로그램](docs/user/codex-windows-test.md)을 사용하세요. 선택된 npm 설치 패키지 이름은 `boxbox-plugin`이며, 게시는 아직 대기 중입니다.

검증된 동작과 남은 작업은 [배포 준비 상태](docs/development/status.md), [배포 계약](docs/development/release-contract.md), [계획](docs/development/plan.md)을 참고하세요. 이름 변경과 구조 이전의 과거 기록은 [이름 변경 기록](docs/development/reviews/2026-10-16-boxbox-rename.md)에 있습니다.

## 기여하기

구조, 검사 단계, 저장 계약, 반복해서 적용할 수 있는 변경 절차는 [유지보수 문서](docs/development/README.md)에서 시작하세요.

```bash
bun install
bun run check
```

`check`는 제품 식별 정보와 의존 관계 검사, 테스트, TypeScript 타입 검사, 개발용 설치 스크립트의 셸 문법 검사를 실행합니다. 기여와 저작 규칙은 [AGENTS.md](AGENTS.md)를 따릅니다. GitHub main의 기존 [MIT LICENSE](LICENSE)는 유지됩니다. 설치 패키지 후보는 여전히 UNLICENSED 미리보기 메타데이터를 사용하며, 게시와 배포 패키지 메타데이터는 별도의 결정 사항입니다. 합성 프리셋 예제 4개에는 별도로 CC0-1.0이 표시되어 있습니다.

제품 이름은 [`product.json`](product.json)에서 관리합니다. [이름 변경 절차와 코드 길이 기준](docs/development/product-identity.md)을 참고하세요.

### README.zh-CN.md

# BoxBox

[English](README.md) | [한국어](README.ko.md) | [简体中文](README.zh-CN.md)

本文所链接的详细文档目前主要使用英语。

**纵向读代码，横向作比较。**

本项目将重复的代码视为电子表格：每条承担相同角色的语句是一行，对应的组成部分是列。它帮助编程智能体简化不一致的结构，再将剩余的语法元素对齐成紧凑、易读的网格。

```typescript
// Before
const name = "deploy";
const retries = 3;
const timeoutMs = 1000;

// After
const name      = "deploy" ;
const retries   = 3        ;
const timeoutMs = 1000     ;
```

上面的对齐示例是 TypeScript 引擎的实际输出。名称、值和执行顺序保持不变；对应的语法元素变得更容易比较。

产品名称是 **BoxBox**；核心 CLI、技能和插件的 ID 为 `boxbox`（于 2026-10-16 确认）。npm 安装器的候选包名是 `boxbox-plugin`，检查时尚未被注册。目标命令为 `npx boxbox-plugin`；npm 登录已完成，发布仍待进行。请参阅 [Windows 插件安装指南](docs/user/codex-windows-test.md)。

## 为什么将代码组织成网格？

重复的代码往往以不同的数据表达相同的操作。按段落阅读时，每一行都需要单独理解。按表格阅读时，差异便一目了然。

- 纵向比较标识符、类型、参数和值。
- 根据实际内容，为每组代码确定各自的列宽。
- 将不同职责分开，而不是强行放进同一张表。
- 先简化过长的特殊行，避免它拉宽其他所有行。

目标是形成一致的结构，帮助你自上而下理解程序。

## 简化、对齐、验证

### 1. 简化结构

技能会引导智能体检查重复的行及使用它们的代码。智能体会提出建议，消除不必要的包装、重复的表达式，或让表格变宽的实现细节。结构性修改仍由智能体和人共同决定。

### 2. 对齐可比较的行

确定性引擎会将支持的连续结构分组，并对齐其语法边界。空行、缩进和不兼容的行结构构成分组边界。每组都有自己的最小列宽。

支持的模式包括声明、赋值、导入、对象条目和部分调用。覆盖范围取决于语言和模式；引擎不会对所有可能的结构进行分类。

### 3. 写入前验证修改

对齐阶段只修改空白字符。替换文件之前，它会检查内容保留情况并比较解析器诊断结果。无法确定的结构分解、不可用的解析器和不安全的文件状态，都可能导致它拒绝写入。

公开的 `format` 命令要求完整的人工批准证据。如果项目配置了格式化器，它会先运行该格式化器，再验证解析结果、检查规则批准情况并执行对齐。未配置格式化器时，它会直接对齐已批准的模式。整个流程运行两遍，以验证结果达到不动点，随后仅替换目标文件一次。外部格式化器所做的修改不属于对齐阶段“仅修改空白字符”的保证范围。

## 编写、重构、对齐与检查

0.2.4 源码候选版本区分智能体工作流程与引擎修改范围：

- **Write — 编写：** 智能体参考已批准的编写指导，实现所请求的功能。
- **Refactor — 重构：** 智能体改进现有结构，并单独验证行为以及相关性能。
- **Align — 对齐：** 引擎只调整已批准的水平布局空白，不换行、不改变缩进，也不运行外部格式化器。
- **Check — 检查：** 检查现有代码而不修改它。未检测到分组不代表整个文件的风格已通过验证。

`guide --file <file> --authoring --json` 为现有文件、空文件或尚未创建的文件提供已批准的指导；
示例是编写指导，不是该文件的写入批准证据。`align --file <file> --dry-run --json` 预览对齐结果，
`align --file <file> --json` 应用对齐。Write 和 Refactor 由宿主智能体执行，不是 CLI 代码生成命令。
预览不会修改目标；现有的 `format` 流程仍是独立操作。
集成验证和独立审查正在进行。参见[工作流程选择与验证限制](docs/user/modes.md)。

## 安装插件

公开的 npm 安装器正以 `boxbox-plugin` 为包名进行准备；尚未发布到注册表。
它会为 Codex 和 Claude Code 安装插件及其本地 Node 引擎。当前预览状态和宿主要求请参阅
[安装指南](docs/user/codex-windows-test.md)。

如需试用本地构建的安装器：

```sh
bun install
bun run pack:installer
npm exec --yes --package '/absolute/path/to/dist/installer/boxbox-plugin-<version>.tgz' -- boxbox --codex
```

将 `<version>` 替换为 `package.json` 中的版本号，或使用 `pack:installer` 输出的完整压缩包路径。此本地构建产物的使用流程需要检出仓库进行构建。安装后的插件使用其永久安装的 Node 引擎。
公开安装器需要 Node.js 22.22.3 或更高版本以及 npm；Python 格式化还需要 `python3`。

## 终端 HUD

本地安装候选包支持在 macOS/Linux 上选择启用 BoxBox HUD：

```sh
npm exec --yes --package '/absolute/path/to/dist/installer/boxbox-plugin-<version>.tgz' -- boxbox --codex --claude --hud
~/.local/bin/boxbox-codex
```

Claude Code 重启后使用自身的状态栏。通过 `boxbox-codex` 启动 Codex 时，HUD 显示在独立的 tmux 窗格中；
普通 `codex` 命令保持不变。请先安装 tmux，并在现有 tmux 会话之外启动。
HUD 显示引擎就绪状态、已批准规则数量和已观测的检查结果；缺少记录时显示未知。
Codex 显示启动时固定项目的历史记录，不代表当前会话已接受检查结果。
此适配器不支持 Windows 或桌面应用 HUD。设置过程保留无关配置，拒绝覆盖其他 Claude 状态栏，
也不会授予钩子信任。参见 [HUD 设置、限制与移除](docs/user/hud.md)。

## 开发 BoxBox

产品源码位于 `product/`；开发工具、研究和证据位于 `development/`。
`plugin/` 由产品模板生成，`dist/` 存放生成的包。
请参阅[开发指南](development/README.md)和[目录布局契约](docs/development/layout.md)。

```sh
bun install
bun run check
./development/install.sh codex
bun product/packages/cli/entry.ts check --file path/to/file.ts --json
```

开发版技能支持 Claude Code、Codex、ZCode 和 pi。默认的链接安装会跟随产品源码的实时变化；
`--copy` 则创建受管理的副本。开发创作钩子需要在宿主中单独注册。

## 语言覆盖范围

| 范围 | 覆盖情况 |
| --- | --- |
| 已实现的公开 CLI 语言 | TypeScript 和 Python |
| 首次发布计划新增的语言 | JSON 和 YAML（计划中，尚未实现） |
| 开发版对齐引擎 | TypeScript、Python、Java、Go、Rust、JavaScript、C、C++、Swift 和 Kotlin |
| TypeScript 检测 | TypeScript 7 AST 工具和表格类型注册表 |
| 其他语言检测 | 共享的行引擎与各语言专用配置 |

拥有十种语言的开发引擎，并不意味着它们具有相同的发布支持程度。写入前的检查需要相应的解析器工具。各语言的具体边界请参阅[实现映射](docs/development/implementation.md)。

## 项目设置与规则

项目配置位于 `.boxbox/`。配置按 Base → Preset → User → Project 的层级解析；安全不变条件始终是强制要求。

推荐预设包含两条已批准的约定、四个合成示例和两条决策记录：TypeScript 顶层调用声明（至少 2 行）和 Python 简单赋值（至少 3 行）。研究候选规则单独保存，不会自动获得批准。当前规则请参阅[可读性契约](product/rules/references/readability-contract.md)，智能体工作流程请参阅[插件技能](product/plugin/skills/boxbox/SKILL.md)。

## 开发状态

本项目仍处于开发阶段，尚未完成公开发布。本地 CLI 构建产物和技能适配器已经实现；公开分发、原生宿主事件的接纳，以及发布包的许可证元数据仍有待完成。标准 `plugin/` 启动脚本需要显式指定本地引擎。在 Windows 上试用 Codex 时，请使用 [npm 安装器](docs/user/codex-windows-test.md)，它会将随附引擎安装到永久的本地目录。选定的 npm 安装器包名为 `boxbox-plugin`；发布仍待进行。

已验证的行为和剩余工作请参阅[发布准备状态](docs/development/status.md)、[发布契约](docs/development/release-contract.md)和[计划](docs/development/plan.md)。历史命名及迁移详情见[命名记录](docs/development/reviews/2026-10-16-boxbox-rename.md)。

## 参与贡献

请先阅读[维护者文档](docs/development/README.md)，了解架构、检查阶段、存储契约和可重复使用的修改模式。

```bash
bun install
bun run check
```

`check` 会运行产品标识与依赖检查、测试套件、TypeScript 类型检查，以及开发安装器的 Shell 语法检查。贡献和创作规则请遵循 [AGENTS.md](AGENTS.md)。现有的 [MIT LICENSE](LICENSE) 保留自 GitHub main 分支。安装器候选包仍使用 UNLICENSED 预览元数据；发布与发布包元数据仍需分别决定。四个合成预设示例单独标记为 CC0-1.0。

产品命名由 [`product.json`](product.json) 管理；请参阅[重命名流程与代码长度边界](docs/development/product-identity.md)。
