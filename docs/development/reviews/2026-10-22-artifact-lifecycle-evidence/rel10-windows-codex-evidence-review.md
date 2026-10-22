# REL10 native Windows Codex lifecycle — independent evidence review

Date: 2026-10-22 KST  
Verdict: **PASS**  
Mandatory findings: **0**

## Scope and method

This review read the terminal evidence in `/tmp/boxbox-readiness/rel10-windows-codex-pass/`, the author report, the native PowerShell runner, the transferred-harness digest record, and the retained transport and schema-failure records. It did not rerun the lifecycle, modify the remote machine, or independently rehash the live remote workspace.

The compact terminal evidence is internally complete: `lifecycle.json` is 291,774 bytes with SHA-256 `c7dbe0939734526a61254783ae843a2f3ef691e321257855f4986bb34f63fea8`; `summary.json` has SHA-256 `543e249bbfafa4cc39a1dce9fbe085701e2f79f0e89a5b3e147208e54636cf8d`. Every command references a present bounded stdout/stderr log.

## Binding and execution

- The terminal record reports native `win32` x64, Node `v24.12.0`, npm `11.6.2`, and `codex-cli 0.157.1`.
- The interval from `2026-10-21T17:28:29.484Z` to `17:29:23.538Z` is 54,054 ms.
- It contains 110 commands: 107 ordinary passes and three deliberately observed nonzero outcomes (cold-cache `ENOTCACHED`, direct-upgrade marketplace collision, and direct-rollback marketplace collision). No command is failed or left running.
- The runner binds the previous archive to `f07df7ada9aa234c2935ed500b4fe15b1a5d53f7b7a6de7d8ec107f53c8f572c`, the current archive to `bec626435e525c2d7324d156f85d2c114427d875725abcecb42fed561b2b92be`, and invokes native `node.exe` through PowerShell `Start-Process`.
- The transferred corrected harness is recorded as `292b730c122612479e39d0745623d8095ea066b1c2129c71d30e0a1f8bfa5d30`. The transfer record and terminal lifecycle agree. This review did not independently rehash the remote harness source, so it treats that as a recorded transfer binding rather than a new live-host digest measurement.
- The previous archive is explicitly labeled a historical uncommitted 0.2.3 candidate fixture, not an approved or published release. The current archive is the unpublished 0.2.4 CI candidate from frozen source `35b6178`.

## Strict Codex identity and Windows paths

The terminal evidence proves the measured Codex 0.157.1 schema without weakening identity checks:

- The plugin record identifies `boxbox@boxbox-plugins`, the exact version, enabled state, and a normal drive-letter plugin source rooted under the expected version directory.
- The plugin marketplace source is local and uses a Windows extended-drive path (`\\?\C:\...`).
- The marketplace-list record uses the real legacy shape `{ name, root }`; it has no nested `marketplaceSource` field. Its `root` still resolves to the exact expected installation root.
- The corrected verifier accepts those measured representations while retaining exact version, manifest/runtime, provenance, containment, and root assertions.

The retained `win-codex-02` cell stopped after 14 commands because the earlier verifier additionally required the absent nested marketplace source. Its exact assertion was `Host JSON lacks an expected source path`. The captured plugin and marketplace records were mutually consistent, so this is correctly classified as verifier/schema incompatibility rather than a BoxBox installation-path failure. That failed cell was preserved separately and was not reused by the terminal run.

## Lifecycle result

The terminal record supports all bounded lifecycle claims:

1. Initial plugin and marketplace lists were empty.
2. Fresh exact 0.2.3 install produced the expected version/root identity, engine version and doctor result. The approved TypeScript journey demonstrated a finding, dry-run byte preservation, apply, clean recheck, and second-apply fixed point.
3. A fresh-cache dependency-offline 0.2.4 attempt failed with npm `ENOTCACHED` before replacement. The 0.2.3 registration, root, retained files, and engine journey remained valid.
4. Warm-cache offline 0.2.3 repair succeeded without changing the active version/root.
5. Direct 0.2.4 transition produced the expected different-source marketplace collision. The old registration and engine remained usable, followed by exact documented plugin/marketplace removal and fresh 0.2.4 install.
6. The 0.2.4 install and warm offline repair retained exact current identity and the approved engine fixed point.
7. Direct rollback likewise collided without replacing 0.2.4; exact removal followed by fresh 0.2.3 installation completed the manual rollback.
8. Final exact plugin and marketplace removals succeeded and both final host lists were empty.

There are 12 archive digest gates and 21 preservation checks over nine retained user/project files. The lifecycle repeatedly reports matching bytes through the failure, repair, transition, rollback, and final-removal boundaries. Both permanent version directories remain as intentional residue: 0.2.3 with 608 inventory entries and 0.2.4 with 609. This is registration removal, not a filesystem uninstaller claim.

## Earlier transport failure

The first retained Windows cell stopped at the eighth command, `codex plugin remove --help`, while a WSL-to-Windows interop bridge remained asleep after the apparent native child disappeared. No installer or engine lifecycle action had begun. A later isolated native PowerShell probe returned the same CLI help in about 83 ms, and the terminal lifecycle completed through direct native `Start-Process` transport.

This supports classification of the original event as a WSL/cmd interop transport failure. It does **not** establish an engine timeout root cause or an engine timeout fix: the stuck command was host CLI help, the BoxBox engine was not running, and the successful cell changed transport.

## Limits

- No authentication, model invocation, live profile, hook/trust acceptance, HUD, or interactive UI behavior was exercised.
- Dependency-offline npm behavior was tested; this is not a whole-OS network-denial claim.
- The compact copied evidence permits independent structural/log review, but not a fresh live-host rehash of the remote workspace, preserved files, or remote harness.
- The evidence supports this isolated native Windows Codex lifecycle only; it does not convert the historical fixture into a release or the current candidate into a published artifact.
