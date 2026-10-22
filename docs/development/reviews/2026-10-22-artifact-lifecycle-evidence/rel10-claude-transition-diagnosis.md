# REL10 Claude transition diagnosis and minimal repair proposal

Status: **read-only diagnosis; implementation and native update remain unexecuted**. Only scratch evidence was written. No live profile, authentication, model request, hook trust, product source, host registration or failed lifecycle state was changed.

## Measured defect

The exact 0.2.4 installer (`bec626435e…`) returned exit 0 when directly upgrading the existing 0.2.3 fixture in the isolated macOS Claude 2.1.286 cell. The harness correctly failed on the subsequent listed plugin version mismatch; weakening that assertion would hide a real identity inconsistency.

Evidence under `/tmp/boxbox-readiness/rel10-macos-claude-1/`:

- `043.stdout.log`: marketplace add explicitly repoints `boxbox-plugins` from permanent 0.2.3 to permanent 0.2.4. Plugin install then says the plugin is already installed at user scope; it describes local in-place loading and explicitly suggests `claude plugin update boxbox@boxbox-plugins` to re-record version 0.2.3 → 0.2.4. The installer nevertheless prints its generic installed-success message and exits 0.
- `044.stdout.log`: real `plugin list --json` still records version `0.2.3` and `.../plugins/cache/boxbox-plugins/boxbox/0.2.3`.
- `045.stdout.log`: real marketplace list records the new permanent 0.2.4 directory as source/path/installLocation.
- `lifecycle.json`: fresh previous install, cold-cache dependency failure with prior-state preservation, and warm-cache previous repair passed; direct-upgrade acceptance failed before current-version engine assertions.

Read-only filesystem inspection confirms that the listed old cache is a real directory, **not a symlink** to the new plugin. Its actual manifest says 0.2.3 and its `runtime.json` points at the permanent 0.2.3 engine. The permanent new plugin has manifest/runtime 0.2.4. All existing project/approval/user preservation hashes still match.

**Do not overstate this finding:** Claude's command says a directory marketplace loads the new source in place at next session/reload. We did not start a host model session or exercise that loader. The measured defect is inconsistent recorded version/cache versus the current marketplace source, and the installer's unverified success claim. It is not proof that every future session executes only old code.

Raw inspection, help and reduced lifecycle evidence: `/tmp/boxbox-readiness/rel10-claude-transition-inspection.json`. Source/log hashes and preservation confirmation: `/tmp/boxbox-readiness/rel10-claude-transition-hashes.json`.

## Cause in current source

`product/installer/install.mjs:87–90` calls marketplace add and plugin install, treating their zero exits as completion. It never lists the resulting identity/version/source and never invokes Claude's explicit plugin update operation when install is a no-op.

`product/installer/entry.mjs:32–56` separately treats every nonzero child result as a pre-registration failure: it removes the destination and restores any same-version backup. Adding a post-registration update/verification failure without changing this contract could leave a real host registration pointing at a deleted directory. That would be a new defect, not a safe fix.

## Smallest recommended change

Keep the product's host-adapter boundary and its documented manual Codex migration. Limit new host identity/update behavior to Claude, plus a narrowly shared installation-phase handshake needed to avoid deleting registered files.

### Claude preflight and identity completion

1. Before any host mutation, obtain real Claude plugin and marketplace JSON. Verify JSON listing and scoped update support from the selected CLI's help. macOS 2.1.286 `plugin update --help` was measured with the failed cell's isolated environment and supports `--scope`; Windows/Linux 2.1.280 remains a required native compatibility check, not an assumed pass.
2. Reject duplicate target identities, ambiguous scopes and a foreign/shared marketplace before overwriting its source. An existing BoxBox marketplace is accepted only when it is a local directory at the exact target root or a verified previous BoxBox version under the same permanent host/version parent. Verification binds real paths, bundle name/host/marketplace/version, and plugin manifest identity; a matching marketplace name alone is insufficient. If ownership cannot be established, fail with the documented explicit migration guidance. Do not silently update a remote or unrelated source.
3. Register the exact local marketplace and install exact `boxbox@boxbox-plugins` at `--scope user` as today. Re-list the marketplace and require its real source/path/installLocation to match the intended permanent root before any update command.
4. Re-list the plugin. Require exactly one target user-scope record. If its recorded version differs, invoke only `claude plugin update boxbox@boxbox-plugins --scope user`, then re-list. Do not parse human install output to decide success, update all plugins, select an unqualified name, or auto-remove unrelated records.
5. Require target identity, user scope, intended version and usable registered root. Check the registered manifest version and `runtime.json` CLI path against the intended permanent installation, and execute the resolved permanent engine `--version`. A zero exit plus stale recorded version remains failure. If Claude intentionally leaves an old cache while loading in-place, retain that evidence and resolve the explicit contract rather than silently relaxing the gate.
6. Print installation success only after these checks. A fresh/same-version correct registration needs no unnecessary update command.

An isolated, explicitly authorized `plugin update` probe on the retained failed cell should be captured before finalizing assertions about how update changes its cache/installPath. This diagnosis intentionally performed only `plugin update --help`; it does not claim the update operation has already repaired the cell.

### Safe partial-registration handshake

Prefer a parent-created structured phase receipt over a magic child exit code. Host commands may use arbitrary nonzero codes, and abrupt termination may not run a child catch block.

- `entry.installHost` creates a fresh owned transaction directory beside the version directories and a private JSON receipt before spawning the copied installer. Bind schema version, random transaction ID, exact destination real path, package name/version and host. Initial phase is `prepared`. Pass only this transaction's receipt path/ID to the child through an internal environment variable; do not trust an inherited external receipt path.
- The child validates those bindings, then atomically records `host-registration-started` **before the first host mutation**. It records `verified` only after all intended registration checks finish (or after successful engine-only completion, which has no registration mutation).
- On child failure with a valid `prepared` receipt, retain the current pre-registration failure behavior: restore the previous same-version backup or remove a fresh partial destination. This preserves existing dependency-install failure safety.
- On failure/signal after `host-registration-started`, or on missing/malformed/mismatched phase evidence where pre-mutation failure cannot be established, retain the destination, receipt and any prior backup. Return failure with exact retained paths and a partial-state/recovery message. Do not claim host rollback or restore/delete files underneath a possibly changed host registration.
- A zero child exit without a valid `verified` receipt is not verified installation success. Successful completion can clean its own backup/receipt with existing cleanup-failure reporting. Never delete another transaction directory or automatically undo global host state.

This handshake is intentionally not a global installer transaction. It identifies when filesystem rollback is safe and preserves recovery material when host mutation may already have happened. A failed cross-host batch may leave an earlier host successfully installed; report that accurately as today. HUD setup remains outside this core change.

## Required regression and native proof

Focused source/artifact tests should distinguish these cases:

- Fresh Claude install and already-correct same-version repair verify without update.
- Install returns zero with old listed version: one exact scoped update is issued; new identity/path/engine are required afterward.
- Update returns zero but the listed version/root/runtime remains wrong: fail, no success message.
- Duplicate record, another scope, foreign remote/local marketplace, shared marketplace and malformed list output: fail before update/mutation as applicable.
- **Fail after marketplace registration:** host points at the new root, update or final check fails; destination and same-version backup remain byte-accessible, sentinel data is retained, receipt is bound to the failing transaction, and the installer returns a partial-state failure. This must not merely assert a log message.
- **Fail before registration:** dependency install fails; existing destination and its extra user file are restored exactly as before. A forged/foreign/mismatched receipt must not authorize destructive cleanup.
- A real new exact installer candidate must repeat the complete macOS/Windows/Linux host cells after review, including the supported Claude 2.1.280 surface. Historical 0.2.3 rollback uses its frozen old installer and cannot acquire the new behavior retroactively; if that old installer returns stale metadata, use and document the explicit host removal/reinstall recovery rather than rewriting its artifact or declaring its direct transition successful.

Expected implementation surface, subject to parent ownership approval: `product/installer/install.mjs`, `product/installer/entry.mjs`, narrowly necessary installer tests, and a shared helper/build-copy entry only if the phase/identity logic warrants it. Installer README may need a precise retained-partial-state explanation after behavior is implemented; no documentation or runtime source was edited in this diagnosis.
