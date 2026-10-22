# REL10 Claude installer transition — independent source review

Date: 2026-10-22  
Scope: read-only source/test/artifact review. No native install, host registration, or product edit was performed.  
Verdict: **FAIL — three mandatory ownership/capability gates are missing.**

## Frozen source set

The hashes in `/tmp/boxbox-readiness/rel10-installer-freeze-first.json` matched all eight reviewed files:

- `product/installer/install.mjs`: `ed1aaef067811388c65ea504b28a5baa7790de5d456386b9bf6717359f967fa4`
- `product/installer/entry.mjs`: `69ab069cc8460ffeed5ee8aaf3b10ae9d3c6dbb4db1b903618503cc723c9d41c`
- `product/installer/install-state.mjs`: `2c127c6bc639f315dd485da08b3f293b7b086185dd376addc52b6707b69c72e7`
- `product/installer/claude-registration.mjs`: `5e1727f1abb9cf678b38d9fa1e71adf9ea271d6b8e84464950fed5c20d0e7dba`
- `product/installer/README.md`: `391a25ba03c00c0462b5313fb3546a021296c00d9cf9a4c9092e5189ebe2cdb8`
- `development/tools/build-installer-artifact.ts`: `3c895df40e0a7d563f3cb13b0fc418b8d0b9a597ef9a669f4e9250027ea25d32`
- `test/installer-registration.test.ts`: `c9e634835a0dd18be4c5628f085b9fafe1bb7965b96432ae8495874bbf0f6bfd`
- `test/installer-artifact.test.ts`: `27f5b946a1232f01925d0cb7221c9ddcd7ac5b188b81ab6cae0493509c09d37e`

## Mandatory finding

### M1 — Claude scoped-update support is not verified before the first host mutation

The diagnosis and accepted plan require the selected Claude CLI to prove `plugin update` and `--scope` support before mutation, because macOS used 2.1.286 while Windows/Linux acceptance targets include 2.1.280. The implementation probes only:

```text
claude --version
claude plugin install --help
```

(`product/installer/install.mjs:53-56`). It does not run `claude plugin update --help` or require that help to advertise `--scope`. After that incomplete preflight, it advances the receipt to `host-registration-started`, repoints the marketplace, and installs. Only when the listed version remains stale does it attempt `claude plugin update boxbox@boxbox-plugins --scope user` (`install.mjs:103-109`, `claude-registration.mjs:37-45`).

On a supported install surface that lacks scoped update, the installer would discover incompatibility only after changing host registration and would retain a recoverable partial state. The receipt prevents destructive cleanup, but it does not satisfy the planned fail-before-mutation compatibility gate. The stateful artifact fake likewise expects only `plugin install --help`, so current tests make this omission stable.

Required closure:

1. Before `state.advance("host-registration-started")`, invoke the selected Claude CLI's exact `plugin update --help` command.
2. Require the measured help surface to advertise `--scope` (and fail before mutation if it does not). Do not infer support from version text.
3. Extend the stateful artifact test to assert the preflight command/order and add a negative help fixture proving unsupported scoped update leaves host state untouched and permits the existing prepared-phase filesystem restoration.

### M2 — Marketplace `installLocation` is not bound to the exact intended root

The measured Claude JSON and the accepted plan bind all three relevant marketplace location fields: `source`, `path`, and `installLocation`. `claudeRegistration.marketplace` currently requires `source === "directory"` and validates only `path` (`claude-registration.mjs:13-23`). It ignores `installLocation` both before replacement and after marketplace add. A record whose `path` names the expected root while `installLocation` remains stale or foreign can pass preflight and final marketplace verification. That weakens the exact-root acceptance contract and can hide the same class of split host identity that triggered this repair.

Required closure: require `installLocation` to be a string and canonically equal to the same expected owned source/root at both preflight and exact post-add verification. Add a negative fixture where `path` is owned but `installLocation` is foreign/stale.

### M3 — Shared-marketplace refusal checks installed records only, not the marketplace catalog

`plugin()` rejects another *installed* plugin whose ID ends in `@boxbox-plugins` (`claude-registration.mjs:25-31`). It never reads the owned source's `.claude-plugin/marketplace.json`. Therefore a local sibling source with valid BoxBox bundle/manifest files plus an additional, currently uninstalled catalog plugin is accepted and can be repointed. Repointing the named marketplace affects that other available plugin even though it is absent from `plugin list --json`. This does not satisfy the promised refusal of a shared marketplace.

Required closure: validate the marketplace catalog at the candidate source as part of ownership proof. Require the expected marketplace identity and an exact single BoxBox plugin entry/source (or otherwise prove that no other catalog plugin can be affected). Repeat the check on the intended root after add. Add a fixture with an uninstalled second catalog plugin and require pre-mutation refusal.

## Confirmed design closures

### Minimal phase receipt

The implementation follows the reviewed simplification: one reserved `.boxbox-install-state.json` inside the exact destination, with schema/root/name/version/host/marketplace binding and only `prepared`, `host-registration-started`, and `verified` phases. The parent creates the fresh receipt after copying the payload and before spawning the child. The child advances it atomically before the first host mutation and verifies only after completion. No external receipt path, nonce service, sibling transaction framework, global rollback, or cross-host atomicity layer was added.

A failure proven to remain `prepared` restores/removes filesystem state. Registration-started, missing, corrupt, signaled, or zero-without-verified outcomes retain destination and the current backup with recovery paths. A successful retry removes only its current receipt/backup; earlier retained sibling backups are not glob-deleted. Foreign and symlink receipts are refused before replacement.

### Claude identity and foreign-source boundaries

The helper uses machine-readable lists and the fully qualified identity `boxbox@boxbox-plugins`. It requires one enabled user-scope record, performs at most one exact scoped update when the recorded version differs, and re-lists afterward. Final verification binds the intended marketplace root, cached manifest name/version, and runtime Node/CLI paths to the installed permanent runtime. Exit zero or human output alone cannot establish success.

An existing marketplace must be one local directory with the exact name. A non-sibling source, remote/malformed record, duplicate target, wrong scope, or another *installed* plugin sharing the marketplace is rejected. The ignored `installLocation` and uninspected marketplace catalog are the M2/M3 gaps above. A sibling is accepted only when its bundle and manifest prove the same BoxBox Claude marketplace and its version-derived permanent location. Marketplace add is followed by an exact intended-root check before plugin install/update.

### Backup and bytes behavior

The parent backs up an existing destination before overlaying the new payload. Tests with real child processes prove exact prior bytes are restored for a prepared-phase failure, while post-mutation/uncertain states retain new bytes plus an accessible backup containing prior bytes. The README accurately calls this partial-state retention rather than host rollback.

## Independent verification

- Focused registration test rerun: 5 pass, 0 fail, 40 assertions.
- Completed combined log: 12 pass, 0 fail, 280 assertions across registration and installer-artifact tests.
- `git diff --check` on the eight frozen files: pass.
- No native installer command was executed by this review.

The implementation should remain frozen from native acceptance until M1–M3 are closed and independently rechecked. Native macOS/Windows/Linux runs are still required afterward; simulated host tests are orchestration evidence only.
