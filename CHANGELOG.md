# Changelog

All notable changes to this project are documented here. The format follows
[Keep a Changelog](https://keepachangelog.com/en/1.1.0/); the first release, 0.2.5,
is published as a pre-release.

## [Unreleased]

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
