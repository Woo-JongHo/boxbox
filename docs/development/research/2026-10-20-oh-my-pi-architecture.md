# oh-my-pi and BoxBox: architecture and distribution boundaries

Observed on 2026-10-20. This is a source comparison and a set of recommendations, not a release approval or runtime audit.

Upstream: [`can1357/oh-my-pi`](https://github.com/can1357/oh-my-pi), pinned to
[`2220e58146ebe31508e7a216242840d373e082d0`](https://github.com/can1357/oh-my-pi/commit/2220e58146ebe31508e7a216242840d373e082d0)
(commit timestamp: 2026-10-19T23:50:20+02:00). BoxBox: the current, uncommitted layout migration on
`m1-safety-proof`, based on `884f06a34752e148409bcffcd1d8d804f5d59aa6`. Local source links below describe the working tree,
not the contents of that base commit.

## Main finding

Both projects separate development inputs from consumer artifacts within one source repository. oh-my-pi uses Bun workspace
packages and a publication transformation; BoxBox uses `product/`, `development/`, generated `plugin/`, and packed `dist/`
outputs. This supports retaining BoxBox's current source layout. Repository visibility is a separate decision: a public
development repository exposes its tracked development files even when they are excluded from npm.
Evidence: [upstream workspace](https://github.com/can1357/oh-my-pi/blob/2220e58146ebe31508e7a216242840d373e082d0/package.json#L1-L11),
[upstream publication contract](https://github.com/can1357/oh-my-pi/blob/2220e58146ebe31508e7a216242840d373e082d0/scripts/ci-release-publish.ts#L10-L28),
[BoxBox layout](../layout.md).

## Runtime architecture

The diagrams show responsibility flow, not a complete or strictly linear import graph.

```text
oh-my-pi
CLI / interactive UI / RPC / embedding SDK
                  |
          coding-agent session
          /        |         \
 agent execution  tools    discovery / extensions
       |            |
 model providers   native loader -> Rust primitives

BoxBox
Claude / Codex skill, read-only inspector and hooks
                  |
           permanent launcher
                  |
          CLI: check / guide / format
                  |
       config + rules + language engines
                  |
       approval / preservation / parser gates
                  |
          atomic file replacement
```

oh-my-pi owns the agent host. Its SDK constructs sessions with model/auth selection, persistence, tools, extensions and
discovery. The agent package owns the execution loop and calls the model layer. Its native package bridges runtime calls
to Rust implementations. The packages also have cross-dependencies; their presence alone does not prove strict layering.
Evidence: [SDK responsibilities](https://github.com/can1357/oh-my-pi/blob/2220e58146ebe31508e7a216242840d373e082d0/docs/sdk.md#L1-L98),
[agent implementation](https://github.com/can1357/oh-my-pi/blob/2220e58146ebe31508e7a216242840d373e082d0/packages/agent/src/agent.ts#L1-L40),
[native boundary](https://github.com/can1357/oh-my-pi/blob/2220e58146ebe31508e7a216242840d373e082d0/docs/natives-architecture.md#L1-L7),
[coding-agent dependencies](https://github.com/can1357/oh-my-pi/blob/2220e58146ebe31508e7a216242840d373e082d0/packages/coding-agent/package.json#L538-L550).

BoxBox supplies a deterministic readability tool to an existing host. The skill invokes the same CLI as other callers;
`format` goes through the approval, parser, preservation, fixed-point and atomic-write checks. Model selection, conversation
state and agent scheduling belong to the host. The public CLI currently accepts TypeScript and Python; the development
tree retains the other language implementations.
Evidence: [public skill](../../../product/plugin/skills/boxbox/SKILL.md),
[CLI dispatcher](../../../product/engine/cli.ts), [format pipeline](../../../product/engine/common/format-pipeline.ts),
[release scope](../release-contract.md).

## Comparison

| Concern | oh-my-pi at the pinned revision | BoxBox in the current working tree | Assessment |
|---|---|---|---|
| Product responsibility | Agent host, SDK, UI, provider integration and tool runtime | Readability engine plus thin host adapters | Keep host behavior outside BoxBox |
| Source organization | Bun `packages/*` and Rust crates | `product/engine`, `rules`, `plugin`, `installer`, `packages`; development tools outside `product/` | Different sizes justify different folder schemes |
| Consumer interface | Package exports, SDK, CLI and RPC | CLI commands and versioned JSON results | BoxBox's CLI is already the useful integration seam |
| Local development | Root `dev` runs the coding-agent TypeScript source | Development skill links to the canonical engine/rules; copy installation dereferences links | Both reuse product sources |
| Publication | Source-oriented manifests are rewritten, packed and published as tarballs | Templates generate `plugin/`; builders write Node bundles and installer payloads to `dist/` | Both have explicit artifact boundaries |
| Package contents | Coding-agent's source-oriented `files` allowlist includes `src`, `scripts` and `examples` | Public artifact tests pin a narrower payload and exclude development material | Choose payloads for each product's consumers |
| Experimental tools | Public workspace contains non-published benchmark/harness packages | `development/corpus`, `harness`, tools and research docs | Exclusion from publication is independent of source visibility |
| Configuration | Defaults, global/project settings, CLI overlays and runtime overrides | Base, preset, user and project settings with provenance | Preserve BoxBox's own precedence and safety rules |
| Release promotion | Tagged `main` validation, native/binary smoke tests and ordered publication | Verification CI and local artifact/installation checks; publication remains pending | Automated promotion is the clearest future improvement |

Upstream evidence for the table: [workspace and source dev command](https://github.com/can1357/oh-my-pi/blob/2220e58146ebe31508e7a216242840d373e082d0/package.json#L1-L11),
[development scripts](https://github.com/can1357/oh-my-pi/blob/2220e58146ebe31508e7a216242840d373e082d0/package.json#L72-L87),
[source entries and package contents](https://github.com/can1357/oh-my-pi/blob/2220e58146ebe31508e7a216242840d373e082d0/packages/coding-agent/package.json#L27-L62),
[private metaharness package](https://github.com/can1357/oh-my-pi/blob/2220e58146ebe31508e7a216242840d373e082d0/packages/metaharness/package.json#L1-L26),
[settings layers](https://github.com/can1357/oh-my-pi/blob/2220e58146ebe31508e7a216242840d373e082d0/docs/settings.md#L1-L30),
[manifest transformation](https://github.com/can1357/oh-my-pi/blob/2220e58146ebe31508e7a216242840d373e082d0/scripts/ci-release-publish.ts#L239-L263),
[aggregate CI gate](https://github.com/can1357/oh-my-pi/blob/2220e58146ebe31508e7a216242840d373e082d0/.github/workflows/ci.yml#L739-L774),
[publication dependencies](https://github.com/can1357/oh-my-pi/blob/2220e58146ebe31508e7a216242840d373e082d0/.github/workflows/ci.yml#L1165-L1227).

BoxBox evidence for the table: [layout contract](../layout.md), [workspace commands](../../../package.json),
[development installation](../../../development/install.sh), [result schema](../../../product/engine/common/result-json.ts),
[config layers](../../../product/engine/common/project-config.ts), [plugin generator](../../../development/tools/sync-plugin.ts),
[CLI builder](../../../development/tools/build-cli-artifact.ts), [installer builder](../../../development/tools/build-installer-artifact.ts),
[dependency boundary](../../../development/tools/check-layout.ts), [public artifact tests](../../../test/public-artifact.test.ts),
[installer artifact tests](../../../test/installer-artifact.test.ts), [verification CI](../../../.github/workflows/verify.yml).

## What to adopt, and what to retain

1. **Keep the current source separation.** Workspace packages become useful when a component has real independent consumers
   or its own release lifecycle. A package per language or per internal module would add dependency/version work without an
   established consumer need. This is a design recommendation, not an upstream requirement.
2. **Keep source templates immutable during generation.** Upstream's publisher can rewrite manifests in place; BoxBox
   already stamps generated outputs while preserving templates. Retain that tested behavior rather than imitating the
   upstream implementation detail. Evidence: [upstream write](https://github.com/can1357/oh-my-pi/blob/2220e58146ebe31508e7a216242840d373e082d0/scripts/ci-release-publish.ts#L239-L263),
   [BoxBox regression tests](../../../test/layout.test.ts).
3. **Make release promotion consume the verified artifact.** A future BoxBox release workflow should build once, inspect
   the exact outer/nested file lists, install in clean supported environments, then publish those verified bytes and record
   the source revision/version/checksum. Existing artifact tests are useful inputs; this recommendation does not mean they
   are absent. Upstream demonstrates validation and dependency ordering before npm publication, including publishing native
   leaves before their consumers. Evidence: [native leaf gate](https://github.com/can1357/oh-my-pi/blob/2220e58146ebe31508e7a216242840d373e082d0/.github/workflows/ci.yml#L985-L1002),
   [npm ordering](https://github.com/can1357/oh-my-pi/blob/2220e58146ebe31508e7a216242840d373e082d0/.github/workflows/ci.yml#L1165-L1227).
4. **Add a host through an adapter only when needed.** oh-my-pi can discover standard skills, including Claude/Codex sources,
   and offers runtime extension registration. This suggests a possible future BoxBox host adapter invoking the existing CLI.
   Discovery alone does not establish acceptance of BoxBox's current hooks, launcher, installer or inspector.
   Evidence: [skill discovery](https://github.com/can1357/oh-my-pi/blob/2220e58146ebe31508e7a216242840d373e082d0/docs/skills.md#L23-L31),
   [providers and opt-in behavior](https://github.com/can1357/oh-my-pi/blob/2220e58146ebe31508e7a216242840d373e082d0/docs/skills.md#L85-L122),
   [extension API](https://github.com/can1357/oh-my-pi/blob/2220e58146ebe31508e7a216242840d373e082d0/docs/extensions.md#L17-L55).

## Repository privacy and the earlier repository question

oh-my-pi's visible pattern is a public source/development monorepo with separately prepared release artifacts. Its
metaharness is public source despite `"private": true`: that flag prevents npm publication. It is not a GitHub access-control
setting. Evidence: [public metaharness manifest](https://github.com/can1357/oh-my-pi/blob/2220e58146ebe31508e7a216242840d373e082d0/packages/metaharness/package.json#L1-L13),
[npm private flag](https://docs.npmjs.com/cli/v11/configuring-npm/package-json/#private).

For BoxBox, use a feature branch when its contents may share the repository's visibility. If experiments must remain private
and need remote backup or collaboration, keep them in an independent private repository. A local branch that is never
pushed is another option for local-only experiments. GitHub public forks remain public, so a public fork is not the private
development boundary. Evidence: [GitHub fork visibility](https://docs.github.com/en/pull-requests/reference/forks),
[independent repository duplication](https://docs.github.com/en/repositories/creating-and-managing-repositories/duplicating-a-repository).

If choosing a private canonical development repository and a public release repository, export an explicit, verified set
of source/payload files into the latter without merging private development history. Define whether that public repository
offers buildable source or only marketplace payloads. Exporting `plugin/` alone does not supply the standard shim's required
engine; the npm installer includes an engine tarball and a different configured launcher. Evidence:
[shim](../../../product/plugin/scripts/boxbox), [installer builder](../../../development/tools/build-installer-artifact.ts),
[layout distribution contract](../layout.md). No repository split or export automation was implemented in this comparison.

## Verification limits

The upstream checkout was read without installing dependencies or executing upstream build/release code. Findings describe
the pinned source and documented contracts; they do not certify upstream package contents or platform behavior. No private
upstream repository, hidden branch strategy or unpublished roadmap is inferred from the public checkout.

BoxBox product code, release automation and plan status were not changed by this research. The existing layout migration's
final Opus follow-up and native Windows/interactive host verification remain as recorded in the [plan](../plan.md).
The full delegated release-source inventory and bounded citation/source check are retained locally at
`/tmp/boxbox-omp-research.x9AHmD/upstream-release-report.md` and
`/tmp/boxbox-omp-research.x9AHmD/comparison-source-check.md`; the durable conclusions and pinned references are in this file.
All 22 relative links and 21 pinned source-file links/line bounds were checked. The report contains no new placeholders
or language-policy exceptions. Product tests were not rerun for this documentation-only change.
