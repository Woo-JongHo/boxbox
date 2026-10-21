# BoxBox npm plugin installation on Windows

The selected public npm name is **`boxbox-plugin`**. The product remains **BoxBox**; plugin, skill and private engine IDs remain `boxbox`.
The user authorized an available package name, and npm returned E404 for `boxbox-plugin` on 2026-10-16. That does not reserve the name.
`box-box` was considered first, then rejected because npm's unscoped similarity rules compare punctuation variants of existing names. `boxbox-plugin` and its punctuation-free form both returned E404; registry publication remains the final name-acceptance check.
This machine is authenticated to npm as `woojongho`. The candidate has not been published, so public registry installation is not yet verified.

## Target commands after publication

```powershell
npx.cmd boxbox-plugin
npx.cmd boxbox-plugin --codex
npx.cmd boxbox-plugin --claude
```

`npx.cmd` is the PowerShell form that avoids an npm `.ps1` execution-policy error. The first command detects installed Codex and Claude Code CLIs and installs the matching plugins. Flags select a host explicitly.
The installer needs Node.js 22.22.3 or later with npm and at least one supported host CLI. It does not require Bun, a ZIP transfer, the author checkout, or a global BoxBox engine.

The npm package copies its payload into permanent per-user host directories before registering plugins. The nested engine is installed from the included local tarball; only its pinned TypeScript dependency and platform package need npm access. Removing npm's cache must not remove the installed plugins.

## Local verification before publication

```sh
bun run pack:installer
npx --yes 'file:/absolute/path/to/dist/installer/boxbox-plugin-0.2.1.tgz' --codex
```

The `file:` package spec tests the real npx binary-selection mechanism. A bare absolute filename can be interpreted as a command by npm 10. It does not prove that public `npx boxbox-plugin` currently returns this product.
The root development package and nested private engine still use `boxbox`; `product.json` npmName owns only the public installer.
The public installer candidate uses `UNLICENSED` metadata for this test preview; a general open-source license is undecided.

## Updating the local Codex candidate from 0.2.0

Codex rejects the same marketplace name at a different versioned installation path. For this local candidate update,
replace the old BoxBox marketplace registration once, then run the new installer:

```powershell
codex.cmd plugin marketplace remove boxbox-plugins
npm.cmd exec --yes --package 'C:\path\to\boxbox-plugin-0.2.1.tgz' -- boxbox --codex
```

Use your installed OpenAI Codex CLI (`codex.cmd` is the standard Windows npm entry). This explicit 0.2.0 → 0.2.1
procedure was verified with native Windows Codex 0.157.1. The installer does not migrate marketplace sources automatically.

After installation, restart the selected host and use its BoxBox skill. In Codex, select the skill in the picker and review `/hooks` before trusting the exact current definitions. Claude Code includes its read-only inspector and discovers the plugin hooks at the default `hooks/hooks.json` path. The installer does not change host trust settings.
Start with one disposable TypeScript file and ask for a read-only check. Hooks must keep their records in host plugin data, and checks must not create project `.boxbox/` files.

The preset includes approved TypeScript top-level single-call declarations (2+ rows) and Python simple assignments
(3+ rows at one indentation). Those patterns can format without a custom formatter or approval DB. Other patterns
remain ineligible until approved. Python formatting requires `python3`. `check --json` reports approval eligibility;
`format --dry-run` verifies the write pipeline without changing the original. Only an explicit `format` writes.
Native Windows Node 24.12.0 / Python 3.14.0 / Codex 0.157.1 passed isolated installation and explicit TypeScript/Python
formatting on 2026-10-21. Native host hook event delivery remains unverified; installation and direct CLI checks do not prove it.

Official contracts: [Codex plugin packaging](https://developers.openai.com/plugins/build/plugins), [Codex hook trust](https://learn.chatgpt.com/docs/hooks), [Claude plugin marketplaces](https://code.claude.com/docs/en/plugin-marketplaces), [Claude hook exec form](https://code.claude.com/docs/en/hooks#command-hook-fields).
