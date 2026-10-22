# Independent review — REL10 exact-artifact lifecycle plan

Date: 2026-10-22 KST
Mode: read-only review before native installation; no repository edits or native installs.

## Verdict

**ITERATE — two mandatory plan corrections before native execution.** The proposal has sound artifact binding, isolation, host/OS separation, preservation and residue boundaries. It does not yet execute the actual update transition required by REL10, and it omits REL10's explicit offline/error acceptance.

## Mandatory finding 1 — the sequence removes registration before “update”

The proposal currently says to install 0.2.3, then “unregister the old adapter and its exclusive marketplace” before installing 0.2.4. That is remove → fresh install, not an update. It cannot prove that the current installer/plugin manager safely replaces or repairs an existing older installation, preserves the host registration/configuration through the transition, or handles the old permanent version directory according to product ownership.

Revise the matrix to include a true in-place transition for each real host/OS cell:

1. install/register exact `f07df7…` 0.2.3;
2. seed and hash user/project-owned settings, approval/config data and unrelated files;
3. invoke the exact `bec626…` 0.2.4 installer **without first unregistering the old plugin/marketplace**;
4. assert the registered version/root is 0.2.4, the expected marketplace identity is unique, old registration is absent or migrated as documented, user-owned bytes survive, and doctor plus approved/refusal journeys pass;
5. perform the reverse in-place transition to exact 0.2.3 for rollback, then update to 0.2.4 again; and
6. only after those transitions, exercise explicit host unregister/removal and inventory residue.

If a host CLI does not support in-place replacement, record that measured limitation and require the product's documented update procedure. Do not label an unregister/reinstall workaround as update or rollback.

## Mandatory finding 2 — offline and error acceptance is missing

The canonical REL10 verification contract explicitly calls for “OS/Node/host E2E, update migration, residue, offline and error tests.” The proposal binds local archives but does not require network denial/cache isolation during lifecycle execution, nor does it define a controlled failure and post-failure state.

Add startable criteria per supported host/OS cell:

- run the archive lifecycle with a fresh isolated npm cache and network unavailable or explicitly denied after prerequisites are bootstrapped; record whether every required runtime dependency is already inside the artifact;
- induce one bounded transition failure at a deterministic product-owned boundary, such as invalid archive digest/package identity or a controlled host registration failure before commit;
- assert the prior registered version and user-owned data remain usable/unchanged after failure, no mixed-version active registration is left, temporary/backup residue is inventoried, and a subsequent valid update succeeds; and
- distinguish a host CLI rejection or HUD setup failure from an engine/installer failure. Do not delete residue to manufacture a pass.

A naturally occurring failure is not required; use a safe deterministic precondition/fault path already supported by the verifier or installer. No live profiles, authentication, model calls or trust changes are needed.

## Requirements correctly preserved

- Exact archives and SHA-256 identities are fixed; 0.2.3 is honestly labeled a retained uncommitted preview rather than a released baseline.
- macOS, native Windows and WSL2/Linux evidence remain distinct. WSL is not represented as hosted Linux or native Windows.
- Both real host CLIs are required; engine-only or fake-host substitution is rejected.
- The harness owns verification and evidence, not an automatic filesystem uninstaller.
- Host plugin/marketplace removal is separated from permanent version-directory residue. Manual harness deletion cannot count as product removal.
- User settings, project config, approval data, fixtures and unrelated files have explicit preservation requirements.
- HUD handoff is limited to supported macOS/Linux adapters; Windows HUD stays unsupported.
- Partial plugin installation and later HUD failure must remain distinct.
- No authentication, model call, credential copy, persistent trust, public approval, licensing or publication claim is introduced.
- Local `2b43` native evidence is not transferred to the byte-distinct CI archive.

## Recommended acceptance table before execution

Define one row for each `(OS, host)` cell: macOS×Codex, macOS×Claude, native-Windows×Codex, native-Windows×Claude, WSL2-Linux×Codex and WSL2-Linux×Claude. For each row record:

- native CLI/version and Node 22.22.3 prerequisite;
- old/new archive digest verification;
- fresh install result and registered root/version;
- seeded user/project ownership hashes;
- in-place update result;
- controlled failed-update result and retained active version;
- rollback result;
- second update result;
- doctor plus approved/refusal journeys after each successful transition;
- exact plugin and exclusive-marketplace removal result;
- permanent-directory and unrelated-file residue; and
- HUD handoff result or `unsupported` with reason.

Cells blocked by actual host availability stay open. Authentication-dependent interactive/hook work is outside this table.

## Non-mandatory clarity

The proposal says the “lifecycle verifier owns no automatic filesystem uninstaller” through its residue boundary, but it would be clearer to state this exact sentence directly in the ownership section. Also name the expected evidence schema/file per cell before execution so partial results cannot be summarized as a matrix pass.

## Scope conclusion

No other backlog should be added to REL10. After the two mandatory corrections, the plan is bounded and startable with the stated macOS/native-Windows/WSL2 prerequisites. The concurrent harness/test authoring can continue, but native lifecycle execution should wait until true in-place update/rollback and offline/error assertions are represented in the harness contract.
