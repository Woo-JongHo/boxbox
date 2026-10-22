# REL10 core lifecycle verifier follow-up — independent review

Date: 2026-10-22  
Scope: read-only source, test, plan, and retained-failure evidence review. No installer or native host lifecycle command was executed.  
Verdict: **PASS.**

## Frozen files

- `development/tools/release-lifecycle.mjs`: `292b730c122612479e39d0745623d8095ea066b1c2129c71d30e0a1f8bfa5d30`
- `test/release-lifecycle.test.ts`: `3bb60086e0f718a089739448aee453cf9b945755a395a6de197669001fa10879`

## Findings

No mandatory finding remains in the reviewed follow-up.

### Explicit current-candidate binding

`--current-sha256` accepts only one 64-character lowercase hexadecimal digest. When omitted, the verifier retains the pinned `bec626…` candidate. When supplied, it changes only the current archive digest and assigns explicit caller-bound unpublished-candidate provenance; it does not inherit the historical CI run/source assertion.

The selected digest flows through `boundArchive`, so current bytes are checked before execution, before each current installation/transition, and at final verification. Extracted package identity and version are still checked as `boxbox-plugin` 0.2.4. The historical 0.2.3 digest remains immutable.

### Manual rollback truthfulness

`--manual-rollback` changes only the rollback leg. The verifier first proves that current remains registered, performs the documented unregister flow, installs and fully accepts the historical artifact, and records `directTransition: "not-attempted"`, `manualRemovalRequested: true`, and `atomic: false`. The unregister and install functions retain their own command and step evidence. It does not represent the manual sequence as a direct or atomic rollback.

This is an appropriate bounded route for the immutable historical artifact when the direct Claude transition cannot contain a later product fix. Upgrade behavior and all final removal, preservation, residue, archive, registration-root, runtime, and engine gates remain active.

### Codex 0.157.1 marketplace schema

The retained Windows failure establishes that Codex 0.157.1 reports marketplace `{name, root}` without repeated `marketplaceSource`. The exception is exact-host-version and exact-key-set gated. Newer/unknown versions, missing root, extra keys, and malformed modern provenance remain rejected.

The exception does not remove provenance checks: marketplace `root` must still equal the expected installation root; plugin-level local source type, marketplace source, plugin source path, manifest version, workspace containment, and runtime CLI path remain mandatory.

### Windows extended drive path

The measured Node 24 evidence shows `realpathSync` fails on a host-reported `\\?\C:\...` form while stripping that exact prefix produces the same canonical root. `hostPath` normalizes only on `win32`, only when the string starts with the extended prefix, and only when the remainder is an absolute drive path. Extended UNC, relative, and drive-relative forms are rejected. Unix treats the literal unchanged. A different drive remains different and is still rejected by the subsequent strict `realpathSync` equality check.

This is normalization before comparison, not a containment or ownership relaxation.

## Independent verification

- Frozen hashes matched.
- Focused test: 9 pass, 0 fail, 89 assertions.
- `node --check`: pass.
- `git diff --check` on the two files: pass.
- The retained Windows failure and realpath probe were read directly; the original failure occurred after a real install because the old verifier expected the omitted repeated marketplace source.

## Boundaries

This PASS approves the verifier changes for a fresh, separately authorized isolated native lifecycle run. It does not convert the prior Windows failure into a pass, approve either artifact for publication, or establish model, hook, trust, authentication, HUD, or UI behavior.
