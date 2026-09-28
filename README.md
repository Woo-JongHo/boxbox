# xxx

> Working name. `xxx` / `XXX` is a placeholder that will be replaced by the final brand name in one pass.

A multi-agent skill plugin that inspects, fixes and verifies source files one at a time against tabular ("spreadsheet-style") readability rules. Same-role rows are first given the same minimal structure; the remaining syntax boundaries are then aligned into minimum-width columns. When the structure is uncertain, it refuses rather than guesses.

It belongs to the same family of agent skill plugins as caveman and ponytail. The SKILL.md body (Agent Skills format) is tool-agnostic; the only per-tool differences are install location and manifest.

See [`docs/design.md`](docs/design.md) for the product direction.

## Contents

| Path | Contents |
|---|---|
| `skills/xxx/` | Skill body (`SKILL.md`), rule references, AST/LSP checker scripts, fixtures |
| `agents/readability-inspector.md` | Read-only subagent for Claude Code and ZCode (Write/Edit disallowed) |
| `codex/readability-inspector.toml` | Read-only agent definition for Codex (`sandbox_mode = "read-only"`) |
| `.claude-plugin/` | Plugin and marketplace manifests (recognized by Claude Code and compatible tools) |
| `docs/design.md` | Product design: modes, invariants, data model, customization, roadmap |
| `docs/agent-portability.md` | Skill discovery paths, install methods and verification status per agent |
| `docs/pilot-2026-09-26.md` | Pilot measurement — root causes of `;`/`=` misalignment |
| `install.sh` | Install and uninstall into each agent's directories via symlink or copy |

## Supported languages

- **TypeScript** — AST/LSP-based checkers (`scripts/typescript/`, with the grid-kinds table registry).
- **Python, Java, Go, Rust, JavaScript, C, C++** — language profilers (`scripts/<lang>/01_group-regions.ts`, `06_align-tables.ts`) on a shared line engine (`scripts/common/table-engine.ts`). String and comment masking prevents structural misreads, and rows that fail lossless decomposition are refused.

```bash
bun skills/xxx/scripts/go/06_align-tables.ts --file main.go --write
bun skills/xxx/scripts/python/06_align-tables.ts --file models.py
```

## Install

> [!IMPORTANT]
> **XXX runs after your formatter and overrides its layout.** Formatters such as Prettier, black and rustfmt remove vertical alignment, so XXX must always be the final pass: the canonical form of a file is `xxx(formatter(file))`. Replace direct formatter calls in format-on-save, git hooks and CI (for example `prettier --check`) with `xxx format` / `xxx check`, which run your formatter first and XXX last. Go is the exception: gofmt's layout is enforced across the Go ecosystem, so Go alignment is off by default until it is proven gofmt-stable. See [design §3.5](docs/design.md#35-formatter-coexistence--xxx-runs-last).
>
> *`xxx format` / `xxx check` are planned (roadmap P0.5); today the per-language `06_align-tables.ts` scripts are the entry points.*

The install script is the simplest route. It symlinks by default, so edits to the rules in this repository reach every agent immediately.

```bash
./install.sh zcode codex   # link into ZCode and Codex
./install.sh claude        # link into Claude Code's global skills and agents
./install.sh pi            # copy into the current project's .pi/skills/ (pi, oh-my-pi)
./install.sh --copy zcode  # copy instead of link
./install.sh --uninstall zcode codex
```

Marketplace installs are supported too (once the repository is on GitHub):

- Claude Code: `/plugin marketplace add <owner>/<repo>` → `/plugin install xxx@xxx-plugins`
- ZCode: recognizes the `.claude-plugin/` compatible manifests, so add the same repository as a marketplace.

## Requirements

- `bun` — runs the AST checkers (`scripts/typescript/*.ts`).
- `node` + the target project's `node_modules/.bin/tsc` — used only by the hover check (`05_inspect-hover.mjs`).
- `bun install` (or `npm install`) in this repository — pins the `typescript@7` the checkers use. `install.sh` runs it automatically.

## Single source of rules

A copy of the skill once drifted from the canonical version in its description, script paths and rules. This plugin prevents that structurally:

- Rules and scripts exist only in this repository; agents link to it.
- Project-specific governance lives in a project-side overlay, not here.
- Only rules confirmed by user feedback are promoted into this repository's SKILL.md and references.

Command examples in the skill body use the `<SKILL>` placeholder (the skill folder path), so they work wherever the skill is installed.

## Development

```bash
bun install
bun run check   # bun test && tsc --noEmit && bash -n install.sh (same as CI)
```

Contributor and agent rules — including the English-only policy — are in [`AGENTS.md`](AGENTS.md).
