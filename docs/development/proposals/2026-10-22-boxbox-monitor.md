# `/boxbox -monitor`: usage and change report per host

Status: proposal (2026-10-22), tracked by [issue 021](../issue-library/records/BBX-20261022-021-boxbox-monitor.json).
Nothing here is implemented except the token reader `development/tools/session-usage.ts`. Choices marked **adopted default**
were made on the user's instruction to proceed with the recommended direction and can be changed before implementation.

## Gap and scope

The user wants one page per host plugin (Claude Code, Codex) that shows how many tokens a BoxBox-assisted session used and
how the code changed compared with before: lines, bytes and similar growth. Today the tokens are readable only through a
development script, and the "before" side does not exist: the SessionStart baseline stores one hash string per file.

This is an on-demand report, not a HUD. The terminal HUD was removed on 2026-10-22; nothing here is a persistent overlay,
a status line or a tmux pane.

## What the page shows

| Section | Content | Source | Exactness |
| --- | --- | --- | --- |
| Tokens | Totals, by `model:effort`, by BoxBox step (guide, check, format, align, skill, inspector, other), per session | Session record `usage` | Exact; result and hook text are labelled estimated |
| Hook text | Count and estimated tokens injected per hook event | Session record hook messages | Estimated (1 token per 4 ASCII characters) |
| Change footprint | Per file and total: lines before/after, bytes before/after | Baseline v2 (below) plus the current file | Exact |
| Whitespace versus content | Per file: whitespace-only change (padding added by alignment) or content changed | Baseline v2 `squeezed` hash | Exact for the classification; bytes of content change are not split further |
| Hook results | PASS, FAIL, UNSUPPORTED, NO_CHANGES per event and over time | Hook receipts | Exact |

Estimated tokens of the whitespace growth are shown next to its bytes, labelled estimated, so the cost of alignment padding
is a visible number instead of a worry. Dollar cost is not shown (**adopted default**); tokens do not go stale when prices
change.

## Data that does not exist yet: baseline v2

`snapshot()` in `lifecycle-hook.ts` stores `path -> sha256 string` (or a `symlink:` marker) for every file. The footprint
needs more, only for files with a supported extension (`.ts`, `.py`, `.json`, `.yaml`, `.yml`):

```json
{ "src/a.ts": { "h": "<sha256>", "b": 1204, "l": 38, "s": "<sha256 of the text with horizontal whitespace removed>" } }
```

- `b` and `l` are bytes and physical lines at session start; `s` hashes the content with every run of spaces and tabs
  removed, line breaks kept. At report time, equal `s` with different `h` means a whitespace-only change (alignment), and
  `bytes(now) - b` is exactly the padding added. Different `s` means content changed.
- No file content is stored. For a git project the report may also compare with `HEAD`, but the baseline works without git
  and without a commit.
- Readers accept both shapes (old strings stay valid, so sessions started before an upgrade still report). The change
  detection that compares `h` must keep working on either shape. A baseline-format version is recorded in the file.
- Baseline growth must be measured before shipping. If it is large, store the extra fields only for supported files, which
  is already the plan.

## Product shape

- **Engine:** `boxbox monitor [--project | --session <id>] [--json] [--html <path>]`. The JSON is the stable contract; HTML
  renders it. The command reads session records, hook receipts and baselines; it writes one report file under the host's
  plugin data folder and nothing in the project (**adopted default**). It makes no model call.
- **Skill:** `/boxbox -monitor` makes the agent run that command and report the file path and a few headline numbers. It
  never pastes the page into the conversation, so looking at usage does not spend the tokens it reports.
- **Page:** one self-contained HTML file (inline CSS and script, no network, no external fonts), one per host
  (**adopted default**: "per plugin" means per host). It lists project-relative file names; the page is local, and `--no-paths`
  replaces names with indexes for sharing.
- **Scope:** the current project, all of its sessions, newest first (**adopted default**). Cross-project totals are out of
  scope.
- **Location of the code:** a product module (`product/engine/common/`) so the shipped CLI has it. The reader in
  `development/tools/session-usage.ts` moves there and keeps its tests. A repository layout check must still pass.

## Host differences

| | Claude Code | Codex |
| --- | --- | --- |
| Session record | `~/.claude/projects/<project slug>/<session>.jsonl`; assistant lines repeat one response's `usage`, so count once per message id | `~/.codex/sessions/YYYY/MM/DD/rollout-*.jsonl`; `event_msg` / `token_count` carries `total_token_usage` and `last_token_usage` |
| Hook text in the record | `hook_*` attachments | Not yet inspected |
| Receipts | `CLAUDE_PLUGIN_DATA/hooks/...` | Plugin data folder of the Codex host |
| Status | Reader exists; verified on two real sessions | Format probed only; reader and per-step attribution need a fixture |

Neither record format is a public contract. Readers must tolerate unknown lines and fields, detect what they can read, and
report "not readable" instead of a guess. Tests use synthetic records; no real conversation is committed.

## Boundaries

- Read-only for sources and records. Records contain conversations: only numbers, model and effort names, tool names, sizes
  and project-relative file names reach the output (a test pins that no message text appears).
- Per-step attribution counts a turn under the BoxBox call it made; cache-read tokens re-read earlier context and are shown
  separately from fresh input, never added into one "cost".
- The report is evidence of volume, not of correctness or of savings. A comparison with a session that did not use BoxBox
  is not claimed.

## Order

1. Baseline v2 in the lifecycle hook with a reader that accepts both shapes, and a measurement of its size.
2. `monitor --json` combining the token reader, receipts and the footprint; synthetic fixtures; no-text-leak test.
3. HTML renderer, then the `-monitor` skill argument and docs (root READMEs together, `docs/user/`).
4. Codex reader after a fixture of a real rollout is reduced to numbers and sanitized.

Collecting inspector data does not wait for any of this: `session-usage.ts` already reads Claude sessions. Two sessions
measured on 2026-10-22 exercised no guide, check or inspector step, so the model evaluation in
[issue 020](../issue-library/records/BBX-20261022-020-model-effort-assignment.json) needs sessions that do.

## Acceptance

- The page for a session that ran `format` shows the whitespace-only bytes added by alignment and the files whose content
  changed, and the two never mix.
- A baseline written before the upgrade still produces a report without the footprint section.
- Token totals equal the session record's `usage` counted once per message id.
- No output, page or log contains message text, commands or file content.
- Hooks, `check` and `format` behavior and their exit statuses are unchanged.

## Decisions still open

1. Product command (recommended, because the request is a plugin feature) or a development tool only.
2. Whether `--no-paths` is enough or file names must be hidden by default.
3. Whether a Codex page ships in the first version or after the reader has a real fixture.
