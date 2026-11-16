# Incremental inspection and actionable recovery — 2026-11-16

[Issue #63](https://github.com/Woo-JongHo/boxbox/issues/63) covers repeated PostToolUse analysis and recovery that lost the next responsible action. This change implements bounded recovery and conservative TS/JSON/YAML inspection reuse. Automatic approval, structural edits and public release authority are unchanged.

## Implemented behavior

- Single Align/Format, batch formatting, canonical Check and hook feedback retain location, category, reason, owner and next action. Approval findings keep their exact key. Compressed members route only an independently authorized Write/Refactor; Align alone still refuses structural edits and preserves the source. Writer-report corruption retains its nonzero status and tool diagnosis.
- PostToolUse cache identity includes source/path/root/mode, configuration/proof/documents and actual engine/rule/parser/runtime bytes plus environment. TypeScript records the parser's real filesystem dependencies. Unknown or changed context, corruption and source/dependency races never yield a cached pass. BOM decoding and oversized observations fall back to native fresh inspection.
- Stop skips cache context and always re-inspects. Approved multi-file writes refresh earlier observations only for owned aligned-source reads; other races remain errors. Transient parser/tool execution errors are excluded from both cache reads and writes; deterministic syntax/safety refusals remain reusable. Context-only entropy no longer repeatedly blocks identical feedback. Receipt schema 2 stays unchanged; optional inspection sidecars count hits, misses, actual inspections and phase time.

## Frozen verification

The source baseline is `21b1b52260466b3ad35c3fe6afe76d846e47fe42` plus the 13 listed TypeScript source/test changes. [Verification data](2026-11-16-incremental-recovery-evidence/verification.json) contains their hashes, package identity, measured scopes and preserved failure mechanisms. The v4b snapshot matched before and after the full check. The installed artifact was built from capture v4, whose 13 code/test entries are identical to v4b. Later issue/evidence edits are documentation only.

| Check | Observed result |
| --- | --- |
| `bun run check` | Exit 0: 1,310 tests, zero failures, 7,466 assertions across 98 files; type and shell checks passed |
| Focused cache/lifecycle | 46/0, including actual inherited configuration, multi-file writes, unowned races, corrupt caches, BOM/native equality fresh Stop, transient parser recovery and existing error-cache rejection |
| Runtime identity | 8/0, including a real standalone Node bundle without external YAML |
| Recovery and public CLI | Recovery 14/0; public recovery 3/0; approved control, compressed refusal, batch/canonical errors and fixed point |
| Node source compatibility | Initial parameter-property failure corrected; existing literal-backslash Node test passed |
| Immutable changed-file checker | All 13 changed TypeScript files passed; final workspace scope is recorded in verification data |
| Independent source review | Sonnet 5.5 initial findings followed by fix-only PASS |
| Final audit | Fixed Opus source/delta and G1 artifact-binding closure PASS |

The final source manifest binds the v4b full gate and installed bundle `29ffc28d418b75f053b0f02d4bff1214b60ee5a3db2bfa833134acb441dbc9b9`. The earlier `b5166d2e…` bundle and 1,307-test gate are explicitly retained as pre-parser-recovery evidence.

The public package is a local 0.2.8 development candidate, not a replacement registry publication. It was packed, installed offline in an isolated npm prefix and executed with Node without Bun or source imports. The same bundle verified three changed synthetic files: first post inspected three, unchanged post reused three with zero inspections, external tsconfig/config/proof edits each forced three inspections, and Stop inspected three freshly. Failures and checked-file coverage remained intact; hooks did not change source bytes. A further installed-artifact case injected a checksum-valid old parser-error cache: two unchanged files hit cache, the affected file was freshly inspected, and its tool refusal cleared. Its genuine alignment finding remained FAIL; this is not claimed as a source PASS.

A separate journey used a git archive of this real BoxBox project plus the frozen overlay, its actual tsconfig and linked dependencies. One deliberate whitespace perturbation in `common/38_recovery.ts` produced FAIL, one fresh inspection, then one cache hit with zero inspections, then one fresh Stop inspection. The actual repository and perturbed copy remained unchanged by hooks. This is isolated project evidence, not native host activation.

The installed public CLI also preserved compressed-interface refusal details on both preview and apply, kept the source unchanged, and passed the approved positive preview/apply/fixed-point control. The isolated #62 TSX source check returned syntax valid, one FIXABLE group, eight edits and zero refusals; delivery to the affected installation remains separate.

## Limits and reproducibility

Run `bun test --timeout 60000 test/recovery.test.ts test/cli-recovery.test.ts test/inspection-context.test.ts test/lifecycle-cache.test.ts test/format-pipeline.test.ts`, then `bun run check` on a frozen source selection. Build with `bun run pack:cli`, install the tarball into an isolated prefix, and replay SessionStart → source edit → PostToolUse twice → Stop using a fixed session ID and plugin-data directory. Check normal receipt coverage alongside `.json.inspection` counts. Change an inherited config outside the project, project configuration and a referenced proof document independently; every change must invalidate reuse. Project proof IDs must be distinct from preset IDs.

Timing was measured locally under uncontrolled load. Complete byte hashing has a cost; fewer parser calls do not promise faster small-file latency, and Stop has no cache-identity cost. Python and uncertain contexts remain uncached. Native host/platform cells, CI publication and production installation were not run. The checker-default exclusions cover recorded review-evidence outputs, not the two original JSON violations; Markdown is outside its language scope. The immutable checker also sees pre-existing JSON violations in the initial user worktree; unchanged recorded evidence and record 029 are preserved rather than rewritten or excluded. No global lint PASS or whole-file semantic coverage is claimed. The historical root guard remains STALE; this change uses direct per-file, artifact and frozen full-check evidence.
