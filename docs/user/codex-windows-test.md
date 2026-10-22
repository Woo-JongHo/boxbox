# BoxBox npm plugin installation on Windows

The selected public npm name is **`boxbox-plugin`**. The product remains **BoxBox**; plugin, skill and private engine IDs remain `boxbox`.
The user authorized an available package name, and npm returned E404 for `boxbox-plugin` on 2026-10-16. That does not reserve the name.
`box-box` was considered first, then rejected because npm's unscoped similarity rules compare punctuation variants of existing names. `boxbox-plugin` and its punctuation-free form both returned E404; registry publication remains the final name-acceptance check.
The current 0.2.5 candidate has not been published, so registry installation and publisher authentication remain unverified.

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
npm exec --yes --package '/absolute/path/to/dist/installer/boxbox-plugin-<version>.tgz' -- boxbox --codex
```

Replace `<version>` with the version in `package.json`, or use the exact archive path printed by `pack:installer`.
This tests npm's real package and binary-selection path. It does not prove that public `npx boxbox-plugin` currently
returns this product.
The root development package and nested private engine still use `boxbox`; `product.json` npmName owns only the public installer.
The repository retains its root MIT license. The public installer candidate uses `UNLICENSED` metadata and grants no
open-source rights in this test preview; alignment of release-package metadata and notices remains pending.

## Updating a local Codex candidate from an earlier version

Codex rejects the same marketplace name at a different versioned installation path. For this local candidate update,
replace the old BoxBox marketplace registration once, then run the new installer:

```powershell
codex.cmd plugin marketplace remove boxbox-plugins
npm.cmd exec --yes --package 'C:\path\to\boxbox-plugin-<version>.tgz' -- boxbox --codex
```

Use your installed OpenAI Codex CLI (`codex.cmd` is the standard Windows npm entry). The installer does not migrate
Codex marketplace sources automatically.

For Claude Code, the current installer verifies the exact user-scope plugin identity and refreshes a stale recorded
version only with `claude plugin update boxbox@boxbox-plugins --scope user`. If host registration may have changed and
installation then fails, preserve the printed destination, phase receipt and backup paths; this is partial-state
retention, not an automatic host rollback. See the [installer README](../../product/installer/README.md) before recovery.

After installation, restart the selected host and use its BoxBox skill. In Codex, select the skill in the picker and review `/hooks` before trusting the exact current definitions. Claude Code includes its read-only inspector and discovers the plugin hooks at the default `hooks/hooks.json` path. The installer does not change host trust settings.
Start with one disposable TypeScript file and ask for a read-only check. Hooks must keep their records in host plugin data, and checks must not create project `.boxbox/` files.

The preset includes approved TypeScript top-level single-call declarations (2+ rows) and Python simple assignments
(3+ rows at one indentation). Those patterns can format without a custom formatter or approval DB. Other patterns
remain ineligible until approved. Python formatting requires `python3`. `check --json` reports approval eligibility;
`align --dry-run` and `format --dry-run` preview their respective pipelines without changing the original. Explicit
non-dry-run Align writes approved horizontal-whitespace alignment only; explicit Format writes through the broader
formatter-plus-alignment pipeline.
An earlier candidate passed isolated installation and explicit TypeScript/Python formatting with native Windows
Node 24.12.0, Python 3.14.0 and Codex 0.157.1 on 2026-10-21. That historical result does not verify the current 0.2.5
archive. Native host hook event delivery also remains unverified; installation and direct CLI checks do not prove it.

Official contracts: [Codex plugin packaging](https://developers.openai.com/plugins/build/plugins), [Codex hook trust](https://learn.chatgpt.com/docs/hooks), [Claude plugin marketplaces](https://code.claude.com/docs/en/plugin-marketplaces), [Claude hook exec form](https://code.claude.com/docs/en/hooks#command-hook-fields).
