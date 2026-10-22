# Public repository and payload hygiene audit

Date: 2026-10-21
Mode: read-only
Scope: all 455 modified/untracked regular files reported by `git status --porcelain=v1 --untracked-files=all`, plus the current 0.2.4 engine, installer, and release-candidate tarballs and both nested engine archives.

## Verdict

**FIX_REQUIRED for an indiscriminate `git add -A`; PASS for the frozen runtime payload tarballs.** One untracked generated Python bytecode file is inside the prospective repository set and must be excluded from commit scope. No credential or secret signature was found. Recorded evidence contains machine-local absolute paths; these expose a local account/path label but no credential value.

## Repository findings

### Mandatory exclusion

- `docs/development/issue-library/__pycache__/validate.cpython-314.pyc`
  - Type: generated Python bytecode / binary cache.
  - Count: 1 file.
  - Git state: untracked and not covered by the checked ignore rules.
  - Impact: `git add -A` would include a machine-generated binary unrelated to the public source/evidence contract.
  - Required disposition: omit/remove from commit scope and preferably ignore `__pycache__/` / `*.pyc` in a separately owned edit.

### Secrets and credentials

Scanned changed/untracked file contents without emitting matched values:

- Private-key blocks: 0
- GitHub token shapes: 0
- AWS access-key shapes: 0
- Slack token shapes: 0
- npm token shapes: 0
- JWT shapes: 0
- Authorization-header credential shapes: 0
- SSH public-key blobs: 0
- Email-address shapes: 0
- IPv4-address shapes: 0
- Generic secret-assignment candidates: 1 in `test/guarded-run.test.ts`; manual classification: deliberate inert test fixture at line 36, not a credential.

### Local and session evidence

- Machine-local `/Users/<account>/...` paths: 73 occurrences in 42 files.
- All occurrences are confined to recorded development/issue evidence, review output, or captured validation artifacts; none occur in shipped product/plugin source or current tar payloads.
- These paths reveal a local account/path label. They do not contain token/password material under the scans above. Repository policy explicitly keeps recorded evidence as recorded, so this is a privacy disclosure to accept knowingly rather than a secret blocker.
- Files whose names include `session` or `transcript`: 4 changed/untracked evidence files:
  - `docs/development/reviews/2026-10-21-authoring-modes-evidence/installed-transcript.json`
  - `docs/development/reviews/2026-10-21-matrix-columns-evidence/installed-transcript.json`
  - `docs/development/reviews/2026-10-21-self-use-boundaries-evidence/session-checks.json`
  - `docs/development/reviews/2026-10-21-self-use-refactor-evidence/session-checks.json`
- Classification: captured product-install/check evidence, not agent conversation/session persistence. No credential signatures were found.

### Size and generated artifacts

- Changed/untracked regular files: 455.
- Largest prospective file: `docs/development/plan.md`, 118,216 bytes.
- No changed/untracked regular file exceeds 119 KiB.
- Binary files found: exactly the single `.pyc` above.
- No changed/untracked SQLite database, corpus checkout, archive, image, or other large binary was found by path/type review.
- `dist/` is ignored and therefore outside prospective Git commit scope.

### TODO, skip, only, and unimplemented-branch audit

- Added-line diff scan found no newly added `TODO`, `FIXME`, `XXX`, `HACK`, `test.only`, `describe.only`, `it.only`, or explicit unimplemented exception in changed tracked source.
- `test/parse-check.test.ts` contains an existing/changed-context `test.skipIf(!parserAvailable(...))`; it is a capability-gated parser test, not an unconditional skip or placeholder. It was not newly added by the current diff scan.
- `product/engine/typescript/08_function-map.ts` emits literal `TODO` cells as the intended generated function-map template; no new TODO line was introduced.
- Other matches are roadmap/status prose, historical review evidence, or instructions describing the placeholder audit itself.
- No `test.only`/`describe.only`/`it.only` match was found.

## Runtime payload audit

### Frozen artifacts

- `dist/boxbox-0.2.4.tgz`: 103,759 bytes; SHA-256 `01b2dfc82351a78cbc23d9eeed94ee6c5852db064eb53e752a44536fef0d4c1f`; 9 entries.
- `dist/installer/boxbox-plugin-0.2.4.tgz`: 256,841 bytes; SHA-256 `13e099e00f160f95481a38afeb7ed717bf44afe9aa04ad11e347bcf5e9fc0177`; 40 entries, including 2 nested engine archives.
- `dist/release-candidate/boxbox-plugin-0.2.4.tgz`: byte-identical to the installer tarball; SHA-256 `13e099e00f160f95481a38afeb7ed717bf44afe9aa04ad11e347bcf5e9fc0177`.

For all outer and nested archive listings:

- SQLite/database names: 0
- Corpus paths: 0
- Private review/evidence paths: 0
- Session/transcript paths: 0
- `.env`, credential, secret, private-key filename shapes: 0
- Private-key/token/AWS/JWT content signatures: 0
- Machine-local user paths: 0

The two files counted as binary in each installer outer archive are the expected nested gzip-compressed engine tarballs. Their contents were recursively opened and scanned (9 entries each) with no hygiene finding.

## Safe commit-scope guidance

Do not stage `docs/development/issue-library/__pycache__/validate.cpython-314.pyc`. Apart from that file, this audit found no secret, credential, private corpus, unintended session transcript, large binary, or runtime-payload contamination in the current changed/untracked set. The 42 evidence files with local absolute paths should be treated as an explicit public privacy choice consistent with the repository's recorded-evidence policy.
