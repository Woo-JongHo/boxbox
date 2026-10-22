# REL10 final CI public payload audit

Date: 2026-10-22  
Mode: read-only archive/source audit; no repository edits, rebuild, installer execution, publication, authentication or native host mutation  
Source: `66eb97821d6b`  
CI run: `39646320662`

## Verdict

**PASS for the bounded static public-payload audit.**

The exact CI archive is `/tmp/boxbox-readiness/ci-candidate-39646320662-1-early/boxbox-plugin-0.2.4.tgz` (263896 bytes), SHA-256 `ebfe6a7796d9d85e9cf3088c955df4fb5477e60513e8ebda97d517746d93c665`. The supplied status at audit time is package + verify PASS with smoke still underway. This report does not claim that smoke, the workflow or the native matrix completed.

## Archive allowlist and local comparison

The CI and local `1f1343e9…` archives both contain exactly 46 outer paths, with identical path sets. Forty-four outer files are byte-identical. The only two byte differences are the duplicated nested engine tarballs:

- CI Codex/Claude nested engine SHA-256: `b1c385587ec427ef517277b48df3ffb107e7daca377e5ffb1a9b93115890cf07`
- local Codex/Claude nested engine SHA-256: `a727612311a744773e8e01c35e53fc486b4e5237da32571ba37645c671b5e87b`

After extracting one nested engine from each archive, their nine paths and every decompressed file byte are identical. The nested allowlist is only `dist/cli.js`, private engine package metadata/README, `THIRD_PARTY_NOTICES`, three recommended preset JSONL files and two public decision documents. Thus the outer archive difference is packaging/compression representation, not payload content drift.

Full CI outer path list: `/tmp/boxbox-readiness/rel10-ci-public-assets-files.txt`.  
Per-file CI hashes: `/tmp/boxbox-readiness/rel10-ci-public-assets-file-hashes.json`.

## Exclusion scan

Path and extracted-content scans found zero matches for:

- development/research/corpus/stress/scratch trees or internal development documentation;
- SQLite/database/index files (`*.sqlite`, `*.sqlite3`, `*.db`);
- `.git`, `.env`, credentials/secrets/private keys, common npm/GitHub/OpenAI token patterns;
- raw `01_group-regions` / `06_align-tables` runners, raw writer source or source maps;
- author-machine `/Users/...` or `C:\Users\...` paths.

The compiled CLI intentionally contains its documented Align/Format product behavior and local JSONL/run receipt features. Those are not raw source writers, the research database or the SQLite learning index.

## Installer freeze binding

Every entry in `/tmp/boxbox-readiness/rel10-installer-freeze-final.json` matches both the current working byte and `git show 66eb978:<path>`:

| Frozen source | SHA-256 match | CI package binding |
|---|---:|---|
| `product/installer/entry.mjs` | yes | exact `package/bin/boxbox.mjs` |
| `product/installer/install.mjs` | yes | exact Codex and Claude helper copies |
| `product/installer/install-state.mjs` | yes | exact root, Codex and Claude copies |
| `product/installer/claude-registration.mjs` | yes | exact root, Codex and Claude copies |
| `product/installer/README.md` | yes | exact `package/README.md` |
| `development/tools/build-installer-artifact.ts` | yes | source-only build input, not shipped |
| `test/installer-registration.test.ts` | yes | test-only, not shipped |
| `test/installer-artifact.test.ts` | yes | test-only, not shipped |

Detailed source/commit/package hashes: `/tmp/boxbox-readiness/rel10-ci-installer-freeze-comparison.json`.

Package metadata is `boxbox-plugin` 0.2.4, Node `>=22.22.3`, `UNLICENSED`; the nested private engine is `boxbox` 0.2.4 and declares only `typescript@7.0.2`. This audit does not resolve or approve release-package licensing/notices.

## Documentation and pending gates

The Windows-guide G1/G2 corrections are independently recorded as PASS in the supplied closure and were not repackaged into this CI artifact because they are repository user documentation, not installer payload content. The shipped installer README exactly matches its reviewed frozen hash.

Still pending or outside this audit:

- smoke/workflow completion for CI `39646320662`;
- final exact-archive native macOS/Windows/Linux host matrix and authenticated session/hook/UI acceptance;
- npm name acceptance/reservation, publisher authentication, publication authorization and registry journey;
- final license/channel/metadata/notices decisions.

## Evidence files

- compact receipt: `/tmp/boxbox-readiness/rel10-ci-public-assets-audit.json`
- outer paths: `/tmp/boxbox-readiness/rel10-ci-public-assets-files.txt`
- outer per-file hashes: `/tmp/boxbox-readiness/rel10-ci-public-assets-file-hashes.json`
- frozen source/package comparison: `/tmp/boxbox-readiness/rel10-ci-installer-freeze-comparison.json`

No heavy tests were repeated. Existing package/verify results and documentation review closure were treated as supplied evidence and not promoted beyond their stated scope.
