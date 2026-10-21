# Independent review — REL10 HUD current-candidate digest binding

Date: 2026-10-22  
Mode: read-only bounded source/design review. No HUD setup, lifecycle mutation, host, model, hook, trust, tmux, UI, installer, or native command was run.

Reviewed:

- `/tmp/boxbox-readiness/rel10-hud-current-digest-design.md`
- current `development/tools/release-hud-lifecycle.mjs`
- current `test/release-hud-lifecycle.test.ts`
- pre-change copies and `SHA256SUMS` under `/tmp/boxbox-readiness/rel10-hud-pre-current-digest/`
- `/tmp/boxbox-readiness/rel10-hud-harness-hashes.txt`

## Verdict

**PASS — mandatory findings: 0.**

The follow-up is minimal and preserves the previously audited HUD verifier behavior. It adds one optional exact current-archive digest binding for a future unpublished 0.2.4 candidate, keeps the old successful candidate as the default, and does not infer CI or source/build provenance.

## Source identity and diff scope

Independent hashes match the frozen manifest:

- harness: `73da0018b1761b18c271fe50cc18ab87b2daf8bd086d1c6e606794968a5059e0`;
- test: `7441b2eb4d6d217170ce4b86576f7829a062baf32347928d5f84ce8da100ef55`.

The preserved pre-change copies independently hash to:

- harness: `c6baf652055571c7871638acf8fe8e23d22e3cdedf8b01a628e53b7364a430d2`;
- test: `be240f00e63d5e7d8bd46982f578ed5e59b0b26e09ab53c6e697e5a2e29c8fdd`.

The source diff is limited to:

- optional argument parsing and validation;
- selecting the expected current archive digest;
- returning the selected artifact binding from core validation;
- recording archive digests and bounded provenance in the output report;
- focused tests for those behaviors.

Inventory, ownership diagnostics, path/symlink gates, setup binding, lifecycle commands and preservation logic are unchanged.

## Default behavior

Without `--current-sha256`, `expectedHudArtifact("current")` returns the existing frozen `HUD_ARTIFACTS.current` record. The core report must still contain:

- version exactly `0.2.4`;
- current archive digest exactly `bec626435e525c2d7324d156f85d2c114427d875725abcecb42fed561b2b92be`;
- the same single present current residue root.

The installed current HUD setup remains independently bound later by `validateBinding` to setup digest `e888c90357f6165d553fd5e095206a83f4b7bd442b563d7a9f4f3631f0ac927d`. Therefore the old successful macOS Codex source/report contract remains valid by default; the follow-up does not reinterpret or rewrite that evidence.

The default output provenance text says only “Pinned default unpublished 0.2.4 HUD candidate.” It does not newly label the artifact as CI-produced.

## Explicit override behavior

With `--current-sha256 <digest>`:

- parsing accepts the flag once only;
- the value must match exactly `^[a-f0-9]{64}$`, rejecting uppercase, short and malformed values;
- core validation requires `artifacts.current.sha256` to equal the supplied digest;
- current version remains exactly `0.2.4`;
- previous archive/version binding remains pinned and unchanged;
- current installed setup digest remains the same strict `e888c903…` value;
- residue identity, workspace containment and all existing lifecycle prerequisites remain unchanged.

A caller cannot use the option to accept a mismatched core report, a different product version, or a changed HUD setup script. The override binds the digest asserted and repeatedly checked by the successful core lifecycle report; this HUD verifier still does not receive or rehash the archive bytes itself.

The selected binding is recorded in `report.bindings.current.archiveSha256`, while its provenance is explicitly:

“Explicit caller-bound unpublished 0.2.4 candidate; source/build provenance must be recorded separately.”

That wording correctly avoids CI, clean-source, commit, release or publication claims. A future native run must retain separate evidence proving where the candidate digest came from.

## Test assessment

The recorded focused result is 9 passes, 0 failures and 51 assertions. The added assertions cover:

- unchanged default parsing;
- valid optional digest parsing;
- preservation of version and setup digest under an override;
- absence of “CI” from override provenance;
- malformed/uppercase-short digest rejection;
- duplicate option rejection;
- matching replacement digest acceptance;
- default-versus-override mismatch refusal.

These are meaningful source-level checks for the bounded change. They do not claim native HUD behavior. No additional native run is needed to approve this verifier change itself; a future candidate lifecycle remains a separate execution/evidence task.

## Evidence limits

This review does not establish that any future archive digest corresponds to a clean build, a commit, CI output, or publishable artifact. It does not execute a new core or HUD lifecycle and does not extend the prior macOS Codex configuration pass to another candidate. It approves only the strict optional binding mechanism and its preserved default behavior.
