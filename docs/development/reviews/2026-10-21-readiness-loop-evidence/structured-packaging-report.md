# Structured public packaging preparation

Date: 2026-10-21

## Owned packaging changes

- `development/tools/build-cli-artifact.ts`
- `product/packages/cli/package.json`
- `test/public-artifact.test.ts`
- `development/tools/release-smoke.mjs`

Pre-edit snapshots are under `/tmp/boxbox-readiness/structured-packaging-before/`.

The CLI builder reads `node_modules/yaml/package.json`, requires exactly `yaml@2.9.1` with ISC licensing, and writes `THIRD_PARTY_NOTICES` using a package/version header followed by the exact installed `node_modules/yaml/LICENSE` text. It also verifies that the generated bundle contains the pinned parser identity. The public CLI manifest includes the notice. yaml remains statically bundled and is not a runtime dependency.

The public artifact test verifies exact notice bytes, archive membership, absence of a nested yaml dependency, isolated JSON/YAML valid and invalid Check behavior, unsupported YAML preservation, refusal without a public rule, and a test-local synthetic JSON approval preview/apply flow. Public preset data is unchanged.

The same-archive release smoke verifies the installed notice and absence of a nested yaml runtime package. It checks JSON/YAML syntax and candidates, branches on actual artifact approval eligibility, requires a clear refusal while no approved structured rule ships, rejects invalid JSON/YAML, and keeps unsupported YAML valid and unchanged.

No artifact builder, npm pack, installer builder or release smoke was executed while concurrent HUD/docs inputs were changing. Narrow preparation checks completed:

```text
node --check development/tools/release-smoke.mjs
node -e 'JSON.parse(require("node:fs").readFileSync("product/packages/cli/package.json","utf8"))'
# manifest ok
```

An error-filtered TypeScript check produced no diagnostics for the owned builder, public artifact test, structured engine or pipeline files. `git diff --check` and the placeholder scan passed for all owned files.

## Frozen engine prerequisite

Flow maps return `visit.SKIP`, so their descendants never become block-map candidates. Root, plain, anchored and tagged multiline flow maps with three inner scalar properties remain unchanged. Forward aliases are invalid while existing and cyclic aliases are accepted without graph expansion. The structured cycle validates raw UTF-8 before invoking any configured formatter; a sentinel test proves invalid bytes cannot trigger formatter side effects.

```text
bun test test/structured-align.test.ts test/structured-pipeline.test.ts
17 pass
0 fail
98 expect() calls
```

Engine files are frozen for the alias/integration worker. Packaging remains prepared but deliberately unbuilt pending the parent gate.
