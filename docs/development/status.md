# Release readiness

Updated: 2026-10-20 (product/development layout migration) · Base: branch `m1-safety-proof`

## Goal and current verdict

The first public scope is **core TypeScript and Python features + the CLI + a thin agent plugin**. The immediate user-selected target is a **Windows Codex test on another PC** (2026-10-16).
Safe writes, the Node package, the public CLI foundation, config layers, approval proofs and the formatter core are implemented.
GUIDE and format are connected in the public CLI and the installed artifact. The plugin folder `plugin/` installs in both
Claude Code and Codex. **This is not a completed public release.**

- [Execution TODO](plan.md): the canonical source of status and next work
- [Real implementation](implementation.md): structure, execution paths, limits
- [Real corpus DB](corpus-data.md): provenance, observations, candidates, examples, verification numbers
- [First release contract](release-contract.md): support candidates and surfaces excluded from publication
- [Handoff for verification by another AI](handoff-2026-10-05.md): code map, 12 held IDs, reproduction commands and independent review questions
- [Release tracking harness](../../development/harness/README.md): run history DB (`runs.jsonl`, `latest.json`) and a report against the REL table

## Layout migration — 2026-10-20

The source/development/distribution separation is implemented; [layout.md](layout.md) owns the directory contract.
Product sources are in `product/`, internal tools and data in `development/`, fixtures in `test/fixtures/`, and docs in
`docs/user/` and `docs/development/`. `plugin/` is completely regenerable and `dist/` remains generated output.

Current-tree verification: **452 pass / 5 existing skips / 0 fail**, TypeScript and shell syntax passed; the plugin guard and both isolated host registrations passed.

Sonnet 5 review fixes passed its follow-up. The first Opus audit identified dangling output links and stale paths;
those were fixed with regression coverage. **The required Opus follow-up is unexecuted because the provider returned
a session-limit error (reset shown as 20:20 Asia/Seoul).** It remains the audit blocker; no lower model was substituted.
See [the migration evidence](reviews/2026-10-20-layout.md). Publication remains pending.

## Implemented and remaining

| Area | Implemented and verified | Remaining |
|---|---|---|
| Safe writes | parser missing/failure blocked, TS multi-pass and line-engine working-copy verification with one replacement, external-edit conflicts refused | TS native API timeout, measurements on other OSes |
| Node release candidate | isolated bin run after confirming real Node, offline and empty-npm-cache installs | Linux and supported-host checks |
| CLI | init, doctor, check, guide, format, run, status, hook, `db init/status` local user DB, synthetic approval journey on the installed artifact | DB editing, import, backup; real user approval data and host journeys |
| Config | Base → Preset → User → Project, in-memory schema 1 migration, schema 2 partial config, fingerprint | real user project journey |
| Approval and GUIDE | exact key, scope, layers; decision, example, counterexample, version and document hash checks | waiting for the human approval answer on two concrete candidates |
| Formatter | explicit command → parser → approval → BoxBox, fixed point over two full runs, verified on the installed artifact and dry-run | a real project formatter case |
| Evidence DB | 8 public repositories, 7,759 files → 18,613 table observations / 88 rule keys, 311 own functions | review and promote frequent candidates; SQLite not introduced |
| Hosts | Real local npm installer installed and repaired both isolated Codex 0.162.1 (enabled) and Claude Code 2.1.286 (1 skill, 1 agent, 3 hooks); cache-independent engines, strict validation and hook tests passed | publication approval/registry installation, native Windows and real-session acceptance (CODEX1) |
| Product finish | brand confirmed: boxbox/BoxBox, 0.2.0, private; docs and code in English (S8 done 2026-10-07) | license, channel, update/removal, release |

## Verification state

Latest dual-host installer verification: `bun run check` **440 pass / 5 skip / 0 fail** (2026-10-16); TypeScript and install-shell syntax checks passed.
The first run failed because the offline artifact install required `typescript@7.0.2` in npm's cache. After an isolated online
install populated that dependency, the full rerun passed. The five Rust/Kotlin parser skips remain unexecuted, not passes.
Claude Code 2.1.286 and Codex 0.162.1 both accepted the renamed plugin in isolated homes; this does not prove real-session hook acceptance.

The unpublished `boxbox-plugin@0.2.0` installer is **113,430 B / 32 files**, with SHA-256
`86b16fdca7f517c5869c51fda96d15c72af2ed0646725cebb4bea87486f0be36`. Its dedicated suite passed seven tests and 219 assertions.
Real npx single-bin inference, both hosts' initial installation and repair, cache/origin removal, permanent doctor/check,
and the Codex cached launcher passed on macOS. The npm publish dry run passed; npm authentication is complete as `woojongho`. Both the initial and focused final Opus audits passed for the installer scope. Actual public publication still needs its separate decision.

The items from Sol's read-only review of the public preset boundary were fixed, and the last re-review found no further
findings in that scope. This is not a final independent audit of the whole repository.
See the [DB boundary record](reviews/2026-10-04-public-preset-db-boundary.md).

On 2026-10-06, reruns hit the default 5-second test timeout in 1–3 tests (java re-parse 5.7 s, the public CLI format refusal
loop and others — 1–2 s when run alone), because integration tests that start real toolchains (javac, tsc, formatter child
processes) exceed 5 s under full-suite load. The `test` and `check` scripts in `package.json` use `--timeout 60000`.
When citing these numbers as evidence, state the network and cache preconditions.

Latest `bun run pack:cli` (2026-10-16): `boxbox@0.2.0` tarball **40,629 B compressed / 163,240 B unpacked, 6 files**.
It carries only the CLI bundle, README, manifest and three empty preset JSONL files, and the public artifact test ran the real
Node isolated install journey. The public preset still has 0 rows.

## Next resume point

The active task is LAYOUT1: separate product sources, development-only material and generated distribution (user direction 2026-10-20). See [the layout contract](layout.md). CODEX1 registry/Windows verification remains on hold during this migration. Its acceptance criteria are in [plan.md](plan.md). Shared release work (PKG1) and DATA2 candidate verdicts remain on hold.
No preset candidate is switched to approved before human approval. Research evidence is kept separately in `~/.cache/boxbox/corpus/`;
the observation JSONL is **18,613 lines / 11,207,375 B** and the aggregated signatures **175,183 B**. Including the public repository
checkouts, the whole research cache is **715,920 KiB (about 699 MiB)**. None of this data is in the npm artifact.

The plugin user DB is created with `boxbox db init` as three empty JSONL files in `$XDG_CONFIG_HOME/boxbox` or `~/.config/boxbox`, and
`db status` prints only line counts and bytes. The three public preset JSONL files are a separate release boundary owned by the maker
and have 0 rows. The 88 candidates and 225 representative examples (213 pass, 12 held) are review material.

Release blockers: no approval data, real host and other-OS journeys, license and channel decisions, a final security review,
and **publication approval and registry installation of the selected `boxbox-plugin` installer are pending; core CLI and skill IDs remain `boxbox`**. The npm tarball excludes the research DB but
includes the 159,096 B runtime JavaScript bundle, so the CLI implementation is not kept private by design.

There is no dedicated ESLint command. `bun run check` runs tests, the TypeScript type check and install-shell syntax. The repository's
own aligner and normalizer keep the standing criteria (`misaligned=0`, `changed=0`) over the TypeScript files in
`product/engine/`, `scripts/`, `test/` and `development/harness/`, and the self-align stage of the release tracking harness verifies this on every run.

Git: branch `m1-safety-proof`, pushed to origin on 2026-10-07 (the plugin structure commit `09ca855`); the English translation is committed on top.
No npm publish or tag has been made.

## Product naming and distribution decision — 2026-10-16

The user selected **BoxBox**. Core CLI, private engine, skill and plugin IDs use `boxbox`; environment variables use `BOXBOX`.
The repository is `98_BoxBox`. `product.json` owns `displayName` and the public installer `npmName`, now **`boxbox-plugin`**.
The user authorized an available npm name after confirming they do not own npm `boxbox`. The chosen `boxbox-plugin` returned E404;
that does not reserve it. The machine is authenticated as `woojongho`; publication and real registry `npx boxbox-plugin` are pending.

The installer targets **Codex and Claude Code**, with native Windows Codex as today's test priority. It installs permanent
local engine/plugin files rather than relying on an npx cache or ZIP transfer. See [installation status](../user/codex-windows-test.md)
and the [current migration record](reviews/2026-10-16-boxbox-rename.md).
Earlier naming evidence remains historical: [first pass](reviews/2026-10-12-boxbox-rename.md), [EggBox pass](reviews/2026-10-12-eggbox-rename.md).
The separate full-product audit and release remain open.

Syntax-case collection now precedes new layout policy (user direction 2026-10-12). The first version-pinned TS/Python inventory and 291 parser-verified synthetic examples are in `development/corpus/syntax/`; see [scope, counts and remaining variants](research/2026-10-12-syntax-case-inventory.md). All alignment decisions remain unreviewed; these records are not approved presets.

Syntax collection continuation: added 1,200 multirow variants and 16 expected syntax-rejection counterexamples, reproducible via `development/tools/build-syntax-variants.py`. Combined 1,507 inputs passed expected parsing outcomes. Alignment decisions remain unreviewed; this is bounded TS/Python collection, not exhaustive combination or aligner verification.
