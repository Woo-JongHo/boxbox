---
name: boxbox
description: Use when inspecting, fixing and verifying TypeScript and Python files one at a time against tabular readability rules, where same-role rows share one structure and their syntax boundaries are aligned into minimum-width columns.
---

# BoxBox Code Readability

Let the reader follow the execution flow from top to bottom and compare same-role rows vertically.
Treat code like spreadsheet data — rows, columns and cells — but first give every same-role row **the same minimal
composition**, then pin the remaining syntax boundaries into minimum-width columns. Do not impose a general formatter's
taste; apply automatically only rules a human has approved.

## Running the engine

Every check and fix goes through the bundled launcher. Resolve `<PLUGIN_ROOT>` from this skill location (`../..`) and run it from the root of the target repository. The standard shim requires `BOXBOX_CLI` to point to a locally installed engine; the BoxBox npm installer configures its own launcher during installation. Never fetch `boxbox` from npm: that registry name is owned by an unrelated package.

```bash
"<PLUGIN_ROOT>/scripts/boxbox" doctor                      # runtime, parser, config and approval data status
"<PLUGIN_ROOT>/scripts/boxbox" check  --file <file> --json  # read-only check
"<PLUGIN_ROOT>/scripts/boxbox" guide  --file <file> --json  # approved rules and examples that apply to this file
"<PLUGIN_ROOT>/scripts/boxbox" format --file <file> --dry-run --json
"<PLUGIN_ROOT>/scripts/boxbox" format --file <file> --json
```

- The first public stage accepts TypeScript and Python files **one at a time**. Fixing Python requires a runnable `python3`.
- `format` aligns approved tables directly without an external formatter. If one is configured for the language, it runs first.
  `format --dry-run` also executes a configured formatter twice; inspect its command and arguments in the effective config
  before running it. Use existing authorization; ask only when executing that command is outside the authorized work.
  Human approval proof, re-parsing, preservation and a two-run fixed point must pass; report any refusal reason to the user.
- Do not look for or run other alignment scripts or bypass options.

## Workflow

1. Handle only the one file the user named. Wait for the user's feedback before moving to the next file.
2. Read `formatReadiness` (approval eligibility; write verification is still `not-run`), the groups (`groups`) and states (`PASS`, `FIXABLE`, `REFUSE`) from `check --json`. `REFUSE` means the structure
   cannot be split losslessly, so do not fix those rows.
3. Check the approved rules with `guide --json`. For an explicit fix/format request, apply approved rules with
   `format --dry-run` → `format`. For a check/review request, report the findings.
4. If there are no approved rules, do not align by hand; report the candidate groups and the evidence to the user.
5. After a fix, rerun `check --json` to confirm `misaligned=0`, and never claim a verification passed that you did not run.

## Rule documents

Read the documents in this folder when a judgment is needed.

- `references/charter.md` — principles and safety invariants
- `references/grammar.md` — grammar units, patterns, roles, paragraphs (split with a blank line when the property differs)
- `references/readability-contract.md` — confirmed rules, discarded rules, column-check order
- `references/typescript-grid-template.md` — per-role TypeScript table templates

## Authoring hooks

The plugin hooks check TypeScript and Python files changed during the session, read-only, and report the result. They never fix anything automatically.
The npm-installed launcher requires the host's plugin data folder and writes receipts there. Direct CLI hooks installed
with `hooks install` can fall back to `.boxbox/hooks` when the host provides no data folder. Source files stay read-only.
