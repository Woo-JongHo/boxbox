# Codex continuous BoxBox HUD surface investigation

Date: 2026-10-21. Read-only investigation; no repository implementation, global Codex config, plugin registration, trust, credentials, or installation changed. Temporary files are under `/tmp/boxbox-codex-hud-surface-20261021/`.

## Result

Installed Codex CLI 0.163.0 has a continuous native footer, but its content is selected from a closed set of built-in item identifiers. The examined version exposes no supported arbitrary command-backed status line, custom plugin footer item, or Claude-style AbovePrompt module registration. BoxBox cannot truthfully promise a persistent custom HUD merely by installing the existing plugin or configuring a SessionStart context message.

A separate terminal companion is the practical route without modifying Codex itself: a dedicated tmux pane or tmux status bar around the unchanged Codex CLI, with a BoxBox read-only status renderer. This is a BoxBox launcher/terminal feature, not a native Codex plugin UI API. A plain `codex` invocation will not automatically launch it unless an explicit shell wrapper/alias is installed. Do not silently shadow the user's existing `codex` command. The installed `tmux` is 3.6b, available at `/opt/homebrew/bin/tmux`. This report did not implement or run a companion UI.

Codex Desktop is a separate surface. The current plugin UI quickstart promises an optional iframe inside ChatGPT, while MCP tools work in ChatGPT and Codex. This is not evidence for a persistent Codex Desktop footer. Do not claim one without a documented registration surface and native rendering evidence.

## Installed host and exact source

Commands:

```sh
pwd
git status --short --branch
codex --version
codex --help
codex app-server --help
codex app-server generate-json-schema --help
command -v codex
ls -l /Users/jonghoPro/.local/bin/codex
ls -l /opt/homebrew/bin/codex
```

Observed `codex-cli 0.163.0`. Local launcher resolves through `/opt/homebrew/bin/codex` to the npm installation at `/opt/homebrew/lib/node_modules/@openai/codex/bin/codex.js`.

Exact matching upstream tag lookup:

```sh
git ls-remote https://github.com/openai/codex.git refs/tags/rust-v0.163.0 refs/heads/main
git clone --depth 1 --branch rust-v0.163.0 --filter=blob:none --sparse https://github.com/openai/codex.git /tmp/boxbox-codex-hud-surface-20261021/codex
git sparse-checkout set codex-rs/tui/src codex-rs/core/src/config codex-rs/protocol/src codex-rs/app-server-protocol/schema
git rev-parse HEAD
```

Annotated tag object: `129b8ec7ee6f4511557a4856279f529025c25af4`.
Peeled commit used for all source findings: **`83086188ae0614bd882818ff1aa23f3194962012`**.
The local binary reports the same release version; byte-for-byte reproducibility against this source was not established.

Pinned primary source:

- [StatusLineItem enum](https://github.com/openai/codex/blob/83086188ae0614bd882818ff1aa23f3194962012/codex-rs/tui/src/bottom_pane/status_line_setup.rs#L56): fixed Rust enum, kebab-case serialization, no custom command or plugin item variant.
- [Unknown item warnings](https://github.com/openai/codex/blob/83086188ae0614bd882818ff1aa23f3194962012/codex-rs/tui/src/chatwidget/status_surfaces.rs#L120): unknown IDs are ignored and warned once after thread initialization.
- [Configured item parsing](https://github.com/openai/codex/blob/83086188ae0614bd882818ff1aa23f3194962012/codex-rs/tui/src/chatwidget/status_surfaces.rs#L470): configured strings are parsed to known enum values.
- [TUI config type](https://github.com/openai/codex/blob/83086188ae0614bd882818ff1aa23f3194962012/codex-rs/config/src/types.rs#L920): `status_line: Option<Vec<String>>`, no command field.
- [Invalid item regression test](https://github.com/openai/codex/blob/83086188ae0614bd882818ff1aa23f3194962012/codex-rs/tui/src/chatwidget/tests/status_and_layout.rs#L2951): unknown IDs emit a warning, rather than becoming content. This upstream test was read, not executed.
- [Workspace headline source](https://github.com/openai/codex/blob/83086188ae0614bd882818ff1aa23f3194962012/codex-rs/tui/src/app/background_requests.rs#L209): built-in workspace headline reads account workspace messages. It is not a local plugin output channel and should not be repurposed for BoxBox.

Representative valid footer item IDs include `model`, `model-with-reasoning`, `reasoning`, `current-dir`, `project-name`, `hostname`, `git-branch`, `pull-request-number`, `branch-changes`, `run-state`, `permissions`, `approval-mode`, `context-remaining`, `context-used`, `five-hour-limit`, `weekly-limit`, `codex-version`, `used-tokens`, `thread-id`, `thread-name`, `workspace-headline`, and `task-progress`. Existing IDs describe host state, not BoxBox rule/check state.

## Actual installed config acceptance probes

Raw result: `/tmp/boxbox-codex-hud-surface-20261021/strict-config-probes.json`.
Each probe used a separate temporary CODEX_HOME containing only its own `config.toml`, no auth copy, no model turn, closed stdin, and argv `codex --strict-config app-server --stdio`.

| Config | Exit | Observed result |
|---|---:|---|
| `[tui] status_line=["model","codex-version"]` | 0 | Accepted, empty stderr |
| `[tui] status_line_command="printf BoxBox"` | 1 | Unknown configuration field `tui.status_line_command` |
| `[tui] status_line={command="printf BoxBox"}` | 1 | Invalid type: map, expected a sequence |

These are config-loading probes, not visual TUI tests. The rejection is observed in the actual installed binary. The enum restriction and invalid-ID handling were established by exact-version source inspection. No invented custom key should be added to the user's profile.

## Official documentation inspected

Downloaded current official Markdown and schema into the scratch directory:

- [Developer commands](https://learn.chatgpt.com/docs/developer-commands#configure-footer-items-with-statusline): `/statusline` toggles and orders existing footer items and persists to `tui.status_line`.
- [Configuration reference](https://learn.chatgpt.com/docs/config-file/config-reference): footer setting is a list of item IDs. It does not document a custom command callback.
- [Current JSON schema](https://developers.openai.com/codex/config-schema.json): `status_line` items are strings, array type; schema alone does not prove every string is a renderable ID, hence source inspection above.
- [Plugin packaging](https://developers.openai.com/plugins/build/plugins): discovery, skills, MCP, assets, hook manifests; no AbovePrompt or `uiModules` Codex TUI module contract located.
- [MCP/UI quickstart](https://developers.openai.com/plugins/build/app-quickstart): optional UI is an iframe inside ChatGPT; cannot infer a persistent Codex CLI or Desktop HUD.

Current docs disagree on defaults/null hiding in places. Avoid relying on default ordering or null semantics for this task. A valid explicit list is supported, but configuring the built-in footer cannot display BoxBox custom data.

Hook `statusMessage` describes hook progress. SessionStart additional context enters model input; neither is a persistent dynamic BoxBox widget. Existing receipts also do not by themselves prove the host rendered any HUD.

## Implementation constraints for the parent

1. Keep one read-only BoxBox status data contract and use thin host renderers.
2. Claude-specific UI can use its own documented renderer, independently verified by the other investigation. Do not copy that manifest field to Codex.
3. For Codex CLI, add an explicit launcher/companion command with live status, or limit the claim to on-demand conversation status. A launcher should preserve CLI argv, exit status, terminal restoration, existing config, plugin hooks, and sandbox/trust choices.
4. A tmux implementation should own only its created session/pane or per-window options. Do not overwrite global/user tmux status settings or close pre-existing panes on exit.
5. Provide a clear fallback when tmux/TTY is unavailable, with accurate labeling. Windows native tmux support cannot be assumed; do not claim this as a Windows persistent HUD.
6. Require an actual terminal capture showing initial render, status refresh after evidence changes, ordinary Codex input, resize/exit cleanup, and unchanged global settings before claiming the companion works.
7. No shell alias or persistent host settings were created by this investigation.
