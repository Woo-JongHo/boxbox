# Native Windows release-candidate smoke

Verdict: PASS for the engine-only release-candidate smoke scope. This is an actual native Windows execution on `ssh chacada`, not WSL Node and not a simulated platform. No product, source, HUD, workflow or CI files were edited for this verification.

## Exact frozen inputs

- Installer archive: `boxbox-plugin-0.2.1.tgz`, 126110 bytes.
- Archive SHA-256: `6fc35d7c92f6eeb1b442d6d21901ed6f27c06e9654f412750b4530b638b89b8f`.
- Frozen `development/tools/release-smoke.mjs` SHA-256: `2093988c272116b9dd3b615e524210baaf4ebf352d7a57264f4f96f4efe9f2d0`.
- `candidate.json` and `SHA256SUMS` were copied with the archive and script, using tar streamed over SSH. The harness verified metadata, expected byte count, digest and checksum receipt before extraction or execution. Both script and archive were checked unchanged locally after execution; the native preflight confirmed matching remote hashes.
- Purpose-named remote folder: `C:\Users\woo\Downloads\BoxBox\ci-smoke-20261021T031802Z`.

## Native environment and invocation

The SSH login shell is WSL, but it invoked Windows PowerShell and then the native `C:\Program Files\nodejs\node.exe`. Native preflight measured `process.platform === "win32"`, x64, Node v24.12.0.

The unchanged harness ran with `CANDIDATE_SHA256` set to the independently supplied archive digest and `RUNNER_OS=Windows`:

```powershell
& 'C:\Program Files\nodejs\node.exe' './release-smoke.mjs' 'C:\Users\woo\Downloads\BoxBox\ci-smoke-20261021T031802Z'
```

`python3 --version` resolved successfully with exit 0 and `Python 3.14.0`. `where.exe python3` identified `C:\Users\woo\.local\bin\python3.exe` first and the WindowsApps alias second. Thus the harness's exact `python3` command worked on this native Windows environment without a script change or PATH modification. This observation does not establish the Python alias on every Windows machine or count as an executed GitHub-hosted workflow job.

## Observed checks

The frozen harness completed with native exit code 0 and `smoke-Windows.json` reported `ok: true`:

- Temporary profile/cache installation through `--engine-only` and the permanent Node launcher succeeded.
- Doctor reported a usable runtime and standalone preset readiness, while preserving `releaseReady: false`.
- TypeScript call declarations passed preview preservation, approved apply, parser/approval safety checks, zero-misalignment recheck, and byte idempotence for LF and CRLF.
- Python indented assignments passed the same checks for LF and CRLF.
- The test workspace and its isolated installation/cache were removed by the unchanged harness's cleanup. The transferred candidate inputs and smoke report remain in the purpose-named Downloads folder.

## Evidence and limitations

`windows-smoke.log` preserves combined native stdout/stderr, including PowerShell's machine progress output; `windows-smoke.json` is the exact harness report retrieved from the Windows filesystem; `windows-smoke-receipt.json` records remote paths, all input hashes, exit status and unchanged-input checks.

Host discovery/registration, user hook trust and native host hook-event delivery were not exercised. The smoke intentionally used `--engine-only` and did not register a host or alter user PATH/trust configuration. It is a candidate verification result, not a registry publication or full host acceptance claim.
