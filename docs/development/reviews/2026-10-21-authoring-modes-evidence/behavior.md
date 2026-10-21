# BoxBox mode skill forward-test

Date: 2026-10-21. Executor: independent Codex agent, using the updated source skill as workflow instructions. Verdict: the three requested local-source scenarios passed within the coverage stated below. No native-host or packaged-install verdict is inferred.

## Environment and isolation

All authored files are under `/tmp/boxbox-mode-behavior-m7RwTv`. The repository and installed plugins were not modified. `cli.ts` imports the actual repository `product/engine/cli.ts` and invokes `runCli(process.argv.slice(2), process.cwd())`. Each request uses a separate target directory, with `XDG_CONFIG_HOME` redirected inside it. The source template launcher is unavailable, so this explicitly authorized wrapper replaces only the launcher for this test. Source hashes at the end of the run are in `source-hashes.json`; this is a shared changing worktree rather than an immutable release.

Reproduction: `python3 /tmp/boxbox-mode-behavior-m7RwTv/run.py`, then `python3 /tmp/boxbox-mode-behavior-m7RwTv/finish.py`. These write only the same isolated fixtures and evidence. Each CLI invocation has a JSON transcript containing exact command, cwd, exit status, full stdout and stderr. Python verification transcripts contain exact commands and output. `observations.json` records target/proposal SHA-256 hashes and preservation checks.

## Request 1: Write

Request: “Use BoxBox Write to create settings.py with three numeric retry/timeout/batch settings and a function returning them; verify it.”

The route was `guide --file settings.py --authoring --json` before creating the file, agent-authored implementation, independent Python syntax and requested-return-value tests, then `check --file settings.py --json`. Guidance returned the proved Python simple-assignment rule, its exact contract, a positive example and a two-row counterexample. It explicitly reported `verification: not-run` and `writeAuthorized: false`; the user request supplied the implementation authorization.

Created three aligned assignments and `get_settings()` returning `(retry, timeout_seconds, batch_size)`. Python AST parsing and execution passed; the returned tuple is `(3, 30, 100)` and all three values have integer type. BoxBox found one assignment group, PASS, with zero misalignment. The function itself is outside the detected group's coverage. The check response correctly states its parser was not run; syntax assurance comes from the separate Python command.

Evidence: `write-authoring.json`, `write/settings.py`, `write/verify.py`, `write-behavior.json`, `write-check.json`.

## Request 2: Align, preview only

Request: “Use BoxBox Align, preview only, on settings.py.” The fixture contains three deliberately unaligned simple numeric assignments. Effective project configuration specifies a Python formatter which would create `formatter-sentinel` if invoked.

The route was Check → ordinary Guide → Align with `--dry-run --json`. Check found one FIXABLE group and two edits. Guide supplied the matching approved example. Align returned exit 0 with `mode: align`, `horizontalWhitespaceOnly: true`, `formatter: null`, `formatterExecuted: false`, `written: false`, `fixedPoint: true`, `parserChecked: true`, and the actual two line edits. The target content is byte-identical to its fixture input and the formatter sentinel does not exist. No fallback to format occurred.

Evidence: `align/settings.py`, `align/.boxbox/config.json`, `align/formatter.py`, `align-check.json`, `align-guide.json`, `align-preview.json`, `observations.json`.

Minor usability observation: Check's shared `formatReadiness.next` text still recommends `format --dry-run` even in a user-selected Align workflow. The skill's explicit mode instructions successfully kept this execution on Align, so this did not block the scenario. A future command-neutral readiness hint could reduce accidental mode switching.

## Request 3: Refactor, preview only

Request: “Use BoxBox Refactor, preview only: simplify a long conditional function while preserving its return values.” The isolated input is a nested `classify(enabled, attempts, quota)` returning one of `disabled`, `attempts`, `quota`, or `ready`. There are no external callers or existing tests in this fresh fixture.

The route was authoring Guide → Check on the original → read the complete function → write a separate proposal → syntax and comparative behavior tests on the proposal → Check on the proposal → produce a unified diff. The target is unchanged; the proposal lives in `refactor-proposal/settings.py` and the preview is `refactor-proposal.patch`. The proposal uses guard returns in the same decision order, preserving the original comparison operators through negation.

An initial proposal used opposite comparison operators. During review, this was recognized as insufficient for NaN behavior and was replaced before reporting completion. The final test covers 160 combinations of boolean enabled and integer, NaN or infinite attempts/quota. Every original/proposed return value matches. Both source files parse successfully. Custom input types, exception trace identity and performance were not measured.

Both original and proposed BoxBox checks returned zero detected groups, no applicable approval and parser `not-run`. That is explicitly **not evidence that the conditional function satisfies a verified matrix style rule**. The existing assignment rule is advisory context only and does not approve function restructuring. No alignment or approval-data modification was attempted.

Evidence: `refactor/settings.py`, `refactor-authoring.json`, `refactor-check.json`, `refactor-proposal/settings.py`, `refactor-proposal.patch`, `verify-refactor.py`, `refactor-verification.json`, `refactor-proposal-check.json`, `observations.json`.

## Limits

These are three forward workflow executions by an independent Codex agent using real source CLI output. They do not prove general AI authoring quality, Claude execution behavior, packaged launcher behavior, HUD integration, Windows/macOS parity, or semantic equivalence for arbitrary refactors. Write and Refactor are agent workflows as documented; no automatic CLI generation command was invented. JSON and YAML were not exercised or claimed supported. No target file was modified in either preview request.
