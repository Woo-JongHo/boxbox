# Documented data fields and issue-loop verification

GitHub: [issue 42](https://github.com/Woo-JongHo/boxbox/issues/42). Source baseline: `b132b571b90744cbb14c81ef0cd94a97da60e227`, after the separate Python self-use correction. Product version is 0.2.7 under the user's subsequent version-update instruction; this is a development branch, not a release.

## Failure and cause

The cleanup compacted the previously aligned `Slot` fields after applying a public Port/method exception to every documented interface member. The user confirmed that the three required readonly data fields are one table. This was an uncommitted authoring/review regression; the baseline commit itself is not blamed for introducing that edit.

A minimal interface with three `readonly name: string;` fields, each preceded by JSDoc, produced exit 0, groups 0, misaligned 0. Individual fields were candidates, but the ordinary run builder rejected the documentation gaps. The contract's former assertion that the checker wins when examples disagree also overstated a bounded implementation's authority. Review briefs repeated the broad interpretation, while token/AST preservation could only prove a separate safety property.

Reproduce with the three-field fixture in `test/typescript-b-layout.test.ts` and the source command:

```sh
bun product/engine/typescript/07_align-tables.ts --file <repository-relative-file> --json
```

For the user's exact Slot sample, tab width 4 gives one-based colon/type/semicolon columns 24/26/32. Semicolons stay attached when no padding is needed. A field table's widths come from its actual names and types, not these sample numbers.

## Bounded correction

`documented-data-members` admits attached JSDoc only in interfaces made entirely of required, identifier-named single-line data properties. Optional members, methods/signatures, explicit callable types and nested object/mapped types exclude that interface. Readonly changes, blank paragraphs, ordinary comments and trailing notes split runs. Classes and type literals keep their existing policy.

The new kind aligns `colon`, `member-type` and `semicolon`, with a zero-minimum semicolon insertion gap. An accepted documented run suppresses overlapping legacy member subgroups. Ordinary runs requiring no documentation bridge retain `interface-members`. The new lookup identity is `v1|typescript|InterfaceDeclaration|documented-data-members|colon>member-type>semicolon`; no preset was approved or broadened. The real public alignment pipeline still denies an unknown data-field group beside an approved declaration group without writing.

The development and shipped skill instructions now preserve data-field columns and state the Port exception's actual scope. The registry owns implemented axis names, while accepted rules and user references own intended layout; zero groups and reviewer agreement cannot override that reference.

## Reusable developer workflow

`development/skills/boxbox-issue-loop/SKILL.md` owns the repository developer workflow. The project discovery link is `.agents/skills/boxbox-issue-loop` → `../../development/skills/boxbox-issue-loop`; this is separate from the one shipped product skill. A read-only Codex 0.166.0 app-server `skills/list` call with this repository cwd and `forceReload: true` returned exactly one `boxbox-issue-loop` entry with scope `repo` and `enabled: true`, resolving to the versioned developer source. No inference turn or live issue/publish operation was used for that discovery check. Its snapshot helper observes explicitly selected regular files, byte hashes, modes, real root and branch. HEAD is provenance, not a reason to invalidate identical bytes after a commit. It performs no checks, approvals, Git writes or network calls and is not an atomic filesystem/security ledger. Intentional Git links and the final changed-path inventory are verified separately.

The first read-only Sonnet forward simulation correctly separated data fields from Port methods and selected the GitHub remote, but its proposed code aligned types without aligning colons, and its plan captured the candidate after checks. Those failures are retained. The skill was corrected with the accepted syntax example, measured-anchor requirements and a pre-check capture gate, then re-evaluated. Forward simulations are instruction tests; they are not actual issue creation, commits or host execution.

## Verification and limits

[Current verification](2026-11-08-documented-data-review-loop-evidence/verification.json) owns candidate identity, results and final review disposition. Focused regression evidence includes LF/CRLF, exact minimum columns, token/comment preservation, fixed point, legacy overlap suppression, the excluded member-shape and comment-boundary cases in the named test tables and the real public approval denial. The original positive cases failed twice before implementation. Snapshot helper tests use isolated temporary Git repositories.

Full raw model/CLI logs remain private; this record contains reproducible commands, observed outcomes, source identities and limits. The final full check, stable changed-file lint, cross-provider closure and publication are recorded only after they complete. Hosted Ubuntu/macOS CI and a native Windows/WSL host matrix are not claimed. The configured CI runs on pull requests or main pushes; publishing this feature branch alone does not run that matrix.

## Immutable checker transition

The initial configured checker was source 0.2.5 at `9a0406e27fb43241d71f9e5a8815da7e4301e1b1`. On the same corrected source it rejected the contiguous edits/details/pairs fragment of `AlignResult`, because JSDoc hid the surrounding fields. The current source checker recognizes all eight fields as one data record and passed all 23 then-changed supported inputs (base `c1f9993`; before the surface-form mapping was added). Exclusions remain unchanged.

The checker pin is advanced only after source tests and independent review, using an immutable source commit. The subsequent pin/harness checks and deliberately misaligned/aligned controls are recorded separately from the source full-check result. This avoids reshaping accepted data or adding exclusions merely to satisfy an older implementation. The developer workflow's conditional [pin procedure](../../../development/skills/boxbox-issue-loop/references/checker-pin.md) owns that transition.

## Review dispositions and follow-up

The independent Sonnet review and fixed Opus source audit found no demonstrated detector or approval-boundary defect. The Opus audit required explicit path/base accounting: the source selection also retains 12 files already unchanged from the issue baseline, belonging to the separately committed Python self-use work. The current verification JSON enumerates that selection and distinguishes it from the issue diff and changed-language inputs. Source results are observational executions; model reviews are read-only reasoning, not reruns.

The first frozen full run found one real integration omission: `documented-data-members` lacked its `DESCRIBE` surface-form mapping (781 passed, 1 failed). The mapping was added and the affected surface suite passed before refreezing. The snapshot tests also disable signing and hooks for their own temporary Git commits, so contributor configuration cannot prompt during those tests. These changes receive a focused audit delta rather than pretending the earlier source audit covered them.

Compatibility consequence: a plain required-data field adjacent to documented data can move from legacy `interface-members` into the distinct, currently unapproved documented-data kind. Whole-file public alignment can therefore refuse a file that previously had an approved legacy subgroup. Detection does not grant write approval, and mixed Port/optional interfaces retain their old boundaries.

Open integration follow-up: after merge, re-pin the checker to the retained `main` commit or a tag before deleting/rebasing its source branch. The feature-branch source checkpoint is immutable locally and scheduled for publication only after the remaining gates pass, but a future squash/rebase and branch deletion must not strand the pin. Hosted fetchability and CI remain unverified until a pull-request or main run.
