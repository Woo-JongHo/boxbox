# Implementation contract for the first public release

2026-10-04 · baseline for continuous development. It does not mean a completed release or an approved public channel.
The user-chosen scope is core TypeScript and Python features + the engine CLI and the agent plugin.

## Scope and support evidence

| Item | Implementation baseline | Real support verdict |
|---|---|---|
| Languages | TypeScript, Python | developed on existing fixtures and local runs; public artifact verification is separate |
| Runtime | pack experiments with Node 22 or later as the candidate | currently local Node 22.22.3; Bun stays a development and build tool |
| OS | macOS and Linux as the first verification targets | macOS artifact evidence and native Windows 0.2.1 explicit TypeScript/Python CLI acceptance (2026-10-21). The Linux CI setup is not evidence of artifact acceptance |
| Hosts | Windows Codex local test first (user direction 2026-10-16); Claude adapter compatibility retained | the `plugin/` folder installs in isolated Claude Code 2.1.286 and Codex 0.160.1 homes (2026-10-07); real host acceptance with the published engine is unconfirmed |
| Other languages | keep the existing development engines | no promise of the same support quality in the first public CLI |
| Python | a runnable python3 is required for fixes | fixes refused when missing or failing |

The minimum Node minor, Linux distributions and architectures, and host versions are frozen after artifact and host measurements.
Native Windows Node 24.12.0 / Python 3.14.0 / Codex 0.157.1 passed isolated registration and explicit CLI formatting.
Native host event delivery and the final OS/host support matrix remain unconfirmed.

## Public command boundary

- `check`: a read-only check. It keeps the groups and parse status of the current Result schemaVersion 1.
  check's `parse=not-run` does not mean re-parse verification was completed.
- `format`: fixes only when token preservation, a runnable parser, human-approved rules and the optional formatter order are all connected.
  If any condition is not connected, it refuses explicitly. Temporary bypass options used during implementation are never published.
- `init`: creates a versioned project config without overwriting existing user files.
- `doctor`: reports the availability of the runtime, parsers, config, approval data and release files. It never reports something unimplemented as healthy.

CLI arguments, exit codes and error JSON are pinned by implementation and tests in REL4. The product version 0.2.1 is development metadata,
and the release version is undecided. Changes to the Result/config schemas must come with a version change and a migration policy.

## Write surface inventory

| Current entry point | Current role | Public release handling |
|---|---|---|
| `typescript/06_align-tables.ts --write` | AST alignment, token and diagnostic checks, multi-pass | connected only through the public command that goes through safe replacement and the approval/formatter gates |
| `python/06_align-tables.ts --write` | shared line alignment, preservation and diagnostic checks | connected through the same public gate |
| `typescript/00_normalize-imports.ts --write` | import splitting and reordering | excluded from the first public automatic-fix allowlist |
| `typescript/00_expand-interface-members.ts --write` | expanding compressed members | excluded from the first public automatic-fix allowlist |
| `typescript/07_wrap-conditions.ts --write` | line breaks in condition chains | excluded from the first public automatic-fix allowlist |
| `typescript/08_function-map.ts --scaffold` | generating function-map comments | excluded from the first public automatic-fix allowlist |
| `typescript/09_observe-shapes.ts` | local evidence cache | no permission to modify sources. Public exposure is a later decision |
| corpus, AI evaluation and development fix scripts | development/research | excluded from the public engine artifact |

This is not a list of repository scripts to delete. Until the package file allowlist and command dispatcher tests enforce the release
boundary, this table alone is not a claim that bypasses are blocked.

## Human decisions and freeze points

The product name `boxbox` / `BoxBox` was confirmed on 2026-10-16. The public installer candidate is `boxbox-plugin`, selected under the user's authorization to choose an available npm name. Private engine artifacts retain the core ID `boxbox`. The license, publication permissions and public channel still need decisions before REL11; the local implementation remains `private: true`. Local builds, packs and isolated install experiments are
included in the continuous-progress direction, but that is not approval to run commit/tag/push/publish automatically.

Observation data and AI suggestions are never automatically promoted into human-approved conventions or decisions.
Approval candidate material can be prepared, but real approval history is never written on someone's behalf.

A separate audit was skipped this session at the user's direction. Tests, type checks and real runs are kept.

## Product naming decision — 2026-10-16

The user selected `boxbox` as the product, CLI and skill name and `boxbox-plugin` as the public npm installer candidate; display names use `BoxBox` and environment variables use `BOXBOX`. The previous `xxx` / `XXX` placeholders are retired. This naming change does not publish either release artifact.

Public npm installer candidate: `boxbox-plugin` (selected on 2026-10-16 after checking availability); the private engine, core CLI, skill and plugin remain `boxbox`. npm authentication is complete; publication remains pending. The standard plugin shim requires an explicit local engine and has no registry fallback. The npm installer carries that engine tarball for both host adapters.

Naming confirmation (2026-10-16): the user selected `boxbox` as the final product name.
