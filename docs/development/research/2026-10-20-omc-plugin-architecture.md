# OMC and BoxBox: plugin architecture and release structure

Observed on 2026-10-20. The user confirmed the target as `Yeachan-Heo/oh-my-claudecode` (OMC), rather than a different
repository named oh-my-claude. This comparison supplements the [oh-my-pi investigation](2026-10-20-oh-my-pi-architecture.md).

Pinned upstream revision: [`6688a30e90d7285ff336af2dc5ab4b9709f1a8bc`](https://github.com/Yeachan-Heo/oh-my-claudecode/commit/6688a30e90d7285ff336af2dc5ab4b9709f1a8bc),
2026-10-18T15:36:38+09:00, version 5.7.5. BoxBox references describe the current uncommitted layout migration on
`m1-safety-proof`, based on `884f06a34752e148409bcffcd1d8d804f5d59aa6`.

## Main finding

OMC is a closer comparison than oh-my-pi because it extends an existing host. It is an orchestration plugin with its own
runtime implementation, not only Markdown prompts. Its source repository also carries development tools, tests and
generated runtime files. The visible implementation uses branches and release checks within the same repository; a
separate development repository is not a technical prerequisite. This observation does not establish whether the author
also maintains private development elsewhere.
Evidence: [plugin root](https://github.com/Yeachan-Heo/oh-my-claudecode/blob/6688a30e90d7285ff336af2dc5ab4b9709f1a8bc/.claude-plugin/marketplace.json#L9-L20),
[build and development commands](https://github.com/Yeachan-Heo/oh-my-claudecode/blob/6688a30e90d7285ff336af2dc5ab4b9709f1a8bc/package.json#L50-L75),
[release branch instructions](https://github.com/Yeachan-Heo/oh-my-claudecode/blob/6688a30e90d7285ff336af2dc5ab4b9709f1a8bc/scripts/release.ts#L305-L323).

## Runtime responsibility

```text
oh-my-pi: user -> its own agent host -> models, tools, sessions and UI

OMC:      user -> Claude Code
                      -> plugin hooks, skills and agent definitions
                      -> Node runtime / MCP / team coordination
                      -> persistent orchestration state

BoxBox:   user -> Claude Code or Codex
                      -> thin skill, inspector and hook adapters
                      -> one CLI contract
                      -> rule lookup, language engines and guarded formatting
```

These are responsibility maps, not complete import graphs. OMC documents hooks, skills, agents and state as its four
interlocking systems. Its hook manifest invokes local Node scripts, its MCP configuration invokes a bundled server, and
the build creates runtime CLI bundles from TypeScript sources. This is plugin-owned implementation running under the
host, rather than a replacement for Claude Code's complete agent runtime.
Evidence: [architecture overview](https://github.com/Yeachan-Heo/oh-my-claudecode/blob/6688a30e90d7285ff336af2dc5ab4b9709f1a8bc/docs/ARCHITECTURE.md#L7-L52),
[hook entrypoints](https://github.com/Yeachan-Heo/oh-my-claudecode/blob/6688a30e90d7285ff336af2dc5ab4b9709f1a8bc/hooks/hooks.json#L1-L53),
[MCP entrypoint](https://github.com/Yeachan-Heo/oh-my-claudecode/blob/6688a30e90d7285ff336af2dc5ab4b9709f1a8bc/.mcp.json#L1-L8),
[runtime CLI build](https://github.com/Yeachan-Heo/oh-my-claudecode/blob/6688a30e90d7285ff336af2dc5ab4b9709f1a8bc/scripts/build-runtime-cli.mjs#L1-L24).

BoxBox has a narrower responsibility: inspect or format one file through deterministic rules and safety checks. Its skill
and read-only hooks call the engine; model routing, broad work planning and conversation management stay with the host.
The standalone marketplace shim requires a configured local CLI. The npm installer instead carries that engine and
configures a permanent Node launcher. These are two installation paths to the same engine contract, not two independent
implementations. Evidence: [skill](../../../product/plugin/skills/boxbox/SKILL.md),
[shim](../../../product/plugin/scripts/boxbox), [installer builder](../../../development/tools/build-installer-artifact.ts),
[format pipeline](../../../product/engine/common/format-pipeline.ts).

## Source and distribution comparison

| Concern | OMC at the pinned revision | BoxBox working tree |
|---|---|---|
| Marketplace plugin root | Repository root: `source: "./"` | Generated subdirectory: `source: "./plugin"` |
| Product source | `src/`, `skills/`, `agents/`, `hooks/`, scripts and templates | Canonical engine/rules/plugin/installer inputs in `product/` |
| Runtime output | Compiled `dist/` and bundled `bridge/` material | Node CLI bundle, generated marketplace plugin, host-specific installer payloads |
| Development area | Source tests, root `tests/`, benchmarks, docs and scripts in the same repository | `development/`, `test/`, `docs/development/` |
| Shipped-file control | Runtime dependency traversal for generated files; npm `files` list; final archive checks | Exact plugin projection and outer/nested package file assertions |
| Runtime state | Workspace/session orchestration data under `.omc`, with a configurable external state root | Explicit `.boxbox` configuration/approval space; hook receipts in host plugin data |
| Version ownership | Package and plugin/marketplace metadata synchronized by release tooling | Root package version stamped into generated manifests from immutable templates |

Upstream evidence: [marketplace](https://github.com/Yeachan-Heo/oh-my-claudecode/blob/6688a30e90d7285ff336af2dc5ab4b9709f1a8bc/.claude-plugin/marketplace.json#L9-L30),
[npm entries and file list](https://github.com/Yeachan-Heo/oh-my-claudecode/blob/6688a30e90d7285ff336af2dc5ab4b9709f1a8bc/package.json#L1-L49),
[generated runtime contract](https://github.com/Yeachan-Heo/oh-my-claudecode/blob/6688a30e90d7285ff336af2dc5ab4b9709f1a8bc/scripts/plugin-shipping-surface.mjs#L1-L23),
[state locations](https://github.com/Yeachan-Heo/oh-my-claudecode/blob/6688a30e90d7285ff336af2dc5ab4b9709f1a8bc/src/lib/worktree-paths.ts#L1-L49),
[version synchronization command](https://github.com/Yeachan-Heo/oh-my-claudecode/blob/6688a30e90d7285ff336af2dc5ab4b9709f1a8bc/package.json#L86-L94).
BoxBox evidence: [layout](../layout.md), [marketplace](../../../.claude-plugin/marketplace.json),
[generator](../../../development/tools/sync-plugin.ts), [config](../../../product/engine/common/project-config.ts),
[hook state](../../../product/engine/common/lifecycle-hook.ts), [layout tests](../../../test/layout.test.ts),
[installer tests](../../../test/installer-artifact.test.ts).

The marketplace plugin root and the npm archive are distinct distribution surfaces. OMC's npm allowlist includes broad
directories such as `scripts` and `docs`; that is not a minimal-payload template for BoxBox. A package `files` list does not
define the Git marketplace's plugin root. Likewise, ignoring a generated directory does not prove its contents are absent
from Git: this pinned OMC checkout has tracked `dist/` and `bridge/` files, and its shipping helper explicitly supports
force-adding only the computed required generated files. BoxBox's tracked `plugin/` projection addresses a similar
marketplace need, while its npm `dist/` stays untracked.
Evidence: [OMC npm allowlist](https://github.com/Yeachan-Heo/oh-my-claudecode/blob/6688a30e90d7285ff336af2dc5ab4b9709f1a8bc/package.json#L23-L49),
[exact staging behavior](https://github.com/Yeachan-Heo/oh-my-claudecode/blob/6688a30e90d7285ff336af2dc5ab4b9709f1a8bc/scripts/plugin-shipping-surface.mjs#L691-L718),
[force-add arguments](https://github.com/Yeachan-Heo/oh-my-claudecode/blob/6688a30e90d7285ff336af2dc5ab4b9709f1a8bc/scripts/plugin-shipping-surface.mjs#L561-L565),
[BoxBox generation contract](../layout.md). Inspection used `git ls-files dist bridge`; upstream build code was not executed.

## Branches, releases and the earlier repository question

OMC CI targets `main`, `dev`, and version tags. Its PR check permits `dev`, `main`, `release/*` and `hotfix/*` as base
branches. Its release helper prints a `release/v<version>` branch sequence: build, verify/stage required generated runtime
files, make a signed release commit, and open a PR to `dev`. These are source-visible checks and instructions; they do not
prove hosted branch-protection settings or that every contribution followed this route.
Evidence: [CI triggers](https://github.com/Yeachan-Heo/oh-my-claudecode/blob/6688a30e90d7285ff336af2dc5ab4b9709f1a8bc/.github/workflows/ci.yml#L1-L14),
[allowed PR bases](https://github.com/Yeachan-Heo/oh-my-claudecode/blob/6688a30e90d7285ff336af2dc5ab4b9709f1a8bc/.github/workflows/pr-check.yml#L65-L93),
[release helper](https://github.com/Yeachan-Heo/oh-my-claudecode/blob/6688a30e90d7285ff336af2dc5ab4b9709f1a8bc/scripts/release.ts#L305-L323).

Its tag-driven publication job verifies the committed plugin runtime, builds and tests, removes known build/test mutations,
creates a staged archive with commit identity and checksums, smoke-installs that archive, and publishes that same archive
with provenance. The workflow explicitly addresses tests leaving runner-specific Node paths in hook configuration.
Evidence: [preparation and archive creation](https://github.com/Yeachan-Heo/oh-my-claudecode/blob/6688a30e90d7285ff336af2dc5ab4b9709f1a8bc/.github/workflows/ci.yml#L510-L554),
[archive installation and identity checks](https://github.com/Yeachan-Heo/oh-my-claudecode/blob/6688a30e90d7285ff336af2dc5ab4b9709f1a8bc/.github/workflows/ci.yml#L563-L598),
[exact archive publication](https://github.com/Yeachan-Heo/oh-my-claudecode/blob/6688a30e90d7285ff336af2dc5ab4b9709f1a8bc/.github/workflows/ci.yml#L610-L614).

For BoxBox, feature branches in one repository remain sufficient when their contents can share that repository's
visibility. Private remote experiments still need a private repository; adding `dev` or `release` branches to a public
repository does not create a private development area. A private canonical repository plus a selectively exported public
release repository remains an option when that privacy requirement exists, rather than a requirement imposed by plugins.
The public repository must also provide a viable engine-installation path, not just the thin plugin files.
Evidence: [GitHub repository/branch distinction and visibility](https://docs.github.com/en/pull-requests/reference/forks),
[BoxBox distribution contract](../layout.md).

## Recommendations for BoxBox

1. **Retain `product/` -> generated `plugin/` and `dist/`.** OMC's root-plugin layout is one implementation choice. BoxBox's
   smaller selected plugin directory makes its release contents easier to enumerate and does not need to become a root
   plugin to be valid. The official host contract defines paths relative to the chosen plugin root.
   Evidence: [Claude manifest paths](https://code.claude.com/docs/en/plugins-reference#path-rules).
2. **Keep the engine behind the CLI interface.** OMC needs orchestration, MCP and team runtime modules for its own product.
   BoxBox should add such modules only for an actual requirement; its existing host adapters already share one engine.
3. **Adopt exact-artifact promotion.** Extend BoxBox's existing artifact tests into the future release workflow: verify
   generated inputs, pack once, inspect outer/nested contents, install in clean supported environments, record source and
   file identity, and publish the tested archive. Keep development-machine paths out of delivered files.
4. **Choose repository visibility independently.** Decide whether experiments may be public before selecting one repository
   or a private-to-public export flow. A second repository brings export/history maintenance and is justified by privacy or
   independent ownership, not merely by having a plugin.

## Verification limits

This investigation read pinned upstream sources and current BoxBox sources. It did not install OMC, execute its scripts,
verify a registry tarball, or certify that a current Claude host accepts this exact snapshot. Workflow source establishes
configured checks, not successful hosted runs. No private upstream repository or hidden development process is inferred.
No BoxBox runtime behavior, release implementation or plan verdict was changed by the comparison. Existing final-audit and
native Windows acceptance limits remain recorded in the [plan](../plan.md).

All 15 relative links and 21 pinned source-file links/line bounds were checked. A separate bounded source-accuracy pass
confirmed the upstream claims; its full local record is `/tmp/boxbox-claude-research.frGJeu/omc-source-check.md`.
