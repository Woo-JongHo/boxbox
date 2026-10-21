# Codex persistent HUD launcher implementation

## Ownership

Only `product/hud/codex.mjs` and `test/codex-hud-launcher.test.ts` were authored. Other workers' changes were preserved. No plugin sync, installation, commit, publication, user configuration, or native model request was performed.

## Implemented behavior

- `node <plugin>/scripts/hud/codex.mjs --plugin-root ABS [--codex ABS] [-- CODEX_ARGS...]` launches real Codex in the upper pane and sibling `status.mjs --plugin-root ABS --root ABS --host codex --watch` in a four-line lower pane.
- A private randomized tmux server uses `/dev/null` as its configuration. Existing tmux sessions are not modified; nested launches fail with an actionable explanation.
- Main pane focus is selected before attaching. A temporary startup gate prevents Codex exiting before pane setup completes. Main-pane exit status is written before the owned server closes and is returned by the launcher.
- Main Codex arguments are stored privately and passed directly to `spawn`, preserving quotes, newlines, empty arguments, shell metacharacters and the user's configuration/permission arguments. tmux shell-command arguments are passed directly, with tmux-specific trailing-semicolon escaping for paths.
- The starting project follows `-C DIR`, `-CDIR`, `--cd DIR`, and `--cd=DIR`. The HUD remains pinned to this project. Initial remote, worktree, resume, fork and noninteractive subcommands are rejected because their roots cannot be observed faithfully. Changing projects inside Codex requires restarting the launcher.
- macOS/Linux require existing tmux and an interactive terminal of at least 12 rows. Native Windows is explicitly unsupported. No silent package install, alias change, profile change, trust grant, approval override, or sandbox override is introduced.
- Setup/attachment errors and normal detach kill only the owned server and remove temporary state. Interrupt handlers also close the owned server. An uncatchable process kill is outside this cleanup guarantee.

## Evidence

- Installed `codex --help`: Codex 0.163.0 directory/worktree/remote flags confirmed. Installed tmux 3.6b man page confirms direct argv shell-command execution and special trailing-semicolon parsing.
- Seven focused Bun tests / 46 assertions passed. Full output: `/tmp/boxbox-codex-hud-tests-20261021.log`.
- `node --check product/hud/codex.mjs` and `bunx tsc --noEmit` passed.
- Product JavaScript aligner and TypeScript test aligner were applied successfully; parser verification reported Node/TypeScript success. Tests and type checking were rerun after alignment.
- Real tmux PTY test used an explicit fake Codex shell executable that printed `FAKE CODEX MAIN PANE`, slept three seconds, and exited 17. Upper pane and bounded lower BoxBox display appeared, the owned server exited, and the launcher returned 17. Raw terminal output and result: `/tmp/boxbox-codex-hud-tmux-smoke-20261021.json`.
- This PTY result proves the launcher/tmux presentation and exit propagation, not real Codex session acceptance. The parent owns real native host integration and independent review.
- The source-checkout plugin lacks the installed runtime descriptor in this smoke, so the HUD truthfully showed `engine unknown` and unobserved project history. No ready/host-accepted claim is made.
- No TODO, `test.skip`, `test.only`, `describe.skip`, or `describe.only` placeholder was found in the owned files.

## Integration notes

- Shared HUD worker corrected watch output to fit the four-row pane without a trailing newline; the final PTY run used that fix and retained the BoxBox header.
- Packager must copy both HUD modules as siblings and create the explicit `boxbox-codex` wrapper, adding the installed absolute `--plugin-root` before user arguments.
- There is no custom Codex footer API used here. This is a real Codex terminal inside an isolated tmux layout. It intentionally does not alter ordinary `codex` invocation.
