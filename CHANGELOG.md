# Changelog

All notable changes to this project are documented here. The format follows
[Keep a Changelog](https://keepachangelog.com/en/1.1.0/). Version 0.2.6 is merged
and tagged; its GitHub pre-release remains a draft. See the
release documentation when preparing a version.

## [Unreleased]

### Added

- Update BoxBox from Claude Code with `! update boxbox`. A SessionStart notice
  names the command when a newer release is tagged (checked once a day;
  `boxbox update --snooze` hides it for seven days), and the update shows one
  progress line per step, verifies the installed version and prints these
  patch notes.
- Session modes `off`, `check`, `align` and `refactor` (`boxbox mode`, per
  project or `--global`, overridden by `BOXBOX_MODE`) decide what the hooks do.
- `boxbox statusline` adds a one-row `▣ BB·MODE` segment at the right edge of
  Claude Code's status line through a version-free shim.
- Recognize standalone multiline scalar-literal arrays in `const` declarations
  asserted `as const` as TypeScript `LIST` tables. Align existing commas only;
  do not insert a missing comma or add automatic write approval.

### Fixed

- TypeScript object-row detection no longer loses rows to state left over from
  an earlier group.
- `sync:plugin` compares plugin paths with `/` on Windows, which had blocked
  the installer build there.

## [0.2.6] - 2026-10-25

### Added

- Expanded TypeScript layout detection and authoring guidance for comparable
  property and comma-bearing rows, logical prefixes, return guards, multiline
  calls, and comparison or ternary expressions inside matching call arguments.
  Detection and guidance do not approve these shapes for automatic fixes;
  automatic formatting stays limited to the already approved TypeScript
  declaration and Python assignment rules.

### Changed

- Public `align` remains horizontal-only: it changes approved spacing while
  preserving physical lines and indentation. B-style authoring and refactoring
  can use the expanded layout guidance without changing that command contract.
- TypeScript import normalization preserves whether a trailing comma was
  present in compact and multiline forms.
- Existing automatic limits remain: the import 120-column/20-column outlier,
  four-operand conditions, and call outliers. General 120-column width remains
  an authoring consideration.

### Fixed

- TypeScript layout checks now account for existing punctuation and nested
  expression columns while keeping braced and unbraced return-guard groups
  separate.
- Condition authoring preserves tokens, comments and structural AST, reuses
  existing multiline condition boundaries, and refuses unsafe rewrites.
- Import layout-only writes detect external edits before replacing a file.

## [0.2.5] - 2026-10-22

### Added

- Public engine CLI (`boxbox`) with `init`, `doctor`, `check`, `guide`,
  `format`, `run`, `status`, and `db init/status` for TypeScript and Python.
- Thin agent plugins for Claude Code and Codex: session hooks that check
  changed files read-only, a read-only inspector agent, and a skill that
  drives the engine through a permanent local Node launcher.
- The first two approved alignment rules, shipped in the recommended preset:
  top-level single-call variable declaration tables (two or more rows) in TypeScript and
  simple assignment tables (three or more rows at one indentation level)
  in Python — each with positive examples, forbidden-shape counterexamples,
  and hash-pinned public decision documents.
- Format safety pipeline: optional configured formatter, human-approval proof,
  re-parse comparison, and a two-run byte fixed point with atomic replace.
- Setup-free refusal guarantees: rows that cannot be decomposed losslessly
  are never rewritten; parsers that fail or go missing block writes.

- JSON and YAML inspection and approval-gated structured writes through the same
  CLI; their default preset rules and examples remain unapproved.
- One source for the model and effort of the plugin's AI-judgment roles
  (`product/models.json`), stamped into the Claude and Codex agent definitions.
- Engine support for listing column sets and checking requested axes.

### Changed

- The installer and engine packages declare the `MIT` license and ship the `LICENSE` file; the installer
  previously declared `UNLICENSED`.
- Python tables: the `:` column now keeps one space after the longest cell
  (`NAME : type`), the same as the `=` column (issue #7).
- Python field tables stay whole across string annotations, unions and default
  values instead of splitting into partial tables (issue #11).
- Rows that end in a comma — keyword arguments, parameters and tuples — are
  detected as tables and align the `,` column (issue #8).
- Line-engine tables whose columns would follow CJK characters are refused,
  because the display width of those characters depends on the viewer (issue #8).

### Fixed

- Newlines inside multi-line strings are counted when masking source lines.
- Test fixture paths resolve with `fileURLToPath` on Windows.

### Removed

- Line-engine profiles for Java, Go, Rust, JavaScript, C, C++, Swift and Kotlin;
  the public scope is TypeScript, Python, JSON and YAML.
- The opt-in terminal HUD.

### Security

- Records from plugin hooks stay in the host's plugin data folder; nothing
  is written into the inspected project.

### Development

- Separate product sources, development tools and generated distributions.
- Issue/PR intake, required-parser verification, and manually generated same-archive release candidates.
- A `release` workflow: a pushed `v*` tag on `main` builds and smoke-tests the archive once and creates a
  draft GitHub pre-release with the archive, `SHA256SUMS`, `candidate.json` and the matching changelog section.
  It never publishes; a maintainer publishes the draft by hand.
- Candidate smoke reruns consume the producer's artifact by ID instead of guessing the run attempt.
- An on-request installed-plugin status panel for Codex in the development checkout.
