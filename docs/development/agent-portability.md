# Agent Portability Map

The reference for where the `boxbox` skill and the `readability-inspector` agent live in each coding agent and how they are installed. The content (SKILL.md body, rules, scripts) is agent-agnostic; only "where it goes" in the table below differs. The skill ships tabular alignment checkers for TypeScript (AST + LSP), Python (shared line engine) and JSON/YAML (structured adapter).

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
