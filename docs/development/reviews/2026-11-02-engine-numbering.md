# Contiguous file IDs in the flat engine

The engine now has one contiguous, unique file ID per directory. All 62 files remain flat: root 00–05,
Common 00–28, TypeScript 00–17, Python 00–07 and structured 00. IDs describe file order for navigation;
they do not define execution steps. The [rename map](2026-11-02-engine-numbering-evidence/rename-map.json)
records all 62 mappings, including the unchanged TypeScript import normalizer.

Imports, raw runners, measurement dispatch, hook registration, bundle entry names, catalog evidence paths and
maintained instructions use the new names. The layout checker rejects missing IDs, duplicate IDs, gaps,
unexpected directories and nested engine folders. Historical issue evidence retains its recorded paths through
a bounded alias table; current references must resolve physically. No compatibility shim, deeper folder,
placeholder Python stage, rule approval, model configuration or version change is introduced.

## Verification boundary

Frozen source candidate `58071284368e7e9b` passed `BOXBOX_REQUIRE_PARSERS=1 bun run check`:
**735 pass, 0 fail, 4,354 expectations across 78 files**, with no drift across 1,465 captured check inputs.
The [manifest](2026-11-02-engine-numbering-evidence/candidate-manifest.json) and
[gate receipt](2026-11-02-engine-numbering-evidence/verification.json) describe that actual invocation.
All 62 engine files still match its hashes.

The [20 before/after command captures](2026-11-02-engine-numbering-evidence/behavior-comparison.json)
preserve exact input bytes, stdout, stderr and exits; path normalization was unnecessary.
The [122 read-only import/alignment checks](2026-11-02-engine-numbering-evidence/self-use-files.json)
cover all 61 TypeScript engine files and make no edits. The MJS helper separately passed Node syntax checking
and an actual hover invocation; its Python analysis heading was returned successfully.

The [CLI artifact](2026-11-02-engine-numbering-evidence/artifact-provenance.json) passed the
[four installed Node-only scenarios](2026-11-02-engine-numbering-evidence/installed-smoke.json):
approved TypeScript/Python preview, apply and fixed point; PEP 701 literal preservation; and unapproved TypeScript
refusal. A documentation-only follow-up corrected script references in three canonical shipped references and
their generated copies, repaired accidental harness/report labels, and updated the current Python analysis
description. The original gate receipt is not relabeled as a rerun. A CLI rebuild is byte-identical to the tested
artifact; focused document-contract/reference tests passed 19/0 with 117 expectations. Issue references, layout,
generation drift and both official strict plugin validators passed.

The local plugin guard passed 17 contract/hook tests and isolated registration with Claude Code 2.1.286
(one skill, one inspector, three hooks) and Codex 0.166.0 (installed and enabled). The final reference-name-only
correction reused those registration results and reran generation/strict validation. This is a local installation
sample, not the native Windows/WSL host matrix.

## Review limit

The user-selected GLM numbering audit did not return a final verdict. Disk exhaustion prevented saving its review,
and provider/local statement errors were also observed. Its partial observation of stale shipped reference paths
was confirmed and corrected directly. The earlier Python candidate's GLM PASS remains historical evidence and
does not approve this numbering candidate. The user requested commit and push after this incomplete-audit status
was disclosed. No latest-numbering independent-audit PASS or release readiness is claimed.

The [closure record](2026-11-02-engine-numbering-evidence/closure.json) separates the frozen gate, documentation
follow-up, artifact identity, local host checks and incomplete audit. The numbering loop used 7 of 20 bounded cycles.
Earlier behavior changes and findings remain in the
[engine self-use review](2026-11-01-engine-self-use.md) and
[Python AST review](2026-11-02-engine-stages-python-ast.md).
