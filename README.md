# xxx

> Working name. `xxx` / `XXX` is a placeholder that will be replaced by the final brand name in one pass.

A multi-agent skill plugin that inspects, fixes and verifies source files one at a time against tabular ("spreadsheet-style") readability rules. Same-role rows are first given the same minimal structure; the remaining syntax boundaries are then aligned into minimum-width columns. When the structure is uncertain, it refuses rather than guesses.

It belongs to the same family of agent skill plugins as caveman and ponytail. The SKILL.md body (Agent Skills format) is tool-agnostic; the only per-tool differences are install location and manifest.

Release readiness is tracked in [`docs/status.md`](docs/status.md), and the TODO list and completion criteria up to release in [`docs/plan.md`](docs/plan.md). The real code structure, commands and safety-check scope are in [`docs/implementation.md`](docs/implementation.md), and the target product in [`docs/design.md`](docs/design.md).

**Current state (2026-10-07):** aligners for 10 languages with token-preservation checks, TypeScript and Python check reports, read-only authoring hooks, pattern/example DB lookup and validation, a public CLI (`xxx init`, `doctor`, `check`, `guide`, `format`, `db`, `run`, `hook`) with local tarball packaging (`bun run pack:cli`), and a plugin folder (`plugin/`) that installs in both Claude Code and Codex. Still open: loading approval data, limiting automatic fixes through the DB, verifying real host hooks, and the public publish, name and license decisions.

The safety-check scope differs by command. `06_align-tables.ts` checks token preservation for edit candidates and compares re-parse diagnostics before writing. If the parser tool is missing or exits abnormally, it writes nothing and exits with an error (fail-closed, 2026-10-04 REL2a). `XXX_REQUIRE_PARSERS=1` is a probe for tests to detect whether parsers are installed. Auxiliary write commands such as import splitting do not have the same gate yet, and these raw writers are not included in the public artifact. See the implementation document for details.

## Contents

| Path | Contents |
|---|---|
| `skills/xxx/` | Skill body (`SKILL.md`), rule references, AST/LSP checker scripts, fixtures |
| `agents/readability-inspector.md` | Read-only subagent for Claude Code and ZCode (Write/Edit disallowed) |
| `codex/readability-inspector.toml` | Read-only agent definition for Codex (`sandbox_mode = "read-only"`) |
| `plugin/` | The release plugin for Claude Code and Codex: manifests, CLI-only skill, read-only inspector, hooks, engine shim |
| `.claude-plugin/marketplace.json`, `.agents/plugins/marketplace.json` | Claude Code and Codex marketplaces pointing at `./plugin` |
| `docs/status.md` | First public release goal, current implementation and verification state, release blockers and resume point |
| `docs/plan.md` | Execution TODO up to release, prerequisites, completion criteria and verification methods |
| `docs/implementation.md` | Real entry points, execution flow, data locations, verification scope and limits |
| `docs/design.md` | Product design: modes, invariants, data model, customization, roadmap |
| `docs/agent-portability.md` | Skill discovery paths, install methods and verification status per agent |
| `docs/pilot-2026-09-26.md` | Pilot measurement — root causes of `;`/`=` misalignment |
| `install.sh` | Install and uninstall into each agent's directories via symlink or copy |

## Implemented languages and first release scope

These are the languages with an engine in the repository today. The core support scope of the first public release is confirmed as **TypeScript and Python**. Whether the other eight languages ship, and at what support level, is decided in the release contract.

- **TypeScript** — AST/LSP-based checkers (`scripts/typescript/`, with the grid-kinds table registry).
- **Python, Java, Go, Rust, JavaScript, C, C++, Swift, Kotlin** — a shared line engine (`scripts/common/table-engine.ts`) with a per-language profile. Strings and comments are masked, and only rows the profile can decompose are aligned. Supported syntax and safety-check scope per language are separated in the implementation document.

Examples of calling the development scripts directly. The public CLI bundling the same engine is in `skills/xxx/scripts/cli.ts`, and the release tarball is built with `bun run pack:cli`.

```bash
bun skills/xxx/scripts/rust/06_align-tables.ts --file lib.rs --write
bun skills/xxx/scripts/go/06_align-tables.ts --file main.go             # Go: report only by default
bun skills/xxx/scripts/go/06_align-tables.ts --file main.go --write --enable-go
bun skills/xxx/scripts/python/06_align-tables.ts --file models.py
```

## Install

> [!IMPORTANT]
> **XXX alignment runs after the general formatter.** If Prettier, black, rustfmt and the like run later, vertical alignment can disappear. `xxx format` applies the explicit formatter → re-parse check → approval gate → XXX to a working copy, runs the whole sequence twice to confirm a byte fixed point, and replaces the file once. When conditions are insufficient, such as no formatter configured or no approval data, it refuses without writing. Calling a language's `06_align-tables.ts` directly is still possible. Go only reports by default. See [design §3.5](docs/design.md#35-formatter-coexistence--xxx-runs-last) for the target design.

The install script is the simplest route. It symlinks by default, so edits to the rules in this repository reach every agent immediately.

```bash
./install.sh zcode codex   # link into ZCode and Codex
./install.sh claude        # link into Claude Code's global skills and agents
./install.sh pi            # link into the current project's .pi/skills/; copy with --copy pi
./install.sh --copy zcode  # copy instead of link
./install.sh --uninstall zcode codex
```

The release plugin (`plugin/`) installs from the repository's marketplaces. Installs in isolated Claude Code 2.1.286 and Codex 0.160.1 homes are verified; running the hooks against the real engine waits for the npm engine release.

- Claude Code: `claude plugin marketplace add <owner>/<repo>` → `claude plugin install xxx@xxx-plugins`
- Codex: `codex plugin marketplace add <owner>/<repo>` → `codex plugin add xxx@xxx-plugins`
- ZCode: recognizes the `.claude-plugin/` compatible manifests, so add the same repository as a marketplace.

`install.sh` places only the skill and agent files. It does not register the repository's `hooks/hooks.json` in host settings, so installing the skill alone does not activate the authoring hooks.

## Requirements

- `bun` — runs the AST checkers (`scripts/typescript/*.ts`).
- `node` + the target project's `node_modules/.bin/tsc` — used only by the hover check (`05_inspect-hover.mjs`).
- Re-parse comparison tools for the line engine: `python3`, `gofmt`, `node`, `clang`/`clang++`, `javac`, `rustfmt`, `swiftc`, `kotlinc`. Write behavior without a parser follows the safety-check description above.
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
bun run check   # bun test && bunx tsc --noEmit && bash -n install.sh (same as CI)
```

Contributor and agent rules — including the language policy — are in [`AGENTS.md`](AGENTS.md).
