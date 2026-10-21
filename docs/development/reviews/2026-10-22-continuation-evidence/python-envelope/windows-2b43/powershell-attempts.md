# PowerShell attempt audit

The retained attempt history was inspected in `/tmp/boxbox-readiness/ssh-2b43-run*.log` together with the final harness source.

- Attempt 1: direct `.ps1` execution was rejected by the existing host execution policy before the harness ran.
- Attempt 2: stdin execution was interactive and did not provide the required whole-script fail-fast behavior.
- Attempts 3–4: transport/path corrections; the retained error identifies unavailable `codex.exe`.
- Attempt 5: successful whole-script encoded-command invocation using `codex.cmd`.

No retained command or harness line uses `Set-ExecutionPolicy`, an execution-policy bypass option, or a security-setting mutation. Encoded-command transports the whole script; it does not itself alter execution policy.
