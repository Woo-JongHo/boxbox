# Self-use correction: imports, property columns and guard paragraphs

The user identified missing import and object-property alignment in `authoring-guide.ts`,
and asked for an `if ... return` boundary in `subjectCall` and `callLayer` in `grid-kinds.ts`.
This is a local, user-directed correction to the [first self-use pass](2026-10-21-self-use-refactor.md).
It does not approve new public preset rules or change the deterministic engine.

## Scope and authorization

The preceding pass interpreted the skill's automatic approval gate too broadly for a directly
requested local edit. The user's explicit correction authorizes these source edits. The agent
performed them; the public CLI still denies automatic alignment where preset proof is missing.
No raw alignment writer, approval bypass flag or invented human-approval record was used.
The four authoring-guide groups now have zero misalignments, while `approvalEligible` remains
false. Those are different properties, not contradictory reports.

The boundary question was presented to the user. Pending clarification, the conservative
interpretation applied here is paragraph separation: preparation and the guard on that value
stay together, while the next step begins a new paragraph. Existing declaration/action/result
paragraph rules also apply. Guards were not moved across declarations to manufacture a table,
and noncontiguous guards were not padded into a shared column.

## Changes

- Align all six imports on `{`, `}`, `from`, module start and `;`, without moving declarations.
- Align the decision/document declarations and both object-property groups.
- Expand `key` and `counterexamples` shorthand into explicit equivalent properties so every
  returned field participates in the name/colon/value table; property evaluation order stays intact.
- Add only blank lines in `subjectCall` and `callLayer`, preserving every existing nonempty line.

No numbering scheme was added. The current `00_`, `01_`, `06_`, etc. filenames identify
execution-stage scripts; internal modules such as `grid-kinds.ts` do not follow that naming
scheme. The readability contract's function map is optional, and there is no enforced general
function/paragraph numbering scheme. A numbered function map would be a separate consistency
choice, not a reason to renumber runtime modules during this correction.

## Evidence and limits

- Baseline: authoring-mode and TypeScript alignment tests, 32 pass / 0 fail / 176 assertions.
- After authoring-guide edit: authoring-mode tests, 7 pass / 0 fail / 113 assertions.
- Installed 0.2.4 Check: both edited files have zero misaligned groups.
- Import columns (one-based): `{` 13, `}` 50, `from` 52, `;` 79, identical on all six lines.
- Property colons (tabs expanded to four-column stops): 25 in counterexamples, 29 in returned rules.
- Preservation: after accounting for the two explicit-property expansions, authoring-guide
  differs only in horizontal token whitespace. grid-kinds preserves tokens/comments and every
  nonempty line byte-for-byte; only blank lines were added.
- The initial horizontal-only preservation probe correctly rejected grid-kinds because line
  breaks count as tokens. The follow-up uses `preservesTokensWithBreaks` plus an exact comparison
  of nonempty lines. The unsuccessful probe is retained, not counted as passing evidence.
- Sonnet read-only diff review: PASS for behavior/evaluation order. It observed that paragraph
  changes also separate declaration/action/result, beyond only the guard boundaries.
- GLM 5.3 independent read-only audit: PASS for behavior/evaluation order. No executed-test
  claim. Its wording about preexisting whitespace is less exact than the recorded diff and
  nonempty-line proof; the latter establish that grid-kinds changed only by blank-line insertion.
- Completion Check of all nine files tracked by the session hook: exit 0 for every file,
  zero detected misalignments. No TODO/FIXME or test skip/only markers in the two edited files.
- `bun run check`: exit 0; 554 pass, 5 existing parser-dependent skips, 0 fail, 2661 assertions.
  Identity/layout checks, TypeScript checking and installer shell syntax completed.

The existing `guard-statements` detector handles one-line blocks ending in `continue`, not the
simple early-return form discussed here. Registration detection excludes shorthand properties.
Import columns are measured separately because this Check result does not cover them. Zero
misalignment is not a claim that the engine now verifies guard paragraphs or file numbering.

Evidence: [recorded artifacts](2026-10-21-self-use-boundaries-evidence/).
