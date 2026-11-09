# Python inspection and user-journey verification

This local candidate hardens Python inspection and exercises the public Node CLI through nine user journeys.
It is based on `74cf7e2a6a0ae61d42c146f9387f5db9f6c8b911` on `fix/python-inspection-journeys`, with the AST/token
safety implementation backported from `bf54c29d68543d7914e4333fd2893b54bed905e3`. This backport retains its base
branch's source filenames; the later numbering migration is a separate integration.

## Inspection contract

- CPython AST owners constrain row discovery; original token ranges protect strings and comments. Formatted-string
  replacement fields stay opaque. Lossless decomposition must succeed before a row counts as inspected.
- Recognized rows outside automatic coverage appear in the existing `FileResult.unsupported` field. Multiline
  headers can be unsupported while their child rows are inspected. Coverage reporting is bounded and often partial.
- Check retains its exit codes and schema version. Python coverage gaps produce `UNSUPPORTED` in guarded run and
  hook receipts; failing groups take precedence. Unsupported-only hooks report without blocking. Other language
  state handling and approval data retain their existing behavior.
- Writes require the existing exact approval, original-token preservation, independent AST equality, fixed point
  and atomic replacement. No new rule is approved by this candidate.

Python 3.9 is the minimum for position-backed inspection. The pinned CPython schemas show keyword location
attributes in [3.9.6](https://raw.githubusercontent.com/python/cpython/v3.9.6/Parser/Python.asdl) and their absence in
[3.8.18](https://raw.githubusercontent.com/python/cpython/v3.8.18/Parser/Python.asdl). Doctor reports an older or
unrecognized version as unavailable for Python inspection. The installer still admits other languages.

## Executable user scenarios

The [user walkthrough](../../user/python.md) gives commands and expected outcomes. The
[Node CLI journey suite](../../../test/python-user-scenarios.test.ts) copies the built package and its TypeScript
dependency into an isolated temporary directory and executes Node rather than the source Bun entry.

| Journey | Required observable outcome |
|---|---|
| First Check, preview, apply, recheck | Real findings without init; Check and preview preserve bytes; approved apply writes; the program still prints the same result; repeated Align is a no-op. |
| Dictionary and annotation tables | Detection remains separate from approval; preview and apply refuse unapproved shapes without changing the file. |
| Empty coverage, invalid syntax, parser absence/failure | No-group acceptance has no applicable write approval; invalid or unverifiable syntax returns 2 and preserves source. |
| Lone-CR input | Check reports an explicit source-format error; preview preserves the exact original bytes. |
| CRLF and Unicode data | Approved alignment preserves indentation, line separators, protected data and comment bytes; execution and fixed point remain stable. |
| Mixed approved and unsupported rows | Supported alignment preserves unsupported bytes; guarded run returns `UNSUPPORTED` for coverage gaps and `FAIL` when misalignment also exists. |
| Session and post-edit hook | The actual CLI adapter emits a non-blocking `UNSUPPORTED` context and a matching receipt, with unchanged source. |
| Nested formatted literals | Literal contents never become assignment groups; the installed interpreter's grammar is respected. |
| Project/PYTHONPATH module shadows | Parser lookalikes are not imported and the target is not executed during Check or preview. |

[Source-analysis tests](../../../test/python-source-analysis.test.ts) additionally cover old-version replies,
opaque replacement fields, default-only parameter ownership, malformed protocol and source-token preservation.
[Coverage tests](../../../test/python-coverage.test.ts) cover indexed targets, Unicode names, tuple statements,
keyword calls, numeric dictionary keys, multiline headers and formatted values with or without comments.

## Recorded validation

Measured on macOS arm64 with Node 22.22.3 and Bun 1.4.0.

| Check | Result |
|---|---|
| `BOXBOX_REQUIRE_PARSERS=1 bun run check`, Python 3.14.2 | Exit 0; 803 tests across 81 files, 4,819 assertions, TypeScript, layout/data checks and shell syntax passed. |
| Python 3.9.6 focused compatibility | 33 tests across the source-analysis, coverage and Node journey suites passed, including all nine journeys. |
| Old-interpreter handling | Synthetic 3.8 version/analyzer replies are refused; a real installed artifact still checks TypeScript under the unsupported-version probe. No native 3.8 execution is claimed. |
| Changed-code lint against `74cf7e2` | Exit 0; 31 eligible targets, zero violations/errors. Two files have no detected table groups. |
| Independent review | Sonnet findings and initial Opus findings were closed; fixed `claude-opus-5-5` fix-verification returned PASS with no actionable blockers. Reviewers had no tools or write access. |

The final full run's 1,000 deterministic Python mutations recorded 505 valid/aligned cases, 495 invalid/rejected
cases and zero invalid/aligned cases. A separate native 3.9.6 public-Check probe reproduced the multiline replacement
field coordinate error before the fix and returned valid syntax without phantom inner rows afterward.

The earlier local collection recorded engine-source hashes
`4acf30f5e8b924564fe6fd70a0f9cf8f08cdc83368a0f7e407861f065400722a` and
`49b2f910f646afc124cff3e08233a588e7e633bc7a5fa005f389ba94bc00dc41`. The exact serialization
used by that collection was not retained in this backport. Those historical labels are not used to identify
or certify the current delivery. The reproducible source identity and fresh checks below replace that inference.
The public Node CLI hash remains `3379ef888e65973c910e59c6331d33252a377ac3bfac1829e81e1c9afbea72e7`;
the current isolated rebuild matched those exact earlier artifact bytes.

## Pre-publication verification on 2026-11-09

The preserved backport was checked in an isolated SSH worktree on macOS arm64 with Bun 1.4.0,
Node 24.9.0 and Python 3.14.6. A separate focused cell used the system Python 3.9.6.
These results belong to this backport, not to main, the numbered-engine branch, a registry release or a native-host matrix.

| Check | Result |
|---|---|
| `BOXBOX_REQUIRE_PARSERS=1 bun run check` | Exit 0; 803 tests in 81 files, 4,819 assertions, plus the configured data/layout, TypeScript and shell checks. |
| Python 3.9.6 focused source/coverage/Node journeys | 33 passed, 0 failed, 277 assertions; all nine Node CLI journeys executed. |
| Changed-file lint against `74cf7e2` | Exit 0; no alignment errors. Scope exclusions and unsupported-language ranges remain distinct from checked rows. |
| Generated plugin sync and strict validation | Sync check and both official strict validators passed. The newer validator's existing README install-line warning remains advisory. |
| Source and built artifact identity | The 59-file engine manifest is `f4d9a3f879b3ec6183414e1e5bca4d88075e6bb3b1b52698e36cb1d76bbe83e7`; the Node CLI hash above matches the rebuilt artifact. |
| Current SSH independent review | Incomplete: bounded GLM attempts returned no usable verdict. This is not an audit PASS; the earlier local review above remains historical. |

The following recipe reproduces the current manifest digest from the repository root. It hashes UTF-8 JSON
with sorted keys and compact separators, without a trailing newline; `files` is a mapping from repository-relative
paths to exact file SHA-256 values. This fixed base identifies the preserved backport's input, not its eventual commit.

```python
import hashlib
import json
from pathlib import Path

files = {
    path.as_posix(): hashlib.sha256(path.read_bytes()).hexdigest()
    for path in sorted(Path("product/engine").rglob("*")) if path.is_file()
}
payload = {"base": "74cf7e2a6a0ae61d42c146f9387f5db9f6c8b911", "files": files}
canonical = json.dumps(payload, sort_keys=True, separators=(",", ":")).encode("utf-8")
print(hashlib.sha256(canonical).hexdigest())
```

Reproduce the code checks from this checkout:

```bash
BOXBOX_REQUIRE_PARSERS=1 bun run check
bun run lint:changed -- --base 74cf7e2
bun test --timeout 60000 test/python-source-analysis.test.ts test/python-coverage.test.ts test/python-user-scenarios.test.ts
```

For the focused compatibility cell, make `python3` resolve to CPython 3.9.6 before running the last command.

## Scope and delivery limits

This verifies syntax and bounded layout inspection, approval and preservation. It does not certify whole-file style,
types, business behavior or performance. Unannotated default parameters retain detection but receive no new default
write approval. Analysis/tool faults fail closed; unsupported encodings or line endings can fail the entire invocation.

Native host event delivery and the macOS/Windows/WSL host-installation matrix were not repeated: registration,
manifests and hook output shapes are unchanged, while the Python state propagation was exercised through the actual
CLI hook adapter. Native Python 3.8, Python 3.10–3.13 and deep-recursion inputs remain unrun. Large old-interpreter
input and pipe-error diagnostics remain unverified; parser execution errors fail closed.

The original other-computer configuration remains uninspected. The earlier local task did not commit or push.
This delivery preserves the candidate and its current automated checks on a source branch for handoff; it is not
main integration, a registry release, or a change to a user's live host installation. Fresh source-specific
independent review remains an integration gate because the bounded SSH GLM attempts returned no verdict.
