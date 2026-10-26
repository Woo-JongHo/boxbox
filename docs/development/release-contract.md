# Implementation contract for the first public release

2026-10-04 · baseline for continuous development. It does not mean a completed release or an approved public channel.
The user expanded the first public target on 2026-10-21 to TypeScript, Python, JSON and YAML + the engine CLI and
the agent plugin. The implementation baseline now covers all four languages. JSON/YAML read-only inspection and
approval-gated structured writes are implemented and verified; their default preset rules and examples remain
unapproved. [FORMAT1](plan.md#planned-scope-expansion--format1-json-and-yaml) records the scope and remaining gates.

## Scope and support evidence

| Item | Implementation baseline | Real support verdict |
|---|---|---|
| Languages | TypeScript, Python, JSON, YAML | all four enter Check, Guide, Align and Format through the shared CLI; installed public-artifact tests cover their current boundaries |
| Default write approvals | TypeScript, Python | the recommended preset contains two approved rules and four examples; JSON/YAML writes require a complete separately supplied approval proof and otherwise refuse. Issue #26's additional TypeScript detection and authoring guidance does not add approved rules or widen automatic fixes |
| Runtime | Node >=22.22.3 with npm | measured Node 22.22.3 on macOS/WSL and 24.12.0 on native Windows; Bun stays a development and build tool |
| OS | macOS, native Windows and Linux/WSL candidate verification | clean CI `ebfe6a…` passed six host lifecycle cells; Linux/Windows hosted smoke passed and hosted macOS smoke is queued |
| Hosts | Codex and Claude Code | exact unpublished artifacts have real host-manager acceptance; authenticated sessions, UI/hooks and published-registry journeys have separate evidence gates |
| Other languages | keep the existing development engines | no promise of the same support quality in the first public CLI |
| Python | a runnable python3 is required for fixes | fixes refused when missing or failing |

The executable Node minimum is `22.22.3`. Supported Linux distributions, architectures and host-version ranges are
not inferred from that minimum. The corrected local archive `1f1343e9…` and the separate clean CI archive `ebfe6a…` each passed the native
lifecycle matrix. Their measured hosts are Codex 0.163.0 and Claude 2.1.286 on macOS, Codex 0.163.0 and Claude 2.1.280 on
Linux/WSL, and Codex 0.157.1 and Claude 2.1.280 on native Windows. The
[lifecycle record](proposals/2026-10-22-artifact-lifecycle.md) separates initial failures, corrected passes and final
CI-byte verification. The HUD configuration cells recorded there belong to 0.2.4; the HUD was removed afterwards.
These results do not establish authenticated host UI/hook acceptance or a final release support matrix.

## Public command boundary

- `check`: a read-only check. It keeps the groups and parse status of the current Result schemaVersion 1.
  check's `parse=not-run` does not mean re-parse verification was completed.
- `guide`: read-only guidance from the effective approval data; authoring guidance also identifies unsupported and unapproved shapes. The TypeScript authoring workflow may use detected layout shapes as writing vocabulary, but detection is not approval.
- `align`: writes only approved horizontal-whitespace alignment, preserving physical lines and indentation, and never runs an external formatter; `--dry-run` preserves the original.
- `format`: fixes only when token preservation, a runnable parser, human-approved rules and the optional formatter order are all connected.
  If any condition is not connected, it refuses explicitly. `--dry-run` preserves the original. Temporary bypass options used during implementation are never published.
- `init`: creates a versioned project config without overwriting existing user files.
- `doctor`: reports the availability of the runtime, parsers, config, approval data and release files. It never reports something unimplemented as healthy.

CLI arguments, exit codes and error JSON are pinned by implementation and tests in REL4. Version 0.2.6 is merged and tagged, with a verified GitHub draft pre-release that has not been published. The next release number, 0.2.7, will be assigned when the accumulated changes are prepared for release. A draft is not a published release; npm publication and publishing a GitHub draft are separate decisions. The [release notes template](release-notes-template.md) defines the reusable changelog structure; the release workflow extracts the matching version section. Changes to the Result/config schemas must come with a version change and a migration policy.

## Write surface inventory

| Current entry point | Current role | Public release handling |
|---|---|---|
| `typescript/06_align-tables.ts --write` | AST alignment, token and diagnostic checks, multi-pass | connected only through the public command that goes through safe replacement and the approval/formatter gates |
| `python/06_align-tables.ts --write` | shared line alignment, preservation and diagnostic checks | connected through the same public gate |
| structured JSON/YAML adapter | source-range horizontal alignment with syntax and preservation checks | connected through the same public gate; no JSON/YAML rule is default-approved |
| `typescript/00_normalize-imports.ts --write` | import splitting and reordering | excluded from the first public automatic-fix allowlist |
| `typescript/00_expand-interface-members.ts --write` | expanding compressed members | excluded from the first public automatic-fix allowlist |
| `typescript/07_wrap-conditions.ts --write` | line breaks in condition chains | excluded from the first public automatic-fix allowlist |
| `typescript/08_function-map.ts --scaffold` | generating function-map comments | excluded from the first public automatic-fix allowlist |
| `typescript/09_observe-shapes.ts` | local evidence cache | no permission to modify sources. Public exposure is a later decision |
| corpus, AI evaluation and development fix scripts | development/research | excluded from the public engine artifact |

This is not a list of repository scripts to delete. The CLI builder rejects references to the excluded writers, and the public-artifact
test pins the package file list and installed command behavior. These checks define the current artifact boundary; they do not complete
REL11, approve additional rules, license the preview package or authorize publication.

## Human decisions and freeze points

The product name `boxbox` / `BoxBox` was confirmed on 2026-10-16. The public installer candidate is `boxbox-plugin`, selected under the user's authorization to choose an available npm name. Private engine artifacts retain the core ID `boxbox`. The existing GitHub MIT LICENSE is retained at the repository root. Installer and engine package metadata declare MIT and ship the `LICENSE` (decided 2026-10-22); the local implementation remains `private: true`. The 0.2.6 delivery artifact is a verified GitHub draft pre-release; npm publication and publishing the draft remain separate from that delivery target.

Observation data and AI suggestions are never automatically promoted into human-approved conventions or decisions.
Approval candidate material can be prepared, but real approval history is never written on someone's behalf.

Prior independent source/evidence reviews and the GLM audit are scoped to their recorded candidates. The 0.2.6 candidate
still requires the planned read-only GLM 5.3 review on frozen source; earlier reviews do not establish its completion.

## Product naming decision — 2026-10-16

The user selected `boxbox` as the product, CLI and skill name and `boxbox-plugin` as the public npm installer candidate; display names use `BoxBox` and environment variables use `BOXBOX`. The previous `xxx` / `XXX` placeholders are retired. This naming change does not publish either release artifact.

Public npm installer candidate: `boxbox-plugin` (selected on 2026-10-16 after checking availability); the private engine, core CLI, skill and plugin remain `boxbox`. Name acceptance/reservation and publisher authentication are not established for a release; license/channel decisions and publication remain pending. The standard plugin shim requires an explicit local engine and has no registry fallback. The npm installer carries that engine tarball for both host adapters.

Naming confirmation (2026-10-16): the user selected `boxbox` as the final product name.
