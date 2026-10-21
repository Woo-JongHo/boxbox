# Independent review — REL10 exact-artifact lifecycle harness

Date: 2026-10-22
Mode: read-only gate before native host mutation. No host install, transition, repair or removal command was executed.

## Verdict

**PASS for the pre-native execution gate; no mandatory finding.** The frozen harness is fail-closed around the two exact archives, constrains all host and installer state to a new task-owned workspace, exercises real host CLIs rather than substitutes, distinguishes direct success from the documented named-collision/manual transition, and retains enough command and residue evidence to evaluate a native cell. Pure tests are meaningful for the boundaries they claim. They do not establish lifecycle success; macOS, native Windows and Linux/WSL cells remain unexecuted until separately authorized and reviewed.

Frozen files independently match the requested SHA-256 values:

- `development/tools/release-lifecycle.mjs`: `1b8a197be252133fb5792194d74f80e43a227c8feb747dc8a69998afb0a4ef49`
- `test/release-lifecycle.test.ts`: `d0c451acde4770a32463af8c6756f2e261d05a90e2f0f7c60204ba498252da04`

The two local input archives also match their pinned identities:

- historical 0.2.3: `f07df7ada9aa234c2935ed500b4fe15b1a5d53f7b7a6de7d8ec107f53c8f572c`
- CI candidate 0.2.4: `bec626435e525c2d7324d156f85d2c114427d875725abcecb42fed561b2b92be`

## Gate review

### Artifact and command binding

- Archives must be regular non-symlink files and match pinned bytes before extraction/candidate execution, before every installer attempt and at completion.
- Extracted package name/version are checked before importing the current artifact's platform resolver.
- Exactly one explicit real host is selected. CLI executable/version and plugin/list/removal help are captured; JSON listing is required to be advertised.
- Registration acceptance verifies plugin identity, exact version, enabled state, marketplace root/source, plugin manifest and runtime CLI root. Direct exit zero cannot pass with a stale registration.
- Measured Codex and Claude JSON schema readers match the retained real schema samples. Unknown or duplicate schemas and foreign registrations fail.

### Isolation and ownership

- Output must not exist and is created non-recursively; a failed run is retained and cannot be reused.
- HOME/USERPROFILE, XDG locations, APPDATA/LOCALAPPDATA, both host homes, temp paths, npm cache/prefix/user/global config all point under the owned workspace.
- Child inheritance is an allowlist limited to executable discovery, OS essentials and locale/timezone. Credentials, host/plugin overrides, `NODE_OPTIONS` and inherited npm configuration are excluded.
- No live profile, auth file or setting is copied. The generated unrelated-host sentinel is test data within the isolated profile.
- Host-reported paths are realpath-checked against exact version roots and the plugin root is physically contained in the workspace, rejecting path/symlink escapes.
- Host configuration is changed only through documented CLIs after initial isolated sentinel creation; the harness does not patch registration state directly.

### Lifecycle behavior

- Fresh 0.2.3 verifies registration/root/version, init, doctor and approved TypeScript check → dry-run → apply → recheck → idempotent apply.
- The cold 0.2.4 attempt uses a distinct empty npm cache with `npm_config_offline=true`; it must fail with `ENOTCACHED` mentioning TypeScript, leave no partial current root, preserve the old registration/data and keep the old engine usable.
- Warm offline same-version repairs are required for both versions. Preservation checks run after registration and engine operations.
- Direct transitions accept only an actual version/root switch. Nonzero transition results permit manual removal only for a specifically recognized BoxBox marketplace collision; all other errors abort without automatic unregister/config edits.
- Collision paths revalidate the prior registration, engine and sentinels before exact plugin/marketplace removal and reinstall. Direct-success paths separately prove the prior standalone engine remains usable.
- Rollback uses the same strict rules. Final removal requires both exact plugin and marketplace absent.
- Project config, copied shipped approval bytes as an inactive archive, project note and per-version user files are hash-pinned. Final checks require both version directories and user/project bytes to remain.
- Version directories are deliberately inventoried as residue. The harness does not claim host unregistration is a product filesystem uninstaller.

### Evidence and failure behavior

- `lifecycle.json` is written before commands and updated with command arguments, output file names, PID/status/signal/error/duration, artifact checks, steps, preservation checks, errors and final residue.
- Stdout/stderr are bounded and stored separately. Unexpected status, signal, timeout, schema, path, identity, preservation or collision errors stop the cell with no retry or cleanup masking.
- npm offline mode is accurately limited to dependency-cache behavior; it is not described as OS-wide isolation.
- The historical archive is explicitly qualified as an uncommitted fixture, not an approved/released baseline.
- The design does not infer automatic or atomic cross-version migration, global network blocking, HUD/hook/auth acceptance or release readiness.

## Test assessment

Focused rerun:

```text
bun test test/release-lifecycle.test.ts --timeout 60000
6 pass, 0 fail, 56 assertions
```

The tests cover strict arguments, environment allowlisting, archive byte/directory/symlink rejection, real-schema ownership ambiguity, fail-before-spawn evidence retention and narrow collision classification. They intentionally avoid fake host lifecycle success. `node --check`, CLI `--help`, frozen hashes and `git diff --check` also passed in this review.

## Native execution review requirements

A later native cell must still be judged from retained evidence. PASS here authorizes only proceeding to that separately owned execution step. Review the actual host version/help, initial emptiness, cold-cache failure cause, prior usability, transition branch, warm repairs, rollback, final absence, preservation hashes and residue inventory. A timeout requires process/descendant inspection before cleanup. Unsupported/unavailable OS or host cells remain open rather than being inferred from this gate.
