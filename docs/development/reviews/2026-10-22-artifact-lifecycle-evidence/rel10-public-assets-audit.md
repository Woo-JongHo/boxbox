# REL11 public asset boundary audit

Date: 2026-10-22  
Mode: read-only static/package audit; no source edits, publication, approval, authentication, native host mutation or heavy test rerun  
Frozen source: `66eb97821d6b`  
Installer archive: `/tmp/boxbox-readiness/rel10-fixed-candidate-1f1343e9/boxbox-plugin-0.2.4.tgz`  
Installer SHA-256: `1f1343e91d2799998884ed5d75e1a26d7858226d2f9f51f07621bfeedaf6ecd3`  
Pending CI candidate: `39646320662` (running when audited; no result claimed)

## Verdict

**ACTION REQUIRED for public-facing documentation; package allowlist PASS.**

The exact installer archive has a narrow public payload and no observed development/research database, SQLite index, credential, scratch, source-map, raw runner source or repository-internal document. The nested engine exposes the intended public executable behavior in one compiled `dist/cli.js`; it does not ship the raw engine writer modules or development runners. TypeScript/Python/strict JSON/YAML support and write-approval limits are consistent across the packaged engine README, installer README, root EN/KO/zh-CN READMEs and `docs/user/modes.md`.

One current user guide is materially stale: `docs/user/codex-windows-test.md` still tells users to test `boxbox-plugin-0.2.1.tgz`, describes a 0.2.0 → 0.2.1 migration and cites Codex 0.157.1 evidence. All three root READMEs link that file as the current installation guide while the audited candidate is 0.2.4 and its installer has new Claude identity/partial-state behavior. This is an actionable release-documentation defect, independent of licensing/publication/auth decisions.

## Exact package inventory

The outer installer contains 46 entries. Its top-level public surface consists of:

- one package manifest, README and `bin/boxbox.mjs`;
- per-host bundle metadata and plugin manifests;
- only the canonical skill/references and Claude read-only inspector;
- three hook definitions and HUD scripts;
- installer/platform/state/Claude-registration helpers;
- one identical nested engine archive per host.

Both nested engine archives have SHA-256 `a727612311a744773e8e01c35e53fc486b4e5237da32571ba37645c671b5e87b` and exactly these nine entries:

```text
package/THIRD_PARTY_NOTICES
package/dist/cli.js
package/package.json
package/rules/presets/recommended/conventions.jsonl
package/rules/presets/recommended/decisions.jsonl
package/rules/presets/recommended/examples.jsonl
package/rules/presets/recommended/docs/public/decisions/py-simple-assignments.md
package/README.md
package/rules/presets/recommended/docs/public/decisions/ts-sourcefile-call-declarations.md
```

The full outer list is preserved at `/tmp/boxbox-readiness/rel10-public-assets-files.txt`.

### Exclusion checks

Path scans found none of the following:

- `development/`, `docs/development/`, corpus, stress, research or scratch trees;
- SQLite/database files (`*.sqlite`, `*.sqlite3`, `*.db`) or the development index;
- `.git`, `.env`, credentials, secret/key files or source maps;
- raw `01_group-regions` / `06_align-tables` runners or writer source modules;
- author-machine absolute `/Users/...` or `C:\Users\...` paths.

Content scans outside the opaque nested tarball found no common API key, access token, private-key, npm token, GitHub token or OpenAI-key patterns. The nested tarball was separately extracted and scanned. This is a pattern-based audit, not a formal secret scanner or provenance attestation.

The bundle does contain intentional public write commands (`align` and `format`) and user-local JSONL DB/run receipt functionality. Those are compiled CLI product features documented by the packaged README; they are distinct from raw writer source, the development research DB and the SQLite learning index.

## Capability and documentation matrix

| Surface | Audited claim | Consistency result |
|---|---|---|
| Public Check engines | TypeScript (`.ts/.tsx/.mts/.cts`), Python, strict JSON, YAML 1.2 (`.yaml/.yml`) | Matches bundle extension registry and packaged/root/modes docs |
| Public Align implementations | Same four language families | Matches docs; JSON/YAML remain approval-ineligible by default |
| Default write authorization | TS top-level single-call declarations and Python simple assignments only | Matches all current principal docs and packaged preset contents |
| JSON/YAML boundary | 3+ adjacent same-level single-line scalar mappings; documented YAML exclusions | Matches root translations, modes and engine README |
| Modes | Write/Refactor are agent workflows; Align/Check are engine operations; `format` is separate | Consistent |
| Codex/Claude installer | Both hosts; permanent per-host engine; no trust grant | Consistent and conservative |
| OS | Installer documents Windows/macOS/Linux paths; Windows HUD unsupported | Consistent |
| HUD | macOS/Linux terminal only; Claude status line and Codex tmux companion; no current-session/hook-acceptance proof | Consistent across three root READMEs, installer README and HUD guide |
| Development languages | Ten-language development inspector list remains separate from four-language public CLI | Correctly distinguished in root READMEs |

All three root READMEs have the same 10 fence markers and identical link-target sets; every local target exists. Their support tables, commands, JSON/YAML exclusions, HUD limits and release-status statements are materially parallel.

## Actionable engineering gaps

### P1 — refresh or retire the stale Windows installation guide

`docs/user/codex-windows-test.md:23-43` hard-codes a 0.2.1 archive and a 0.2.0 → 0.2.1 procedure. Lines 52-53 describe older Node/Python/Codex results as the current verification state. `README.md:25,83` and its two translations direct users to this file as the current guide.

Impact: a user following the current README can select the wrong local artifact and receive upgrade/recovery instructions that omit the 0.2.4 Claude scoped-update and partial-state safeguards. The old native evidence also cannot establish the current archive.

Smallest fix: rewrite the guide around `<version>`/the exact `pack:installer` output, move dated 0.2.0→0.2.1 evidence into a historical review, add the current Codex manual marketplace handoff and Claude verified-registration/retained-partial-state behavior, and state the final native matrix result only after it completes. Update EN/KO/zh-CN root wording together only if link text or support statements change.

### P2 — remove machine/account-specific authentication prose from the user guide

`docs/user/codex-windows-test.md:6` names the local npm account and states that this machine is authenticated. No credential is exposed and this text is not inside the npm archive, but it is mutable operator state and personal identity in a user-facing document.

Smallest fix: replace it with a durable statement that publication authentication and registry name acceptance are pending, keeping actual account/auth evidence in protected release evidence rather than user documentation.

### P3 — bind the final documentation to the exact published/archive candidate

The packaged installer README correctly uses `<version>` and the archive metadata is 0.2.4/UNLICENSED. Root docs also say publication and native acceptance remain pending. Before any release claim, record the final archive SHA and completed native matrix against the same bytes; do not reuse the older 0.2.1 Windows result. This is an engineering evidence step, while the decision to publish is human-owned.

## Pending human/external gates, not source defects

- npm name acceptance, publisher authorization and authentication;
- license decision for the `UNLICENSED` installer/private engine and final release metadata;
- any final decision to approve JSON/YAML write rules (none are approved now);
- publication itself;
- completion of CI candidate `39646320662` and the exact-archive real-host/native acceptance matrix;
- hook trust and authenticated host/session acceptance, which installation and HUD rendering do not prove.

The four synthetic preset examples' CC0 status and the bundled YAML ISC notice do not resolve the installer/engine license decision. This audit does not approve licensing or publication.

## Evidence files and method

- exact outer listing: `/tmp/boxbox-readiness/rel10-public-assets-files.txt`
- extracted scratch root: `/tmp/boxbox-readiness/rel10-public-assets-extract.im7zXl`
- source/doc inputs: `README.md`, `README.ko.md`, `README.zh-CN.md`, `docs/user/*.md`, `product/installer/README.md`, `product/packages/cli/README.md`
- checks: SHA-256, tar inventories, path/content pattern scans, packaged manifest/README inspection, compiled extension-registry inspection, root README link/fence parity and local-link existence

No full test suite, package rebuild, installer execution, native host test, auth probe or CI query was performed. Existing reviews/checks were treated as supplied context, not rerun or independently promoted to approval.
