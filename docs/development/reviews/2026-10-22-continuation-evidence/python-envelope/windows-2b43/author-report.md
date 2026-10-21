# BoxBox 2b43 native Windows verification

Date: 2026-10-22 KST

## Candidate and delivery

- Classification: isolated local development candidate; not a CI artifact and not a public release.
- Archive SHA-256: `2b43d24eabfdde00ae8019b204aabd2cc8d04f1604a8ffd540ec3170606649f0`.
- Runtime/test source was committed as `1152779`; the archive was built from the same frozen worktree before that commit.
- Scoped final GLM static audit: PASS, zero mandatory findings. GLM did not execute tests.
- Remote directory: `C:\Users\woo\Downloads\BoxBox\0.2.4\python-native-2b43d24e-20261022T0115KST`.
- Free-space preflight: 620,985,880 KiB available on C:. The final remote candidate/evidence directory is 348 KiB; the retained isolated temp runtime is separate.
- WSL `sha256sum` and native PowerShell `Get-FileHash` both matched the expected digest before native verification. The harness rechecked the same digest after verification.

The new directory was required to be absent before creation, preserving the earlier c18 candidate. `README.txt` records the development-only classification, exact digest, build/source relationship, initial audit-pending state, dated audit PASS update, and continuing unapproved-rule boundary.

## Native isolated environment

Successful run root:

`C:\Users\woo\AppData\Local\Temp\boxbox-python-2b43-75af872a09694305813e176575458e51`

The harness used process-scoped `USERPROFILE`, `HOME`, `LOCALAPPDATA`, `APPDATA`, `CODEX_HOME`, and npm cache paths. It installed only the exact local archive for Codex. No hook/HUD trust was requested or granted, and no live profile or prior candidate was changed.

Measured native tools:

- Node 24.12.0
- Python 3.14.0
- native Codex command present and installer completed

## Results

**PASS** — the harness terminal result was:

`PASS exact 2b43 archive; doctor; unknown refusal/invariance; approved TS/Python; behavior 180/180`

- Install status 0.
- Doctor status 0 with `ok=true`, `runtimeUsable=true`, embedded base/recommended fingerprints, two approved convention records, isolated user/project config absent, and standalone alignment.
- Unknown Python Check status 1 detected exactly one three-row group with axes `name>equal>assignment-value`; approval fact was `unknown`, proof incomplete, `no matching convention`.
- Unknown Guide status 1 returned `ok=false` and no conventions/guides.
- Unknown Align preview and apply both returned status 2 with `ALIGN_NOT_ELIGIBLE`. The harness asserted the file hash unchanged after each command. Its final hash is `bcaa36507954fe1d1933c5e44dbb939bc7540f63377b985c4d38575cb8aa802b`, equal to the canonical initial fixture hash.
- Approved Python and TypeScript initial Checks returned diagnostic status 1; preview/apply/final Check/second Align all returned 0.
- Final Python proof was `py-simple-assignments`, complete, `misaligned=0`; final TypeScript proof was `ts-sourcefile-call-declarations`, complete, `misaligned=0`.
- The harness compared post-apply and post-second-Align hashes for each approved fixture and passed byte-idempotence.
- Native Python independently executed all 180 input combinations for the retained quote implementation: `PASS 180/180`.

The new assignment-value rule remains unapproved. Detection does not imply formatting approval.

## Attempt history

The successful product run was attempt 5. Earlier transport/harness-launch attempts are preserved rather than hidden:

1. Direct `.ps1` launch was refused by the host execution policy before the harness ran.
2. `powershell -Command -` consumed standard input interactively and did not provide whole-script fail-fast semantics; its partial scratch evidence was retained separately.
3. The first whole-script encoded-command attempt used `codex.exe`, while this host exposes `codex.cmd`; it stopped before install.
4. The final whole-script invocation used `codex.cmd`, made no execution-policy change or bypass request, and passed.

These were harness portability corrections, not product failures. Failed runs used uniquely named disposable temp roots and did not modify live profiles.

## Evidence

- Safe local mirror: `/tmp/boxbox-readiness/windows-2b43-remote-evidence/windows-evidence`
- Remote binding: `/tmp/boxbox-readiness/windows-2b43-remote-binding.txt`
- Exit status summary: `/tmp/boxbox-readiness/windows-2b43-status-summary.txt`
- Final fixture hashes: `/tmp/boxbox-readiness/windows-2b43-final-fixture-hashes.json`
- Selected JSON/refusal outputs: `/tmp/boxbox-readiness/windows-2b43-key-results.txt`
- Remote README mirror: `/tmp/boxbox-readiness/windows-2b43-remote-readme.txt`
- Successful terminal transport log: `/tmp/boxbox-readiness/ssh-2b43-run-attempt5.log`

This evidence verifies the native packaged engine only. It does not claim Windows HUD support, hook delivery, host acceptance, CI artifact identity, publication, or approval of the new rule.
