# Shared product HUD collector and renderer

Implementation owner: `/root/hud_status_impl`. Only `product/hud/status.mjs` and `test/product-hud.test.ts` were authored by this worker. Other concurrent repository changes were preserved. No package generation, installation, commit, host trust, host configuration or publication was performed.

## Contract

- `collectStatus({pluginRoot, root=process.cwd(), host="codex", sessionId, pluginData, run=spawnSync})` returns schema 1 state. Plugin presence is `installed`, while enablement and hook trust remain `unknown`.
- `pluginRoot/runtime.json` is the sole engine source. Absolute regular Node and CLI paths are required. The installed engine doctor is invoked with a 5-second timeout, 256-KiB maximum output and the explicit project working directory. An unavailable, malformed or mismatched result stays `unknown`; a valid negative doctor result is `not-ready`. No checkout fallback exists.
- The approval detail comes from doctor. The count is parsed only from the engine's existing exact convention-count phrase, or its empty-registry phrase. This is configuration status, never file verification or release readiness.
- Optional `runtime.hudData` selects `<sha256(resolve(root))[:16]>.json`. Schema, exact project, session hash, timestamp and absolute exact receipt directory are validated. The direct `pluginData` API argument accepts an exact session receipt directory only.
- A requested session never borrows a different session's receipts. Without a session ID, the report and renderer explicitly label latest project history as **not current session**.
- Only the selected session directory is scanned. Entry count is limited to 256 and individual JSON reads to 256 KiB. Symlink/non-regular receipt files and invalid event/state/timestamp/automatic-fix fields produce unknown, hiding older PASS records. Conflicting states sharing a latest timestamp also become unknown. Five-minute-old results are labeled historical with age.
- `hostAcceptance` stays `unverified`: receipts are not native host acceptance evidence.
- `renderStatus(report,{compact,columns,showProject})` sanitizes terminal and bidirectional controls, truncates lines and shows version, engine readiness, approved count, last check and age. Full output includes approval detail and trust boundaries. Compact output is at most two lines unless the explicit pinned-project line is requested; Codex watch requests it, producing three lines in the four-row pane. Claude statusline remains two lines.

## CLI

`node status.mjs --plugin-root ABS [--root ABS] [--host codex|claude] [--json|--watch|--claude-statusline]`

Claude statusline input is limited to 256 KiB and two seconds, with required absolute `cwd` and nonempty `session_id`. Other official payload fields are ignored. No model calls occur. JSON, watch and statusline modes are mutually exclusive.

TTY watch refreshes every two seconds. Panes with four or fewer rows use compact output; each frame is limited to the terminal row count, clears only its own TTY and has no trailing newline that would scroll the title. Non-TTY watch outputs once. SIGINT/SIGTERM stops the watch timer cleanly.

## Verification

- `bun test test/product-hud.test.ts`: 10 passed, 0 failed, 73 assertions. Full log: `/tmp/boxbox-hud-status-tests-20261021.log`.
- `bunx tsc --noEmit`: passed.
- `node --check product/hud/status.mjs`: passed.
- Relevant TypeScript and JavaScript aligners were run on the owned files; parse checks passed.
- Direct placeholder scan: no TODO, test.skip, test.only or describe.only in owned files.
- Actual Node 22.22.3 PTY smoke before the final pinned-project addition: four-row/eighty-column pane, at least two frames, at most two lines per frame, no trailing newline, SIGTERM exit 0. Evidence: `/tmp/boxbox-hud-tty-20261021.json`. The final added project line has a three-line renderer assertion and was handed to the Codex integration worker for an updated real tmux capture.
- Unit coverage includes missing/malformed/oversized/symlink runtime, bounded doctor invocation, doctor errors/not-ready, missing receipts, exact session filtering, stale project history, malformed/symlink/excess receipts, timestamps and ambiguous ties, bad pointers, terminal controls, real child CLI execution, non-TTY watch, malformed/oversized Claude stdin.

Native Codex/tmux and Claude statusline acceptance, installed packaging, full repository checks and independent provider review belong to the parent integration pass. This worker's PTY probe proves renderer refresh/termination, not native host integration. File ownership is returned to the parent after this report.
