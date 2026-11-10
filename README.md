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

The aligned example above is actual TypeScript engine output, and a test keeps it that way. Automatic writes are deliberately narrow today: a few approved rules, so most other patterns are reported, not changed. Names, values and execution order stay the same; corresponding syntax becomes easier to compare.

The product is **BoxBox**; core CLI, skill and plugin IDs are `boxbox` (confirmed on 2026-10-16). The public npm installer is [`boxbox-plugin`](https://www.npmjs.com/package/boxbox-plugin), installed with `npx boxbox-plugin`. See the [Windows plugin installation guide](product/installer/README.md).

| What matters | BoxBox 0.2.8 |
| --- | --- |
| Deterministic language surfaces | TypeScript, Python, strict JSON and YAML 1.2 |
| Default write approvals | 5 deliberately narrow conventions |
| Model calls from the engine and hooks | **0** |
| npm download | **384,104 bytes** compressed; 607,186 bytes unpacked |

BoxBox is not a general formatter and does not ask a model to decide whether bytes are preserved. The engine measures,
plans, parses and verifies locally. The agent is used only for the work that actually needs judgment: Write, Refactor,
and the optional read-only inspector.

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

BoxBox 0.2.8 separates agent workflows from engine changes:

- **Write:** the agent implements requested behavior using approved authoring guidance.
- **Refactor:** the agent improves existing structure and separately verifies behavior and relevant performance.
- **Align:** the engine adjusts approved horizontal layout whitespace without wrapping lines, changing indentation or running an external formatter.
- **Check:** inspect existing code without changing it. Missing groups do not establish whole-file style coverage.

`guide --file <file> --authoring --json` supplies approved guidance for an existing, empty or not-yet-created file;
examples are guidance, not write approval. `align --file <file> --dry-run --json` previews alignment and
`align --file <file> --json` applies it. Write and Refactor use the host agent, not a CLI generation command.
Preview leaves the target unchanged; the existing `format` pipeline remains a separate operation.
Check and Format also accept repeated `--file` or bounded recursive `--directory` selections. With a configured
formatter, Check verifies the final formatter-then-BoxBox bytes on working copies and keeps original-source findings
separate from `canonical` verification. Batch formats are atomic per file and report completed writes if another file
fails; per-group selective writes remain deferred. Session hooks default to read-only `check`; only an explicit
`boxbox mode align` enables approved horizontal alignment after matched tool calls. Stop remains read-only.
See [workflow selection and verification limits](docs/user/modes.md).

The CLI now checks TypeScript, Python, strict JSON and YAML 1.2, reporting syntax as valid, invalid or parser error.
JSON and YAML alignment is deliberately narrow:
three or more adjacent, same-level, single-line scalar mapping entries. It reports unsupported rows separately and
leaves them unchanged. YAML block scalars, anchors, aliases, tags, complex keys, flow collections, sequences,
directives and document markers are outside this alignment slice. The engine path exists for structured Align, but
the recommended preset still authorizes writes for only the TypeScript and Python rules below; JSON/YAML writes need
their own complete local or future preset approval proof.

## Install the plugin

Node.js 22.22.3 or later, npm, and the Codex or Claude Code CLI are required. The public installer installs the plugin and a local Node engine for every host it detects. See the
[installation guide](product/installer/README.md) for details.

```sh
npx boxbox-plugin
```

Restart the host, then ask it to align a file with BoxBox. Adding this repository as a Claude or Codex marketplace installs only the plugin, without the engine: commands stop with a setup message, and checks do not run: hooks do not block, and only the session hook prints that message. If you already did that, remove that registration first, using the lines for your host, then run the installer:

```sh
claude plugin uninstall boxbox@boxbox-plugins --scope user
claude plugin marketplace remove boxbox-plugins
codex plugin marketplace remove boxbox-plugins
```

On Windows, replace the wildcard with the full archive path; see the installation guide. **If your project runs a code formatter:** Prettier, Black and Ruff's formatter revert BoxBox's alignment in the files they rewrite. Configure one formatter for the language, then have your editor, hooks and CI call BoxBox's `format` and `check` instead of the formatter directly. They accept repeated `--file` or `--directory` selections, with the whole-file approval gate retained for each file. A later direct formatter run can still undo alignment. `doctor`, `init`, `align` and `format` warn when a project-root configuration shows a formatter.

The checkout is needed only for building. The installed plugin uses its permanent Node engine.
The public installer needs Node.js 22.22.3 or later and npm; Python inspection and formatting additionally need a runnable `python3`.

## Is BoxBox heavy?

The short answer is: the download is small; the installed TypeScript toolchain is the part that takes space.

These numbers were measured from a clean isolated macOS arm64 installation of the published
`boxbox-plugin@0.2.8`. They are a footprint snapshot, not a cross-platform promise: npm metadata and native
TypeScript package sizes can differ by platform.

| Measured item | Size |
| --- | ---: |
| npm tarball | 384,104 B (375.1 KiB) |
| npm-reported unpacked package, 42 files | 607,186 B (0.58 MiB) |
| Permanent Codex installation | 30,984,814 B (29.55 MiB) |
| Permanent Claude installation | 30,986,310 B (29.55 MiB) |
| Plugin cache added by each host | about 0.10 MiB |
| Fresh npm download cache used during the isolated install | 27.80 MiB |
| Entire two-host isolated test directory, including npm cache | 87.10 MiB |

About 26.22 MiB of each permanent host installation is the pinned native TypeScript 7 package. Codex and Claude
receive separate permanent runtimes intentionally, so one host can be repaired or removed without silently changing
the other. Installing one host therefore costs about 29.55 MiB permanently; installing both costs about 59.1 MiB,
before npm's reusable download cache.

On the same Apple M1 workstation, ten warm process runs checking one three-line TypeScript file took 248–475 ms,
with a 266 ms median and 298 ms mean. This is a small-file startup measurement, not a large-project benchmark.
Hook cost grows with the changed files that are actually inspected.

## How many AI tokens does it use?

BoxBox has two very different cost paths:

- **Engine commands and lifecycle hooks:** `check`, `guide`, `align`, `format`, `doctor`, update checks, status output
  and session receipts make **no model call**, so their direct AI-token cost is zero.
- **Agent workflows:** Write and Refactor use the model already running in the host. Their usage depends on the task,
  repository and host; BoxBox does not claim a fixed token saving.
- **Optional Claude inspector:** this is a separate read-only subagent and does consume model tokens when delegated.
  The generated 0.2.8 definition currently names Sonnet with medium effort, but that remains an
  `unevaluated-default`, not a proven optimum. Codex's shipped plugin has no inspector agent.

The installed `SKILL.md` is 16,644 bytes. The skill plus all four reference documents is 92,343 bytes. A rough
four-characters-per-token conversion is about 4.2K and 23K tokens respectively, but actual counts depend on the
host tokenizer, which references are opened and prompt-cache reuse; these are context-size estimates, not billing
measurements.

A six-run Claude pilot on one 228-line TypeScript file compared inherited Opus 5.5 with a Sonnet 5 inspector:

| Pilot result | Inherited Opus | Sonnet inspector |
| --- | ---: | ---: |
| Mean printed session cost | $0.7244 | $0.6107 |
| Mean wall time | 107 s | 177 s |
| Mean inspector turns | 4.3 | 8.7 |
| Mean inspector output tokens | 8,070 | 12,230 |
| Mean fixable groups pointed at | 6.7 / 8 | 7.7 / 8 |

Sonnet's mean printed-cost ratio was 0.843, missing the pre-registered 0.70 threshold, so the pilot did **not**
justify Sonnet as a cost-saving selection. It was one file with three runs per condition, and advice quality was not
graded. See the [protocol, raw runs, errata and limits](docs/development/reviews/2026-10-22-inspector-model-pilot/RESULTS.md).
Unlike broader optimization plugins such as [Ponytail](https://github.com/DietrichGebert/ponytail) or
[Caveman](https://github.com/JuliusBrussee/caveman), BoxBox therefore makes no headline claim that it reduces total
tokens or total cost. Their README discipline—show the benefit, the method and the red rows—was a presentation
reference; their benchmark results do not transfer to BoxBox.

SessionStart checks GitHub release tags at most once per 24 hours and sends no source content; set
`BOXBOX_UPDATE_CHECK=0` to disable that probe. Monitor reports stay local and contain no transcript text, commands or
source content.

## Where does it run?

The npm installer officially supports **Codex and Claude Code**. The development installer can expose the
agent-agnostic skill to ZCode and Pi / Oh My Pi, and another harness can call the Node CLI directly. Those paths do
not yet have the same lifecycle-hook, trust and native acceptance matrix as the two official hosts. A wrapper around
Codex or Claude works when it preserves that host's plugin environment and events; a direct Gajae Code, Pi or other
orchestrator integration still needs a thin adapter for discovery, plugin data, edit-event mapping and Stop behavior.
See the [portability contract](docs/development/agent-portability.md).

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
| Default preset write authorization | Five rules only: four TypeScript declaration shapes and Python simple assignments |
| Development alignment engines | The same four languages; other line-engine languages were removed on 2026-10-22 |
| TypeScript detection | TypeScript 7 AST tools and a table-kind registry |
| JSON/YAML detection | Adjacent same-level runs of 3+ single-line scalar mapping entries |
| Python detection | Document-local CPython AST/token analysis feeding the shared line engine and bounded row profiles |

The four supported languages do not have equal release support: only TypeScript and Python have default write approvals. Write checks require the relevant parser tools. See the [implementation map](docs/development/implementation.md) for language-specific boundaries.

## Project settings and rules

Project configuration lives in `.boxbox/`. Configuration is resolved through Base → Preset → User → Project layers; safety invariants remain mandatory.

The recommended preset contains five approved conventions, ten synthetic examples and five decisions: TypeScript top-level declarations of same-function calls, other calls, empty calls and simple values (2+ rows), and Python simple assignments (3+ rows). Research candidates are kept separately and are not automatically approved. See the [readability contract](product/rules/references/readability-contract.md) for the current rules and the [plugin skill](product/plugin/skills/boxbox/SKILL.md) for the agent workflow.

## Development status

The public installer `boxbox-plugin@0.2.8` is published and has clean registry installation evidence for Codex and
Claude on macOS plus native Windows installation and engine checks. The deterministic engines and host adapters are
implemented; model selection for the optional inspector remains explicitly unevaluated. The standard `plugin/` shim
still requires an explicit local engine, while the npm installer carries and installs that engine into a permanent
local directory.

For verified behavior and remaining work, read [release readiness](docs/development/status.md), the [release contract](docs/development/release-contract.md) and the [plan](docs/development/plan.md). Historical naming and migration details are in the [naming record](docs/development/reviews/2026-10-16-boxbox-rename.md).

## Contributing

Start with the [maintainer documentation](docs/development/README.md) for architecture, inspection stages, storage contracts and repeatable change patterns.

```bash
bun install
bun run check
```

`check` runs identity and dependency checks, test suites, TypeScript type checking and development installer shell syntax checks. Follow [AGENTS.md](AGENTS.md) for contribution and authoring rules. BoxBox is released under the [MIT License](LICENSE); the installer and engine packages declare `MIT` and ship the license file. The ten synthetic preset examples are separately marked CC0-1.0.

Product naming is managed from [`product.json`](product.json); see the [rename procedure and code-length boundaries](docs/development/product-identity.md).
