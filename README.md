# BoxBox

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

The product is **BoxBox**; core CLI, skill and plugin IDs are `boxbox` (confirmed on 2026-10-16). The npm installer candidate is `boxbox-plugin`, which was unregistered when checked. Its target command is `npx boxbox-plugin`; npm login is complete; publication is still pending. See the [Windows plugin installation guide](docs/user/codex-windows-test.md).

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

## Install the plugin

The public npm installer is being prepared as `boxbox-plugin`; registry publication is pending.
It installs the plugin and its local Node engine for Codex and Claude Code. See the
[installation guide](docs/user/codex-windows-test.md) for the current preview status and host requirements.

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
| First public CLI scope | TypeScript and Python |
| Development alignment engines | TypeScript, Python, Java, Go, Rust, JavaScript, C, C++, Swift and Kotlin |
| TypeScript detection | TypeScript 7 AST tools and a table-kind registry |
| Other language detection | A shared line engine with language-specific profiles |

The ten development engines do not imply equal release support. Write checks require the relevant parser tools. See the [implementation map](docs/development/implementation.md) for language-specific boundaries.

## Project settings and rules

Project configuration lives in `.boxbox/`. Configuration is resolved through Base → Preset → User → Project layers; safety invariants remain mandatory.

The recommended preset contains two approved conventions, four synthetic examples and two decisions: TypeScript top-level call declarations (2+ rows) and Python simple assignments (3+ rows). Research candidates are kept separately and are not automatically approved. See the [readability contract](product/rules/references/readability-contract.md) for the current rules and the [plugin skill](product/plugin/skills/boxbox/SKILL.md) for the agent workflow.

## Development status

This is a development project, not a completed public release. Local CLI artifacts and skill adapters are implemented; public distribution, native host-event acceptance and release-package licensing metadata remain open. The standard `plugin/` shim requires an explicit local engine. For the Windows Codex trial, use the [npm installer](docs/user/codex-windows-test.md), which installs its included engine into a permanent local directory. The selected npm installer name is `boxbox-plugin`; publication remains pending.

For verified behavior and remaining work, read [release readiness](docs/development/status.md), the [release contract](docs/development/release-contract.md) and the [plan](docs/development/plan.md). Historical naming and migration details are in the [naming record](docs/development/reviews/2026-10-16-boxbox-rename.md).

## Contributing

```bash
bun install
bun run check
```

`check` runs identity and dependency checks, test suites, TypeScript type checking and development installer shell syntax checks. Follow [AGENTS.md](AGENTS.md) for contribution and authoring rules. The existing [MIT LICENSE](LICENSE) is retained from GitHub main. Installer candidates still carry UNLICENSED preview metadata; publication and release-package metadata remain separate decisions. The four synthetic preset examples are separately marked CC0-1.0.

Product naming is managed from [`product.json`](product.json); see the [rename procedure and code-length boundaries](docs/development/product-identity.md).
