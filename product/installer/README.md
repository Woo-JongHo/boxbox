# BoxBox plugin installer for Codex and Claude Code

The intended public command is **`npx boxbox-plugin`**. The npm package is `boxbox-plugin`; its single executable is `boxbox`, and
plugin/skill identifiers remain `boxbox`. The package is licensed under MIT and ships its `LICENSE`. Confirm the publisher's registry release before using the public command; a supplied local tarball can be tested before publication. The unrelated npm package `boxbox` is not this installer.

## Windows PowerShell prerequisites

Install Node.js **22.22.3 or newer**, npm, and at least one host CLI with plugin support: Codex or Claude Code.
Check `node --version`, `npm.cmd --version`, and `codex.cmd plugin --help` or `claude plugin --help` in a new PowerShell
terminal. Use `codex` for a native Codex executable. Standard npm-installed Windows Claude Code is detected through its
native `claude.exe`; no Bash, WSL, or script execution-policy change is required by this installer.
The core CLI requires no global install, Bun, or source checkout. Python inspection and formatting additionally require a runnable `python3`.

If `CODEX_HOME` is set for a Codex installation, it must already be an existing directory. `CLAUDE_CONFIG_DIR` is passed to
Claude unchanged. Existing host configuration is preserved through normal plugin-management commands. The installer never
edits hook trust or grants it automatically.

## Install

After an authorized public release:

```powershell
npx.cmd boxbox-plugin
```

With no arguments, the installer detects installed Codex and Claude Code CLIs and installs for every detected host. It
fails with instructions if neither is found. Select a particular host explicitly when needed:

```powershell
npx.cmd boxbox-plugin --codex
npx.cmd boxbox-plugin --claude
npx.cmd boxbox-plugin --codex --claude
```

To test a local candidate before publication, use the absolute installer tarball path instead of the registry:

```powershell
npm.cmd exec --yes --package 'C:\path\to\boxbox-plugin-<version>.tgz' -- boxbox
```

## If you added the marketplace first

Adding this repository as a Claude or Codex marketplace installs the plugin without an engine. The installer refuses to replace a same-named marketplace from another source, so remove that registration first, then rerun the installer. Removing a marketplace also removes its plugins, so only do this for a registration that points at this repository. Run the lines for your host:

```sh
claude plugin uninstall boxbox@boxbox-plugins --scope user
claude plugin marketplace remove boxbox-plugins
codex plugin marketplace remove boxbox-plugins
```

## Removing an earlier HUD

The opt-in terminal HUD (`--hud`) was removed after 0.2.4. If an earlier installation enabled it, disable it with
that installation's permanent plugin directory, which the new installer leaves in place:

```sh
node '/absolute/old/installed/plugin/scripts/hud/setup.mjs' claude '/absolute/old/installed/plugin' --disable
node '/absolute/old/installed/plugin/scripts/hud/setup.mjs' codex '/absolute/old/installed/plugin' --disable
```

Disable removes only a still-owned status-line key or launcher. Unrelated settings and later user changes are preserved.

## Updating a local Codex candidate from an earlier version

If the old installation enabled the Codex HUD, disable it first (see above), then run the new installer:

```powershell
npm.cmd exec --yes --package 'C:\path\to\boxbox-plugin-<version>.tgz' -- boxbox --codex
```

Use your installed OpenAI Codex CLI (`codex.cmd` is the standard Windows npm entry). For an installer-owned older
BoxBox marketplace, the installer verifies the previous bundle, removes its plugin and marketplace registration, and
registers the new versioned source. A failed transition attempts to restore the previous registration. A same-named
foreign marketplace is refused without removal.

The payload is copied out of npm's temporary cache into permanent, separate host directories before registration:

- Windows: `%LOCALAPPDATA%\BoxBox\Codex\<version>` and `%LOCALAPPDATA%\BoxBox\Claude\<version>`
- macOS/Linux: `$XDG_DATA_HOME/boxbox/<host>/<version>`, or `~/.local/share/boxbox/<host>/<version>` when unset

Each selected host installs the included private `boxbox` engine tarball with `--ignore-scripts --no-audit --no-fund`.
Before engine installation or host registration, each copied host payload verifies that tarball against the SHA-256 in its bundle metadata.
Missing, malformed or mismatched integrity metadata stops installation with instructions to reinstall the installer
package. This detects mixed archive bytes inside a payload; it is not a publisher signature. The installed CLI version
is checked separately. The nested engine never comes from the npm registry. Pinned `typescript@7.0.2` and its native platform dependencies still
need internet access or a primed npm cache. Installed plugins survive npm cache cleanup or deletion of the original
installer tarball. Rerunning the same version repairs shipped files and runtime while preserving other data in that folder.
If repair fails before host registration starts, the previous directory is restored. Once registration may have
changed, a failure retains the new directory, its `.boxbox-install-state.json` phase receipt and any previous backup;
the error prints their exact paths. This prevents a host registration from pointing at a deleted directory. Inspect
the host plugin and marketplace lists before recovery. Rerunning the exact installer deliberately retries a valid
receipt belonging to that same root/version/host; its replacement backup is removed only after verified success. Foreign,
malformed or symlink receipts are refused without replacement. Do not delete retained directories while a host still
references them; after removing the exact registration, restore the printed backup or reinstall. This is partial-state
retention, not an automatic rollback of host settings. Successful retries do not delete backups retained by earlier runs.

For an installer-owned local Claude marketplace, installation checks the exact user-scope plugin identity and
refreshes stale recorded versions with `claude plugin update boxbox@boxbox-plugins --scope user`. Completion requires
the intended marketplace root, version, cached manifest and engine paths to agree. A foreign/shared marketplace or
ambiguous plugin scope is refused. Older installer archives do not gain these checks: use the documented exact plugin
and marketplace removal commands below before reinstalling an older archive for rollback. Restart Claude after a change.

Restart each selected host. In Codex, select the BoxBox `boxbox` skill in the picker; in Claude Code, select the installed
BoxBox skill from its skill list. Name one TypeScript or Python file and request a read-only check first. Review the
three hook definitions in the host before relying on them. Codex skips untrusted plugin hooks: use `/hooks` to review and
explicitly trust their exact current definitions. Claude Code uses its own hook/settings review workflow.

Codex hooks use the documented Windows PowerShell override. Claude hooks use direct `command` plus `args` execution,
including variable expansion of `${CLAUDE_PLUGIN_ROOT}`, avoiding Windows shell parsing. Both adapters default to
read-only inspection, store receipts in host plugin data, and refuse a hook when the host omits its data directory.
An explicit `boxbox mode align` enables only approved horizontal alignment after matched PostToolUse calls, followed
by reinspection; `check` and `refactor` keep hooks read-only, `off` skips inspection, and Stop never writes source.
PostToolUse checks all session changes after matched file-edit or shell calls, including read-only shell calls;
it does not infer which command wrote a file. Codex exposes `exec_command` and a completed `write_stdin` through the
hook name `Bash`. Shell feedback is advisory: inspection failures add context while preserving the command's output
and exit status, so guidance, previews and tests remain readable. File-edit feedback retains its existing blocking
behavior. Stop checks session changes again and requests at most one continuation. Other tool paths may not match.
A receipt with `NO_GROUPS` means
the file was inspected but no supported table groups were found, rather than whole-file alignment coverage.
Claude's generated Windows engine commands use a Node bridge that works from Bash or PowerShell and preserves paths and
arguments literally, so no shell switch is needed.
The Claude plugin also includes the canonical read-only inspector; the Codex plugin does not include an agent.
Native Windows execution must still be verified on the destination computer.

The recommended preset includes approved TypeScript top-level variable declarations of calls and simple values (2+ rows) and Python
simple name assignments (3+ rows at one indentation). No custom formatter or approval DB is required for those exact
patterns. Other patterns remain read-only until approved. Use `check --json`, `guide --json`, then `format --dry-run`
before an explicit `format` request. A positive approved-group count does not bypass the whole-file approval gate.
Use `boxbox mode` to read the current project mode, or `boxbox mode check --global` to set the global default. A valid
`BOXBOX_MODE` overrides project and global state for the current process.

Formatters such as Prettier, Black and Ruff revert BoxBox alignment in the files they rewrite. `doctor`, `init`, `align`
and `format` warn when a project-root configuration shows one, distinguishing `runs` from `possible`. Configure the
formatter for its language and invoke BoxBox from editor, pre-commit and CI commands. `check` and `format` accept
repeated `--file` or bounded recursive `--directory`; Align remains single-file. Configured-formatter Check and
`format --dry-run` execute the configured program on working copies, keep original source bytes intact, and require
the same approval/parser/fixed-point gates as Format. Check compares the final formatter-then-BoxBox bytes with the
original, keeping source findings separate from `canonical` verification. Batch formats are atomic per file and
retain earlier completed writes when another file fails; per-group selective alignment remains deferred.

`boxbox update --check` requests an update check and reports a non-success result when the release query fails.
After registry publication, rerun `npx boxbox-plugin` to update detected hosts to the published installer. The
`boxbox update --source <checkout>` path is a development-only override that requires an absolute BoxBox checkout
and its build prerequisites; an installed launcher infers its host, while a standalone call must pass `--host`.
Success requires the selected host's installed engine to report the intended version, followed by a host restart.
Session notices never install updates themselves. `boxbox statusline --install-shim` prints an optional
version-independent Claude status-line command; `NO_COLOR` or `BOXBOX_COLOR=0` disables color.

Run `monitor --project --host auto --json` through the host's installed launcher/environment for an on-demand report.
The command requires absolute `CLAUDE_PLUGIN_DATA` or `PLUGIN_DATA` and always writes a host HTML page there, including in JSON
mode. `--html <absolute-path>` replaces the default destination inside that folder; project or outside-folder destinations are refused.
Missing plugin data produces setup guidance. `--no-paths` hides source filenames, while the returned output path stays
visible. No transcript text, commands, source content, model call or dollar cost belongs to this report. Legacy
footprints and exact Codex step attribution may be unavailable and remain labeled.

External formatters are optional. On Windows use a native executable or a Node JS entry point (`node.exe` plus script
and `{file}` arguments). Arbitrary `.cmd`/`.bat` formatters are refused with configuration guidance; BoxBox never
interpolates formatter arguments into a shell. A configured formatter failure never falls back silently to standalone mode.
`boxbox --help` prints usage without installing. `boxbox --engine-only` is for diagnosis: it prepares only the Codex
permanent local engine and skips all host checks and registration. It cannot be combined with host selection flags.

## Remove

Use the same host configuration environment as installation, and remove each installed adapter separately:

```powershell
codex.cmd plugin remove boxbox@boxbox-plugins
codex.cmd plugin marketplace remove boxbox-plugins
claude plugin uninstall boxbox@boxbox-plugins --scope user
claude plugin marketplace remove boxbox-plugins
```

Use `codex` for a native executable. Restart the host. Once its removal succeeds, its version directory above can be
deleted if desired. Keep a marketplace used by other plugins. Project `.boxbox/` approvals and personal data are not
removed. On macOS/Linux use `npx`, `npm exec`, `codex`, `claude`, and the corresponding data directory.

Official contracts: [Codex packaging](https://developers.openai.com/plugins/build/plugins),
[Codex hooks](https://learn.chatgpt.com/docs/hooks), [Claude marketplaces](https://code.claude.com/docs/en/plugin-marketplaces),
and [Claude hooks](https://code.claude.com/docs/en/hooks).
