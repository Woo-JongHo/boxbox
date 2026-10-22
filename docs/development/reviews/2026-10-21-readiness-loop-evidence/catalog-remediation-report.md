# READINESS1 catalog remediation report

## Owned repository change

Only `product/rules/patterns/catalog.json` was changed by this remediation.

## Independent-review corrections

- Added `verification: "design-only"` to all 45 cases.
- Added non-empty per-case `evidence` arrays. Every entry is an existing repository-relative engine, test, or fixture path.
- Reworded every leading `Supported` or `Partially supported` expectation as `Design-only sample; related engine capability: ...`. These statements distinguish related tested machinery from execution of the exact synthetic snippet.
- Kept unsupported and needs-review cases contextual. No case received approval, authority, license, or public-preset metadata.
- Clarified TypeScript's two-row declaration behavior: the detector-specific floor does not bypass exact approved-rule and proof gating. Family and case evidence includes `test/typescript-align.test.ts` and `test/recommended-preset.test.ts`.
- Replaced false JSON/YAML “adapter does not exist” claims. The catalog now records the bounded internal adapter in `product/engine/structured/index.ts`, its tests in `test/structured-align.test.ts`, and the remaining public CLI integration and approved-preset work.
- Replaced circular structured-document evidence with the internal adapter, structured tests, CLI, and authoring-mode test paths.
- Added a deliberately long row or comment variation to one existing case in each of the nine families, without increasing the 45-case set. Each affected expectation says the long form is design-only and does not authorize width padding.
- Preserved the exact nine family IDs and the five required case kinds per family.

## Verification

Catalog-specific structural check:

```text
validated 9 families, 45 design-only cases
```

The check also verified that each evidence path exists and found no stale “no JSON/YAML adapter” statements or expectations beginning with `Supported` / `Partially supported`.

Repository test:

```text
bun test test/pattern-catalog.test.ts --timeout 60000
8 pass
0 fail
59 expect() calls
```

The first test attempt occurred before the concurrent parent schema/type update accepted `verification` and per-case `evidence`; all five then-existing tests failed at the same `verification: unknown field` validation point. After that authorized parent update landed, the full current eight-test suite passed.

Final catalog SHA-256:

```text
da0111ff1ab2f1cb72efc6d5caf780ee592a05363d67897dea9877263a19ccb2
```

BoxBox PostToolUse continued to report global dirty-worktree failures/source-changed races while concurrent tasks edited other files. The catalog-specific parser, evidence validation, and current pattern-catalog test suite passed.
