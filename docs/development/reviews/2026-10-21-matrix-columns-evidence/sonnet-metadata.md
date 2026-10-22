**PASS.** I found no blocking defects. I read the code only and ran nothing. The 44-test and tsc results are yours; I didn't re-verify them.

**Metadata production**
- `buildGroup` sets `rowLines` only when `kindName === "return-guards"`. It records each row's own start line, which is exact because `detectReturnGuard` requires `ownLineOf(..., LINE_REST)`, so each row is one line.
- `collect` passes `kind.name` as `kindName`. `return-guards` has no `groupName`, so `kind.name` and `group.kind` are the same string here and the gate can't miss.
- The metadata survives both the normal path (`groups`) and the refused path (`refused`) at `align.ts:339-340`. `refused` holds the same `TableGroup` objects, so nothing is rebuilt and nothing is lost.
- Line numbers stay valid for the report. Return-guard edits are whitespace-only and `vertical` is 0, so no edit shifts lines.

**Compatibility**
- `rowLines` is optional and additive, and `schemaVersion` stays at 1. Ordinary groups pass `rowLines: undefined`, which `JSON.stringify` drops, so their JSON is unchanged. The CLI test asserts this with `!("rowLines" in entry)`.
- Older baselines and results without `rowLines` fall back to the inclusive span in both `groupAt` and `rowLinesOf`.
- `alarmKey` uses `id|anchor`, so baseline comparison is unaffected. The approval paths (`cli.ts:324-326`, `cli.ts:376-378`) copy only `context`, `kind` and `axes`, so they don't touch the new field.

**Report alarms**
- **A1:** the line-to-group lookup now uses exact membership, and the per-group row list comes from `rowLinesOf`. An intervening long line is correctly reported as "outside table".
- **A12:** `groupAt(lineNumber)` is now false for intervening lines, so stray `;` padding there is flagged. The first test covers this.
- **A2, A3, A7:** widths, the outlier row and the padding ratio all use `rowLinesOf`, so intervening lines no longer skew them. A3 reports the exact row. The reported span for A0, A2 and A7 stays start–end, which is the intended extent.
- The nested test shows the outer group no longer claims the inner rows. A1 is reported once for the inner group (3–5), and A3 lands on line 4.

**Non-blocking notes**
1. `groupAt` returns the first match in group order. If an ordinary contiguous group (a multi-line row such as an object row or arrow body) spans lines that belong to a guard group's `rowLines`, the earlier group claims them. The over-hard line would then go to the ordinary group, and the guard group's own A1 would never fire. This was already true for nested ordinary groups, and I couldn't confirm a real input that triggers it. To harden it, try an exact `rowLines` match across all groups first, then fall back to the span match. No test covers this case.
2. The `kindName === "return-guards"` string check in `buildGroup` duplicates the kind registry. A flag on `RowKind`, such as `noncontiguous: true`, would let future noncontiguous kinds opt in without editing `buildGroup`.
3. `rowLines.includes` inside `groupAt` runs for every line and every group. That's fine at current sizes, but a `Set` or a precomputed line-to-group map would remove the cost on very large files.
4. `rowLines` isn't validated when it's read back from JSON. Rows are always at least 3, so an empty array can't happen from this engine. A hand-edited result could still reach `Math.max(...[])`. Ignore this unless results can come from outside the engine.

**Tests**
- The three new tests cover the intervening-line case, nested ownership, and the CLI end to end.
- The CLI test checks exact `[2, 8, 11]` and `[4, 5, 6]`, that a `declaration-equals` group is present, that ordinary groups carry no `rowLines`, and that `schemaVersion` is 1.
- The 60-second timeout is reasonable for a subprocess test, and the `rmSync` cleanup is in `finally`.
