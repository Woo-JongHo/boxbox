# Agent Portability Map

The reference for where the `boxbox` skill and the `readability-inspector` agent live in each coding agent and how they are installed. The content (SKILL.md body, rules, scripts) is agent-agnostic; only "where it goes" in the table below differs. The skill ships tabular alignment checkers for TypeScript (AST + LSP), Python (shared line engine) and JSON/YAML (structured adapter).

## Current distributable plugin boundary

The npm installer targets **Codex and Claude Code only**; the [installer guide](../../product/installer/README.md)
owns current installation, runtime, trust and removal commands. The development discovery map below is historical
evidence, not an additional supported-host matrix. Studying Pi, OMP or another framework does not add a shipped adapter.
Claude's payload includes the read-only inspector; Codex's shipped payload has no agent. The development Codex TOML
definition is a separate local installation surface.

Both adapters share SessionStart, PostToolUse and Stop. PostToolUse matches file-edit tools and `Bash`; Codex maps
`exec_command` and a completed `write_stdin` to that hook name. Every matched call rechecks session changes, including
when the shell call itself was read-only. Unmatched or specialized tools are not a complete enforcement boundary;
Stop checks changes again. See [Codex tool coverage](https://learn.chatgpt.com/docs/hooks#tool-coverage) and the
[Claude event contract](https://code.claude.com/docs/en/hooks#posttooluse).

Keep discovery, engine identity/execution, language-parser readiness under actual host permissions, hook trust/event delivery, host acceptance of feedback, and preservation of ordinary command results separate.
A generated manifest, successful command or local receipt alone establishes neither effective permissions nor
host-visible context/continuation. Native evidence is scoped to the exact host version and candidate artifact measured.

| Event | Intended host effect | Acceptance observable |
| --- | --- | --- |
| SessionStart | Add the short inspection/receipt-location context | The real session receives the generated context; a model can return its previously unknown receipt directory |
| PostToolUse | Add inspection feedback after a matched completed tool; report a layout failure | A native matched tool produces a receipt and the host delivers feedback. `Bash` is advisory and preserves shell output/exit status; file-edit tools retain blocking feedback, which cannot undo a completed edit |
| Stop | Request at most one continuation when changed code fails inspection | A native failing session continues once, then can terminate; an active/repeated Stop does not claim another block |

Untrusted Codex hooks are a required negative control, not a healthy activated state. Tests may authorize only their
reviewed temporary hook definitions for one invocation; installation never grants trust. Read-only native probes let
the test driver change a fixture after SessionStart, then let the host execute a read-only shell call. This measures
event delivery and feedback without granting the review model source-writing tools. It does not prove that every edit
tool, operating system or hosted UI has been tested.

## Install matrix

| Agent | Skill discovery location | Inspector agent | Install method | Verification status |
|---|---|---|---|---|
| ZCode | `~/.agents/skills/`, workspace `.agents/skills/`, plugin root | Plugin `agents/` (subagent) | `./development/install.sh zcode` or add as marketplace | Measured on a machine — discovery confirmed from `~/.agents/skills/` |
| Claude Code | `~/.claude/skills/`, plugin `skills/` | Plugin `agents/` (subagent) | `/plugin marketplace add <owner>/<repo>` → `/plugin install boxbox@boxbox-plugins`, or `./development/install.sh claude` | Based on path documentation |
| Codex | `~/.codex/skills/` (global), workspace | `~/.codex/agents/*.toml` | `./development/install.sh codex`; recent Codex also supports `codex plugin marketplace add` | Measured on a machine — existing skills in `~/.codex/skills/` use the same SKILL.md format |
| Pi / Oh My Pi | Project `.pi/skills/` (auto-discovered), OMP ecosystem packages (pi.dev) | None — the main agent runs the SKILL.md inspection procedure itself | `./development/install.sh pi` (per-project copy), or `pi install git:github.com/<owner>/<repo>` | Based on README documentation |
| Rules-file agents (Cursor, ...) | Copy into `AGENTS.md` / `.cursor/rules` | None | Excerpt the SKILL.md body into that rules file | Based on prior art (caveman, ponytail) |

Machine measurements are as of 2026-09-26. Entries based on path documentation are confirmed by invoking the skill in each agent after installation.

## `<SKILL>` placeholder convention

Command examples in SKILL.md and the inspector definitions use the form `<SKILL>/engine/...`. Replace `<SKILL>` with the folder where that SKILL.md is installed. Run scripts from the root of the repository being inspected (target file paths are relative to that root).

## Dependencies

- AST checkers (`00`–`08`, `grid-kinds.ts`, `grid-tokens.ts`, `load-source-file.ts`): the `bun` runtime + `typescript@7` from this repository's `node_modules` (uses the `typescript/unstable/*` subpaths).
- Hover checker (`05_inspect-hover.mjs`): `node` + the **target project's** `node_modules/.bin/tsc --lsp` — the inspected project must have TypeScript installed.
- `measure-layout.ts`: bun + `node:fs` only (no external dependencies).

## Prior art for multi-agent plugins

- **caveman** — "a skill/plugin for Claude Code, Codex, Gemini, Cursor, Windsurf, Cline, Copilot, and 30+ other agents". Claude Code uses `claude plugin marketplace add`, others use `npx skills add <repo> -a <agent>`, and rules-file agents copy the body.
- **ponytail** — Claude Code `/plugin marketplace add`, Codex `codex plugin marketplace add` + `codex plugin add`, Pi `pi install git:...`, with per-tool install sections for OpenCode, Gemini, Copilot CLI and others, plus a `docs/agent-portability.md`.

This repository follows the same structure: one agent-agnostic skill source + per-tool adapters (agent definitions, install script) + this portability map.

## Project overlays

Project-specific governance is not stored in this repository; the project owns it.

- **Governance rules** (for example, requiring an evidence receipt whenever the skill itself changes) belong in the project's own `AGENTS.md` or workspace overlay.
- **Architecture boundaries**: per-repository boundary documents such as a `LAYERS.md` are covered generically by the SKILL.md entry rule "read the target repository's architecture boundary document".
