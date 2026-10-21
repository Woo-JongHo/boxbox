# Changelog

All notable changes to this project are documented here. The format follows
[Keep a Changelog](https://keepachangelog.com/en/1.1.0/); the project has not
reached its first public release yet, so everything below is unreleased.

## [Unreleased]

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

### Security

- Records from plugin hooks stay in the host's plugin data folder; nothing
  is written into the inspected project.

### Development

- Separate product sources, development tools and generated distributions.
- Issue/PR intake, required-parser verification, and manually generated same-archive release candidates.
- An on-request installed-plugin status panel for Codex in the development checkout.
