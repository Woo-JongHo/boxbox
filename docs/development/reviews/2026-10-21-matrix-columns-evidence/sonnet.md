**PASS.** I found no blocking defects. I read the code only and ran nothing, so I haven't verified the reported test, typecheck and fixed-point logs.

## Checked and sound

- **Token preservation.**
  - The return-guard edit is only the span `)`…`return` (`grid-kinds.ts:503-512`). `spacesOnly` rejects comments, and `ownLineOf` rejects multi-line rows.
  - The envelope edits are only callee-end→`(` and last-arg-end→`)`. `tokenAfter` allows only `[ \t]` there (`grid-kinds.ts:921-937`). That excludes comments, trailing commas and newlines, and the tests cover those cases.
- **Unsupported forms.**
  - `envelopeCall` (`:909-918`) excludes `await`, `new`, optional chains, type arguments, element access, call-produced receivers, `using`/`await using`, `!!` and `as`.
  - If any row in a run is ineligible, the whole run stays unchanged (`:944`, `:951`). That is conservative.
  - Empty calls keep `()` (`:933`). A close axis with fewer than two rows is skipped by the `entries.length < 2` rule in `align.ts:86`.
- **Overlapping edits.**
  - Guard edits sit between `)` and `return`. `detectGuard` takes only braced bodies and `detectReturnGuard` only a bare `return` (no `else`), so no `if` node is claimed twice.
  - Envelope edits land in disjoint spans on the same statement, and `withCallEnvelope` strips all earlier-layer boundaries from those rows.
  - `returnGuardRuns` bridges only immediate siblings, and inner blocks get their own runs.
- **Idempotence.** Target columns derive from `from`, not `at`. The widest row always has zero padding, and the `)` of a guard row never moves. Both gap and insert paths are stable on a second pass.
- **Approval keys.**
  - `declarationGroupName` (`:639`) gives the envelope its own kind name. `normalizeAxis` leaves the new axis names unchanged, so there is no collision with `declaration-equals|equals>call-open-paren>call-close-paren>semicolon`.
  - `withCallEnvelope` returns early when a run has a single signature and every row has a legacy call (`:948`). That keeps the old layer, including the outlier/vertical path.
  - `presets/recommended/conventions.jsonl` still holds only the two original approvals. The `base/typescript.json` additions are surface-pattern mappings, and `surface.test.ts:32-36` requires them.

## Non-blocking findings

1. **Report range overlap.** A return-guards group spans every line from its first to its last guard (`align.ts:134-135`), including bridged statements and any nested groups. In `report.ts`, `alarmsOf` (`:197-252`) treats all of those lines as table rows. That can produce false A1/A3/A7 alarms. It also suppresses A12 for stray `;` padding in the span (`:218`), because `groupAt` finds the first overlapping group. These alarms are advisory only. A later fix would be to compute widths over the guard rows only.
2. **Public format now refuses more files.** `format-pipeline.ts:98-109` denies the whole file if any PASS or FIXABLE group is unapproved. A file with three or more sibling guards that used to format under the approved declaration key now fails closed, even when already aligned. This does not expand approval and is the safe direction. Confirm it is intended.
3. **Zero-argument and `!` runs are renamed.**
   - Same-callee runs with no arguments, or with a trailing `!`, have no legacy call, so `withCallEnvelope` (`:946-948`) turns them into `declaration-call-envelope`.
   - They used to be `declaration-equals|equals>semicolon`, which was not an approved key, so the public outcome is unchanged.
   - No test pins this, and the comment at `:939` implies they are untouched. Add a one-line test or note.
4. **Two-row allowance widened.** `report.ts:64` hard-codes `declaration-call-envelope` into `TWO_ROW_KINDS`. That is consistent with the authorization you described, but S4 will report pass for a two-row envelope that the public approval gate still denies. The two-row `return-guards` case in `test/report.test.ts:62-71` can never occur at runtime, because the minimum is 3. It is harmless.
5. **Trailing comments split guard regions.** A trailing `//` on a guard row (allowed by `LINE_REST`) ends the region, because the following gap is non-whitespace (`:886-888`). This is safe, but it is undocumented and untested.
6. **Contract table not updated.** The kind and axis table in `readability-contract.md:141-155` omits `return-guards`, `declaration-call-envelope` and their axes, even though `:133` says it maps 1:1 to `KIND_AXES`. The prose at `:41-50` does cover them. This is documentation only.
