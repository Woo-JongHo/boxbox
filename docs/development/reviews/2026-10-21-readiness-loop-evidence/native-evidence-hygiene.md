# Native evidence hygiene audit

Date: 2026-10-22
Mode: read-only

## Verdict

**PASS. No file needs omission for a credential, OAuth login URL/code, or session secret.**

Scope: 27 files under `/tmp/boxbox-readiness/native-fixed-evidence.49pTP2` plus `/tmp/boxbox-readiness/native-final-report.md` (28 files total).

## Findings

- Private keys: 0
- GitHub, AWS, Slack, npm, JWT, authorization-header credential signatures: 0
- Password/client-secret/access-token/refresh-token assignments: 0
- Cookie headers: 0
- Email addresses: 0
- OAuth/authorization/device-login URLs: 0
- Device/user/verification/login code labels with values: 0
- URLs present: 2 occurrences, both ordinary `github.com` installation/source URLs with no credential-bearing query parameter or fragment.
- Long opaque-value review: hexadecimal values are recorded hashes; remaining long strings are hyphenated file/product identifiers. No opaque credential candidate remains.
- Machine-local paths occur in Windows raw output and the final report. They are execution-environment evidence, not credentials.
- `/tmp/boxbox-readiness/native-fixed-evidence.49pTP2/windows/install.txt` is UTF-16 raw machine output as expected; it is the only non-UTF-8 text and contains no credential/OAuth finding.

## Copy guidance

No hygiene-based omission is required. The main process may copy its explicit evidence allowlist and the final report. Continue excluding unrelated temporary scanner files and directories outside that allowlist.
