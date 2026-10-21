# Product, development and distribution layout

The product source of truth is `product/`. Development consumes it; product code does not import development code.
`bun run check:layout` enforces this direction for static imports, re-exports, dynamic imports and require calls.

| Area | Owner | Included in the public installer |
|---|---|---|
| `product/engine/` | Runtime and inspection implementation | Only the public CLI dependency graph, bundled for Node |
| `product/rules/` | Shared rules, surface data and public preset | Four reference documents and validated public preset records |
| `product/plugin/` | Hand-authored host templates | Projected into each supported host payload |
| `product/installer/` | Installer and permanent local launcher | Explicit installer file list |
| `product/packages/` | Engine package entry and metadata | Selected package metadata and bundled code |
| `development/` | Tools, corpus, experiments, host definitions and evidence | Excluded |
| `test/` | Tests and synthetic fixtures | Excluded |
| `docs/user/` | User installation guidance | Only explicitly selected package README files are shipped |
| `docs/development/` | Plans, implementation, research and reviews | Excluded |
| `plugin/` | Generated marketplace payload | Input to the host-specific installer projection |
| `dist/` | Generated packages | Only the selected installer tarball is a publication candidate |

## Generation contract

Edit plugin templates in `product/plugin/` and shared references in `product/rules/references/`.
Run `bun run sync:plugin` to recreate every file in `plugin/`, including a missing output folder.
The generator checks all generated files, executable launchers and unexpected additions. It refuses unknown files and
symbolic output paths rather than deleting content or writing through links. `--check` reports drift without writing.
`package.json` owns the version; `product.json` owns the product identity and npm installer name.
Product manifest templates use `@BOXBOX_VERSION@`; generation stamps output manifests and leaves all product sources unchanged.

Both marketplace manifests intentionally keep `./plugin`. That directory is tracked as a generated projection because
marketplace installations need files in the repository. The npm builder synchronizes it before building its payload.
`dist/` stays gitignored and is recreated by the build scripts.

```text
product/plugin + product/rules/references -> sync:plugin -> plugin/
product/engine + product/rules/presets    -> pack:cli    -> dist/boxbox-<version>.tgz
product/installer + plugin/ + engine     -> pack:installer -> dist/installer/boxbox-plugin-<version>.tgz
```

Installed engines keep preset records in `rules/presets/recommended/`. `rule-data.ts` resolves this location consistently
from source and from bundled Node code. The public CLI still excludes raw write runners, research tools and fixtures.
The internal Node artifact remains a separate development artifact.

## Development installation

`development/skills/boxbox/` contains only the development skill and metadata. Its `engine` and `rules` links point to
the product sources, so default link installs use live source edits. `development/install.sh --copy` dereferences the
links into an ownership-marked development copy, includes the skill-local `@/*` → `engine/*` mapping, and copies the
pinned runtime packages plus the TypeScript platform package after dependency preflight. It does not copy test fixtures
or research data. Development source execution still requires Bun. Public installation uses the npm installer and Node instead.

Engine TypeScript modules use `@/` for imports within `product/engine/`. The one static module exception is
`typescript/layout-policy.ts` loading `../../rules/base/typescript-layout.json`, which is owned by `product/rules/`.
The runtime `new URL(..., import.meta.url)` paths in `hook.ts`, `report.ts` and `rule-data.ts` also remain relative
because they locate files rather than importing engine modules. The layout checker enforces this boundary.

## Verification

`bun run check` runs identity drift, the product dependency check, tests, TypeScript checks and development shell syntax.
The layout regression tests rebuild the marketplace plugin from an empty output, detect output edits, propagate source
edits and refuse unexpected files. Existing installed-artifact tests pin the exact outer and nested package file lists,
exercise isolated installation and repair, remove cache/origin paths, and run the permanent engine and read-only hooks.

Historical review commands and recorded evidence retain their original paths. Current instructions use this layout.
This directory separation controls package contents. A public Git repository would still expose tracked development
material; a separately published repository would be a distinct release decision.

Host contracts checked on 2026-10-20: the existing `.codex-plugin/plugin.json` remains a supported compatibility format
under the [current OpenAI packaging contract](https://developers.openai.com/plugins/build/plugins), and
[Codex hook compatibility variables](https://learn.chatgpt.com/docs/hooks) remain documented. This migration retains
that host format and the existing Claude default component discovery. Isolated acceptance was measured with Codex
0.163.0 and Claude Code 2.1.286; native Windows and interactive session behavior are separate checks.
