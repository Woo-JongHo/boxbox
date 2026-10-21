```text
VERDICT: PASS
MANDATORY_FINDINGS:
- None.
NONBLOCKING:
- Compact output (`status.mjs:161`) reads "session receipt: <state>, Ns ago | file not run | host unverified". It names the receipt as an observation and always says the file check was not run and the host is unverified. A receipt PASS is therefore never shown as a session PASS. In project-history scope it reads "project history (not current session)", and a stale receipt is prefixed "historical".
- With more than 256 entries (`status.mjs:79-98`), only receipts named `<13-digit-ms>-<uuid>.json` are kept, and only the newest 256 by name are read. Other `.json` files are silently ignored once the 256 threshold is crossed. If the directory has no files in the generated format, the check fails closed.
- Selection is by filename, not by the `at` field. A selected receipt that is invalid or conflicts on timestamp throws, and the result is state "unknown" (`status.mjs:99-111`). The directory is still enumerated in full, and each entry past 256 re-sorts the list, so cost is quadratic in entries. Memory stays bounded.
- Codex launcher (`setup.mjs:48-49`): any content other than the exact owned content throws before the disable or write branch, so a user-edited launcher can't be overwritten or deleted. Exact content is removed, and a missing file returns success, so disable is idempotent. Two small gaps: a changed `pluginRoot` makes the old launcher look foreign and refuses disable, and the delete isn't atomic with the read (`rmSync` at line 49). The enable write passes no `expected` argument (line 50), so a concurrent change isn't caught. Both are narrow races.
- Claude disable (`setup.mjs:62-72`): a removed `statusLine` clears the state file if its `settingsPath` matches and returns success. A foreign `statusLine` throws and changes nothing. An owned one is deleted using the `source` check, and the state file is then removed. Enable also works with a stale state file when `statusLine` is absent.
- tmux: `codex.mjs:138-140` passes `process.execPath` and its arguments as separate argv entries to `new-session` and `split-window`, with no shell string. `tmuxArgument` (line 82) handles trailing semicolons. Your local 3.6b evidence matches this usage, and without a documented affected minimum version I see no current-code fix to require. A version gate would be speculative.
EVIDENCE_LIMITS:
- Read-only static review of `status.mjs`, `setup.mjs` and the relevant parts of `codex.mjs`. I did not read the three test files, and I did not run the suite or the syntax checks. The 21 pass, 0 fail result is your report, not something I confirmed.
- Nothing here shows current native Codex or Claude acceptance. The code correctly reports host acceptance as unverified.
- tmux behavior beyond 3.6b is unverified.
</parameter>
</invoke>
```
