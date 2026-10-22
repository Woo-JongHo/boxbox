# Release-contract documentation correction

Date: 2026-10-22
Scope: `docs/development/release-contract.md` only

## Result

Corrected stale first-release implementation claims without changing runtime, tests, generated artifacts, root READMEs, plan/status, approvals, licensing, or publication state.

Before-edit copy: `/tmp/boxbox-readiness/release-contract.before.md`
- original SHA-256: `2f62b20e19ac8bac6f6050f2cc1aac28f3aa11d30359c609c698f70a3124a6ef`
- corrected SHA-256: `b7d802eb3b36bfb85d5df1178cef6e610491fbaebad220594fad24f2f29e9152`

## Corrections

- Replaced the obsolete TypeScript/Python-only baseline with the implemented TypeScript, Python, JSON, and YAML CLI baseline.
- Kept implementation separate from authorization: the recommended preset still contains only two approved conventions and four examples for TypeScript/Python; JSON/YAML automatic writes require a separately supplied complete approval proof and otherwise refuse.
- Added the structured JSON/YAML adapter to the write-surface inventory.
- Updated development metadata from 0.2.2 to the package-owned 0.2.4.
- Replaced the obsolete “allowlist not enforced” caveat with the actual builder and public-artifact enforcement, while explicitly retaining incomplete REL11, licensing, approval, and publication gates.

## Source bindings checked

- `product/engine/common/project-config.ts:7,84`: the four public languages and default config.
- `product/engine/cli.ts:35-38,162,240-242,425`: four-language Check/Align/Format/Guide surface, structured inspection, and ineligible-write refusal.
- `product/engine/common/format-pipeline.ts:69-109,134-155`: structured analysis, syntax/preservation checks, approval gate, and write cycle.
- `development/tools/build-cli-artifact.ts:16-19,45-49`: pinned bundled YAML identity/license notice and forbidden public-bundle references.
- `test/public-artifact.test.ts:59-69,155-181,229-253`: exact package file allowlist, installed JSON/YAML syntax/refusal behavior, and approval-gated JSON preview/apply.
- `product/rules/presets/recommended/{conventions,examples,decisions}.jsonl`: exactly two approved rules, four approved examples, and two decisions; no default JSON/YAML approval.
- `package.json:3`: version 0.2.4.

## Validation

- `git diff --check -- docs/development/release-contract.md`: PASS.
- Stale-string scan for “JSON/YAML are not implemented”, “remain unimplemented”, “0.2.2”, and the old allowlist caveat: no matches.
- Diff scope: one file, 10 insertions and 7 deletions.
- No test suite was run because this is a source-bound documentation-only correction; the existing artifact test was inspected rather than rerun.
