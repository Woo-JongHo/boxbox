# BoxBox

[English](README.md) | [한국어](README.ko.md) | [简体中文](README.zh-CN.md)

The linked detailed documentation is primarily in English.

**Read code down. Compare it across.**

This project treats repeated code like a spreadsheet: each same-role statement is a row, and its corresponding parts are columns. It helps coding agents simplify uneven structures, then aligns the remaining syntax into a compact, readable grid.

```typescript
// Before
const name = "deploy";
const retries = 3;
const timeoutMs = 1000;

// After
const name      = "deploy" ;
const retries   = 3        ;
const timeoutMs = 1000     ;
```

The aligned example above is actual TypeScript engine output. Names, values and execution order stay the same; corresponding syntax becomes easier to compare.

The product is **BoxBox**; core CLI, skill and plugin IDs are `boxbox` (confirmed on 2026-10-16). The npm installer candidate is `boxbox-plugin`, which was unregistered when checked. Its target command is `npx boxbox-plugin`; publication requires valid npm authentication and a final release decision. See the [Windows plugin installation guide](product/installer/README.md).

## Why a code grid?

Repeated code often expresses the same operation with different data. Reading it as a paragraph makes each line a separate thing to decode. Reading it as a table makes the differences visible.

- Compare identifiers, types, arguments and values vertically.
- Give each group its own widths, based on its actual contents.
- Separate different responsibilities instead of stretching them into one table.
- Simplify a long exceptional row before letting it widen every other row.

The aim is a consistent shape that helps you follow the program from top to bottom.

## Simplify. Align. Verify.

### 1. Simplify the structure

The skill guides an agent to inspect repeated rows and the code that uses them. The agent proposes ways to remove unnecessary wrappers, duplicated expressions or implementation details that widen a table. Structural changes remain an agent-and-human decision.

### 2. Align comparable rows

The deterministic engine groups supported consecutive constructs and aligns their syntax boundaries. Blank lines, indentation and incompatible row shapes form boundaries. Each group gets its own minimum column widths.

Supported patterns include declarations, assignments, imports, object rows and selected calls. Coverage depends on the language and pattern; the engine does not classify every possible construct.

### 3. Verify a change before writing

The alignment stage changes whitespace only. It checks preservation and compares parser diagnostics before replacing a file. Uncertain decomposition, unavailable parsers and unsafe file conditions can cause it to refuse a write.

The public `format` command requires complete human-approval evidence. It runs a project formatter first when one is configured, then verifies parsing, checks rule approvals and applies alignment. Without a configured formatter, it aligns approved patterns directly. The entire cycle runs twice to verify a fixed point, then replaces the target once. Changes made by the external formatter are separate from the alignment stage's whitespace-only guarantee.

## Write, Refactor, Align and Check

The 0.2.5 source candidate separates agent workflows from engine changes:

- **Write:** the agent implements requested behavior using approved authoring guidance.
- **Refactor:** the agent improves existing structure and separately verifies behavior and relevant performance.
- **Align:** the engine adjusts approved horizontal layout whitespace without wrapping lines, changing indentation or running an external formatter.
- **Check:** inspect existing code without changing it. Missing groups do not establish whole-file style coverage.

`guide --file <file> --authoring --json` supplies approved guidance for an existing, empty or not-yet-created file;
examples are guidance, not write approval. `align --file <file> --dry-run --json` previews alignment and
`align --file <file> --json` applies it. Write and Refactor use the host agent, not a CLI generation command.
Preview leaves the target unchanged; the existing `format` pipeline remains a separate operation.
Integration verification and independent review are in progress. See [workflow selection and verification limits](docs/user/modes.md).

The CLI now checks TypeScript, Python, strict JSON and YAML 1.2, reporting syntax as valid, invalid or parser error.
JSON and YAML alignment is deliberately narrow:
three or more adjacent, same-level, single-line scalar mapping entries. It reports unsupported rows separately and
leaves them unchanged. YAML block scalars, anchors, aliases, tags, complex keys, flow collections, sequences,
directives and document markers are outside this alignment slice. The engine path exists for structured Align, but
the recommended preset still authorizes writes for only the two TypeScript/Python rules below; JSON/YAML writes need
their own complete local or future preset approval proof.

## Install the plugin

The public npm installer is being prepared as `boxbox-plugin`; registry publication is pending.
It installs the plugin and its local Node engine for Codex and Claude Code. See the
[installation guide](product/installer/README.md) for the current preview status and host requirements.

To try a locally built installer:

```sh
bun install
bun run pack:installer
npm exec --yes --package '/absolute/path/to/dist/installer/boxbox-plugin-<version>.tgz' -- boxbox --codex
```

Replace `<version>` with the version in `package.json`, or use the exact archive path printed by `pack:installer`. This local artifact journey requires the checkout for building. The installed plugin uses its permanent Node engine.
The public installer needs Node.js 22.22.3 or later and npm; Python formatting additionally needs `python3`.

## Develop BoxBox

Product sources live in `product/`; development tools, research and evidence live in `development/`.
`plugin/` is generated from product templates, and `dist/` contains generated packages.
`docs/` contains public user and contributor documentation. Tests, build tools and these documents belong in the
source repository even when they are excluded from installed packages; personal task records are kept separately.
See [the development guide](development/README.md) and [the layout contract](docs/development/layout.md).

```sh
bun install
bun run check
./development/install.sh codex
bun product/packages/cli/entry.ts check --file path/to/file.ts --json
```

The development skill supports Claude Code, Codex, ZCode and pi. Its default link installation follows live product
sources; `--copy` creates a managed copy. Development authoring hooks require separate host registration.

## Language coverage

| Surface | Coverage |
| --- | --- |
| Implemented public CLI Check/Align engines | TypeScript, Python, strict JSON and YAML 1.2 (`.yaml`/`.yml`) |
| Default preset write authorization | Two rules only: TypeScript call declarations and Python simple assignments |
| Development alignment engines | The same four languages; other line-engine languages were removed on 2026-10-22 |
| TypeScript detection | TypeScript 7 AST tools and a table-kind registry |
| JSON/YAML detection | Adjacent same-level runs of 3+ single-line scalar mapping entries |
| Python detection | The shared line engine with a Python profile (string and comment masking, row slot rules) |

The four supported languages do not have equal release support: only TypeScript and Python have default write approvals. Write checks require the relevant parser tools. See the [implementation map](docs/development/implementation.md) for language-specific boundaries.

## Project settings and rules

Project configuration lives in `.boxbox/`. Configuration is resolved through Base → Preset → User → Project layers; safety invariants remain mandatory.

The recommended preset contains two approved conventions, four synthetic examples and two decisions: TypeScript top-level call declarations (2+ rows) and Python simple assignments (3+ rows). Research candidates are kept separately and are not automatically approved. See the [readability contract](product/rules/references/readability-contract.md) for the current rules and the [plugin skill](product/plugin/skills/boxbox/SKILL.md) for the agent workflow.

## Development status

This is a development project, not a completed public release. Local CLI artifacts and skill adapters are implemented; public distribution and native host-event acceptance remain open. The standard `plugin/` shim requires an explicit local engine. For the Windows Codex trial, use the [npm installer](product/installer/README.md), which installs its included engine into a permanent local directory. The selected npm installer name is `boxbox-plugin`; publication remains pending.

For verified behavior and remaining work, read [release readiness](docs/development/status.md), the [release contract](docs/development/release-contract.md) and the [plan](docs/development/plan.md). Historical naming and migration details are in the [naming record](docs/development/reviews/2026-10-16-boxbox-rename.md).

## Contributing

Start with the [maintainer documentation](docs/development/README.md) for architecture, inspection stages, storage contracts and repeatable change patterns.

```bash
bun install
bun run check
```

`check` runs identity and dependency checks, test suites, TypeScript type checking and development installer shell syntax checks. Follow [AGENTS.md](AGENTS.md) for contribution and authoring rules. BoxBox is released under the [MIT License](LICENSE); the installer and engine packages declare `MIT` and ship the license file. The four synthetic preset examples are separately marked CC0-1.0.

Product naming is managed from [`product.json`](product.json); see the [rename procedure and code-length boundaries](docs/development/product-identity.md).
