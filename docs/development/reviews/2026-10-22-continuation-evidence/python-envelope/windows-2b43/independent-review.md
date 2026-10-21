# Windows 2b43 native delivery: independent review

Date: 2026-10-22 KST

## Verdict

**PASS with explicit evidence limits.** The raw native outputs support the claimed archive binding, isolated install and doctor result, refusal of the unapproved Python assignment-value rule, successful and idempotent application of the two existing approved rules, and the 180-case Python behavior check. No mandatory correction was found.

This review inspected the mirrored native output files, status files, fixture hashes, harness source, transport logs, WSL/PowerShell archive bindings, and author report. It did not rely on the author report alone.

## Verified observations

- The expected archive SHA-256 is `2b43d24eabfdde00ae8019b204aabd2cc8d04f1604a8ffd540ec3170606649f0`. The WSL binding, native PowerShell pre-run hash, and native PowerShell post-run hash agree.
- Native install and doctor both exited `0`. Doctor reports `ok=true`, `runtimeUsable=true`, Node 24.12.0, Python 3.14.0, two approved convention records, standalone alignment, and absent isolated user/project configuration.
- The unknown Python fixture produced exactly `v1|python|-|table|name>equal>assignment-value`: Check exited `1` with `status=unknown` and incomplete approval proof; Guide exited `1` with empty conventions and guides; preview and apply exited `2` with `ALIGN_NOT_ELIGIBLE`.
- The unknown fixture SHA-256 remained `bcaa36507954fe1d1933c5e44dbb939bc7540f63377b985c4d38575cb8aa802b` after preview and apply refusal.
- Existing approved Python and TypeScript fixtures began misaligned, previewed and applied successfully, finished with complete approval proof and `misaligned=0`, and returned `boxboxChanged=false`, `written=false`, and `fixedPoint=true` on the second Align. Harness assertions compare the post-apply and second-Align hashes.
- Native Python reported `PASS 180/180` for the quote behavior matrix.
- The final successful invocation used a whole-script encoded command and `codex.cmd`. Searches of the harness and retained transport logs found no `Set-ExecutionPolicy`, execution-policy bypass, or security-setting mutation. Earlier attempts show launch/transport portability failures, including the unavailable `codex.exe`, rather than product execution failures.

## Limits

- The harness redirected `USERPROFILE`, `HOME`, `LOCALAPPDATA`, `APPDATA`, `CODEX_HOME`, and the npm cache to a unique temporary root. Its commands do not target the live profile, trust settings, hooks, HUD configuration, or the earlier c18 candidate. There is no independent before/after snapshot of those external locations, so their non-mutation is supported by command scope rather than a complete host-state diff.
- This delivery verifies the native packaged engine. It does not test native hook delivery, HUD behavior, host event acceptance, CI artifact identity, publication, or approval of the new Python rule.
- The 180-case run checks the retained quote function behavior. It is not a universal Python semantic proof.

## Durable evidence

The sibling files preserve the minimal raw outputs used for this decision. `manifest.sha256` binds those files.
