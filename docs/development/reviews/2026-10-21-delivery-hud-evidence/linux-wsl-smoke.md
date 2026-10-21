# Linux WSL release-candidate smoke

Verdict: PASS for the engine-only release-candidate smoke scope on native Linux processes inside WSL2. This is a separate operating-system run of the same frozen harness and installer previously tested on native Windows. It is not an executed GitHub-hosted Actions job.

## Frozen candidate inputs

The script, archive, `candidate.json` and `SHA256SUMS` were copied from the existing Windows Downloads test folder to the ext4 task directory `/home/woo/boxbox-ci-smoke-linux-yis1l9gu/candidate`, avoiding NTFS permission and path behavior during the Linux test.

- `boxbox-plugin-0.2.1.tgz`: SHA-256 `6fc35d7c92f6eeb1b442d6d21901ed6f27c06e9654f412750b4530b638b89b8f`.
- Unchanged `development/tools/release-smoke.mjs`: SHA-256 `2093988c272116b9dd3b615e524210baaf4ebf352d7a57264f4f96f4efe9f2d0`.
- Both hashes were checked after copying and again after execution. The frozen harness independently checked archive metadata, digest and checksum receipt before extracting or executing the installer.

## Supported isolated Linux toolchain

The pre-existing WSL Node 18 was not used. The official [Node 22.22.3 Linux x64 archive](https://nodejs.org/dist/v22.22.3/node-v22.22.3-linux-x64.tar.xz) and [official SHASUMS256.txt](https://nodejs.org/dist/v22.22.3/SHASUMS256.txt) were downloaded over HTTPS into the purpose-generated task folder. The archive digest `2e5d13569282d016861fae7c8f935e741693c269101a5bebcf761a5376d1f99f` matched its exact official checksum entry before extraction. The downloaded checksum file's SHA-256 was `b99296390cb403042da79c14d81e681076a9ac03af062d13f840dadc4ec751b3`; its raw contents are preserved in `linux-wsl-smoke-node-checksums.log`.

Only this test subprocess environment prepended the extracted toolchain's `bin` directory to PATH. Preflight verified the actual Node and npm paths, npm's resolved JS entry inside that same distribution, and a child Node found through PATH:

- Linux x64, kernel `6.6.87.2-microsoft-standard-WSL2`.
- Node v22.22.3 and npm 10.9.8 from the isolated official distribution.
- System `python3 --version`: Python 3.12.3, exit 0.

No source, HUD, workflow or CI files were modified. User PATH, host registration and trust settings were not changed.

## Exact harness run and observed checks

The unchanged script ran with the independently supplied digest in `CANDIDATE_SHA256` and `RUNNER_OS=Linux`:

```bash
/home/woo/boxbox-ci-smoke-linux-yis1l9gu/toolchain/node-v22.22.3-linux-x64/bin/node /home/woo/boxbox-ci-smoke-linux-yis1l9gu/candidate/release-smoke.mjs /home/woo/boxbox-ci-smoke-linux-yis1l9gu/candidate
```

The harness and SSH process exited 0. `smoke-Linux.json` reported `ok: true`, Node 22.22.3, Python 3.12.3 and all five check records:

- Isolated temporary profile/cache installation through `--engine-only` and the permanent Node launcher succeeded.
- Doctor reported runtime usability and standalone preset readiness while preserving `releaseReady: false`.
- TypeScript LF and CRLF examples passed preview preservation, approved apply, parser/approval checks, clean recheck and byte idempotence.
- Python LF and CRLF examples passed the same checks.

The harness removed its own temporary installation, project and cache in its finally cleanup. The purpose-generated ext4 task folder retains the frozen inputs, downloaded official toolchain, checksum file, receipt and harness report for reproduction.

## Evidence and limits

`linux-wsl-smoke.log` preserves complete remote stdout/stderr. `linux-wsl-smoke.json` is the exact report retrieved from the remote filesystem. `linux-wsl-smoke-receipt.json` records source paths, toolchain provenance, hashes, observed executables and exit status.

This proves the candidate's tested engine-only Linux WSL flow. It does not establish execution on a GitHub-hosted runner, registry publication, host registration, hook trust or native host hook-event acceptance. No unsupported runtime fallback was used.
