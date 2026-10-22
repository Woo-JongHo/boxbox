**BLOCKED.** There is one hard defect, which the 38 targeted tests can't catch. There are also two skill-wording defects and a few test gaps. I read the files only and ran nothing.

## Blocking

1. **`call-member-dot` has no `AXIS_NOTES` entry.**
   - `KIND_AXES` now lists the axis (`grid-kinds.ts:820`), but `AXIS_NOTES` (`grid-kinds.ts:759-802`) has no entry for it. Its comment says "Fill it in when registering a new axis."
   - `test/plugin-contract.test.ts:84-88` ("every table-kind axis has a human-readable note") asserts `AXIS_NOTES[axis]` is defined for every axis in `KIND_AXES`. That test should fail, and it is probably one of the pending integration checks.
   - Fix: add something like `"call-member-dot": "final receiver/method `.` of a supported member-call declaration value; the receiver's inner dots stay in its cell"`.

## Skill defects (`product/plugin/skills/boxbox/SKILL.md`)

2. **Reconciliation happens before Align, so false completion is still possible.**
   - Step 5 runs `check`, reconciles, then says "use Align … for final whitespace." Align can leave an axis in `skipped` or change which axes appear.
   - The Check and Align section only says to rerun `check` and report the misaligned count, with no second reconcile.
   - Fix: reconcile against the final post-Align `check --json`.
   - The reconcile instruction should also name `skipped`. It says "returned group axes", which lists only axes the engine aligned. Axes with fewer than two rows (`align.ts:88`) never appear. Those are exactly the boundaries that need manual verification.

3. **The issue-history sentence is out of scope for a shipped skill (lines 73-74).**
   - "When the project has an issue-history schema, record…" comes from this repo's own process. In a user's repo it is vague, because the agent has to guess what counts as a schema.
   - It can also push the agent to write files beyond the authorized scope, which conflicts with "Work one file at a time within the user's authorized scope".
   - Fix: make it report-only in the final message, or apply it only when the user or project instructions explicitly require it.

## Checks that passed

- **Whitespace and token safety:**
  - `tokenAfter` requires only `[ \t]*` before the dot, so newlines and comments before the dot return `undefined`.
  - `spacesOnly` after the dot rejects newlines and comments there too.
  - Either case drops the whole run back to the legacy boundaries.
  - The dot edit range `[receiverEnd, dot)` and the open-paren range `[callee.getEnd(), open)` can't overlap.
  - The topological order handles rows with and without a dot (the `equals`→`dot`→`open` edges).
- **Semantic role of the final dot:** `callee.expression.getEnd()` makes it the last receiver/method dot, so `registry.rows` stays one receiver cell. `simpleCallee` excludes `?.`, `this`, call-produced and parenthesized receivers, and `import.meta`.
- **Row-count rule:** bare functions get no dot axis, and `alignRows` needs at least two rows to emit one.
- **Legacy keys:** same-signature runs where every row passes `declarationCall` still return early in `withCallEnvelope` (line 955), so their keys are unchanged. No stored approval references `call-envelope-open`, and `typescript.json` approves the kind only.
- **Mirror:** `plugin/skills/boxbox/SKILL.md` matches the canonical skill for the changed lines.

## Non-blocking notes

- **New unapproved key for member-call envelopes.**
  - The lookup key includes the ordered axes, so member-call envelope groups get a new key (`…>call-member-dot>call-envelope-open>…`).
  - The tests use the raw `06_align-tables.ts`, so they never exercise approval (`approval-gate.ts:225`). The public `align`/`format` path will treat the key as unapproved until it gets proof. This matches the contract text, but no test covers it.
- **Silent all-or-nothing fallback.**
  - One row with a comment around the dot drops `(` and `)` alignment for the whole run, which the earlier envelope did align.
  - That is safe, and test 3 pins it. Nothing reports it, so the skill's manual-verification rule is the only safeguard.
- **Redundant dot axis for same-signature runs.** When the run takes the envelope path with identical callee text (for example non-null wrappers), the dot is already aligned. The axis still appears and changes the key.
- **Negative tests missing:**
  - `rows?.filter(x)`
  - `foo().bar(x)` and `this.x.y(z)`
  - only one member row alongside bare rows (no dot axis expected)
  - `rows. filter(x)` (space after the dot accepted, not edited)
  - `rows.filter(x)!`
  - same-signature rows keeping the legacy key
- **Test 3 can't isolate its two comment cases.** One failing row drops the whole run, so a regression in only one placement would be indistinguishable from the other.
- **Inventory wording.** Step 2 says `receiver | . | method` without saying "final" dot. The link to the contract section covers it, but nested receivers would be clearer stated in the skill.

## Does the inventory prevent the observed false completion?

Partly. The inventory (naming `.`) plus reconcile-against-axes is the right gate for the observed case, where `(` and `)` were aligned and the dot silently wasn't. It is a process rule, so it depends on the agent following it. It becomes reliable after defect 2 is fixed: reconcile after Align, and include `skipped`. The engine now emits `call-member-dot=N`, so a missing axis is detectable.
