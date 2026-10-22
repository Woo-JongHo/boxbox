# Windows Codex retained-path canonicalization probe

Native Node `v24.12.0` read the retained `win-codex-02` plugin and marketplace JSON without modifying the cell.

- `marketplace.root` is a normal `C:\...\0.2.3` path. `realpathSync` succeeds and returns the same normal path.
- `plugin.marketplaceSource.source` names the same location with the Windows extended prefix `\\?\C:\...\0.2.3`.
- Node `realpathSync` on that extended form fails with `EISDIR`, syscall `lstat`, reported path `C:`.
- Removing only the exact leading `\\?\` prefix and then applying `realpathSync` succeeds; its case-folded result exactly equals the marketplace-root result.

Therefore accepting the legacy marketplace schema alone is insufficient: the strict path comparator must canonicalize the Windows extended prefix before `realpathSync`, while still requiring the canonical path to equal the independently reported marketplace root and expected installation root. No root check should be removed.

Evidence:

- `/tmp/boxbox-readiness/rel10-windows-realpath-proof.json` — first probe preserving the direct extended-path failure.
- `/tmp/boxbox-readiness/rel10-windows-realpath-proof-v2.json` — captured normal, extended failure, stripped result, and equality.
- Probe v2 SHA-256: `d5c3512ceb55cf6fa8f241e4b108570057ec55ab116d1a15977cf2aede4f6adf`.
- Proof v2 SHA-256: `d398edf173f39f196d7235bbd1a6e688fe4fcb1157270493999f805a9c20332d`.

Prepared but not executed corrected-cell transport wrapper:

- `/tmp/boxbox-readiness/rel10-windows-native-cell-runner.ps1`
- It gates harness and both archive hashes, requires a new output name, uses native `Start-Process node.exe`, redirects bounded console files, waits up to 20 minutes by default, records PID/status/exit, and leaves a timeout process for explicit inspection rather than automatic cleanup.
