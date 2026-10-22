# REL10 Windows guide correction

## Scope

Changed only `docs/user/codex-windows-test.md`. No product, installer, plan, status, release-contract, generated payload or localized root README was edited.

## Corrections

- Removed the private npm account name and machine authentication assertion.
- Stated that the current 0.2.4 candidate is unpublished and that registry installation and publisher authentication remain unverified.
- Replaced the stale 0.2.1 local commands with the exact `pack:installer` archive pattern using `<version>` and npm's explicit `--package ... -- boxbox` binary path.
- Replaced the 0.2.0 → 0.2.1 heading and command with the current version-independent Codex marketplace handoff.
- Added the current Windows HUD exclusion.
- Added the current Claude exact user-scope update and retained partial-state recovery boundary, linked to the canonical installer README.
- Kept Node 24.12.0, Python 3.14.0 and Codex 0.157.1 only as dated historical evidence and explicitly stated that it does not verify the current 0.2.4 archive.
- Did not claim the running CI or final native candidate passed.

## Source references

- `product/installer/README.md`: unpublished/local archive command, Node requirement, Windows HUD exclusion, Codex manual marketplace replacement, Claude scoped update, retained phase receipt/backup semantics.
- `package.json`: current version used by `pack:installer`.
- `/tmp/boxbox-readiness/rel10-public-assets-audit.md`: actionable stale-guide and private-account findings.

## Evidence

- Before snapshot: `/tmp/boxbox-readiness/rel10-windows-guide-before/codex-windows-test.md`
- Before SHA-256: `85300df66a4586e55894fef0585fbd82d508a35ce319fe1b34e6a228f0985345`
- After SHA-256: `7f4f753e0b5f9b8ca2184e5e1815a34a217fe469045bd7575e3cc817e5a35822`
- `git diff --check -- docs/user/codex-windows-test.md`: pass
- Local Markdown link check: 5 links, 0 missing
- Scan for TODO/FIXME/skip/only, private npm username and hard-coded 0.2.0/0.2.1 archive names: no matches

No tests or builds were run because this is a single user-document correction with no executable changes.

## Independent-review G1/G2 closure

Source: `/tmp/boxbox-readiness/rel10-release-docs-independent-review.md`.

- G1: Replaced the ambiguous license sentence with the exact split: the repository retains the root MIT license; the installer preview remains `UNLICENSED`, grants no open-source rights, and release-package metadata/notices alignment remains pending.
- G2: Documented both writing operations. `align --dry-run` and `format --dry-run` preserve the original; explicit non-dry-run Align writes only approved horizontal whitespace, while explicit Format uses the broader formatter-plus-alignment pipeline.

Post-closure checks:

- Final guide SHA-256: `7d03f120a27062355f407739f1e5b7c5eed948d7ff2f4ed26f6fa6822e227503`
- `git diff --check -- docs/user/codex-windows-test.md`: pass
- Local link check: pass, 0 missing
- Stale phrases `a general open-source license is undecided` and `Only an explicit format writes`: absent
- No tests/builds run; documentation-only change
