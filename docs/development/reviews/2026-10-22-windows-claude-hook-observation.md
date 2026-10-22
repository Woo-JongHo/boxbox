# Windows Claude hook observation (2026-10-22)

An observation record, not an independent review. It uses the hook receipts and the session record of a real project
session the user ran on the native Windows PC; no project file names or message text are kept here.

## Setup

- Host: Claude Code 2.1.280 on native Windows, Node 24.12, Python 3.14.
- Plugin: `boxbox@boxbox-plugins` 0.2.5 installed from the clean CI archive `5fe739f5…2196a` (run 39732919128) with
  `npm exec --package <tgz> -- boxbox --claude`; user scope; installed by the assistant, then used by the user.
- The user ran Claude in an existing Python project, not in the prepared test folder.

## Observed

| Event | Receipts | State | Detail |
| --- | --- | --- | --- |
| SessionStart | baseline created for 3 project directories | n/a | one session record shows 1 injected hook message |
| PostToolUse | 1 | `FAIL` | tool `Write`; 4 Python files checked |
| Stop | 4 | 3 `FAIL`, 1 `NO_CHANGES` | the three `FAIL` receipts list the same 4 files |

The `FAIL` state came from one file with 5 misaligned groups (19 planned edits); the other three files had none. Several
`SUGGEST` groups were reported without affecting the state. `automaticFixPerformed` was false in every receipt.
Windows-style paths and a non-ASCII directory name were handled. The session record contained 1 SessionStart, 12 Stop and 11
PostToolUse BoxBox hook messages (see [usage measurements](../issue-library/evidence/session-usage-measurements.txt)).

## Not established

- Whether the model read or acted on the hook feedback; delivery is shown by the host recording the messages, not by the
  model's behavior.
- Whether the misaligned groups were present before the session or were introduced by it. The baseline stores file hashes
  only, so a hook `FAIL` can come from earlier misalignment in a changed file.
- A model call to the BoxBox skill or engine commands: the session made none, so skill invocation on Windows Claude is
  unobserved.
- Anything about Codex or macOS Claude hooks.
