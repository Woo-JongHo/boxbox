# boxbox Distribution and Competitive Readiness

Status: Draft
Date: 2026-09-27

## Conclusion

boxbox does not compete by orchestrating more agents. Its core is being a conservative checker: it never modifies rows whose structure it cannot be sure of, and it mechanically proves content preservation, idempotence and minimum row counts. The distribution structure preserves that trust by keeping one skill source and thin per-host install adapters.

## Current product

- TypeScript uses AST and LSP boundaries; the other seven languages use a shared line engine and per-language profilers.
- Install paths exist for Claude Code, ZCode, Codex and Pi, with a separate Claude plugin manifest and Codex agent TOML.
- Baseline regression: 9 test files, 106 pass, 0 fail, 386 assertions.
- Install lifecycle, manifest identity, discovery descriptions and CI become automated verification targets for the first time in this work.

## Structures adopted from comparable projects

| Project | Observed strength | Adopted scope |
|---|---|---|
| Ponytail | Per-host install instructions for Claude, Codex, Copilot, Pi and OpenCode, with small lifecycle hooks | Per-host install matrix and real discovery verification |
| Caveman | One rule source delivered through each agent's native install method | Single source + adapter structure, with measured support status |
| Oh My Claude Code | Separates the CLI from in-session skills and documents execution surfaces per provider | Documentation that never confuses install surfaces with execution surfaces |
| Oh My OpenAgent | Separates core from per-harness editions and productizes a doctor and installer | Core checker vs host adapter split; a future doctor command |
| Gajae Code | Isolates provider and subscription differences behind adapters and a live catalog | Declare support by capability, not by model name |

Large team runtimes, provider routers and MCP bundles are not adopted. boxbox is an inspection tool, not an orchestration suite; such features only increase install size and failure surface.

## Distribution verification matrix

| Layer | Automated verification | Real host verification |
|---|---|---|
| Core | Per-language preservation, idempotence, golden, trap and minimum-row tests | Stress corpus of representative real repositories |
| Package | package/plugin/marketplace version, identity and path consistency | Release artifact install |
| Install | link, copy, uninstall, rerun, user-file preservation | Discovery and invocation in Claude, ZCode, Codex and Pi |
| Agent | Read-only boundary of the Claude markdown and Codex TOML | Edit tools blocked in each host |
| CI | Bun test, TypeScript noEmit, shell syntax | macOS and Linux, later Windows install smoke tests |

## Remaining ship blockers

1. No public remote or release tag yet.
2. A LICENSE must be added after the distribution terms are chosen.
3. No property-based fixtures yet for all 13 TypeScript grid kinds.
4. Claude and Pi installs are at the documentation or local-path stage, with no real host smoke receipt.
5. Large edits in the stress corpus need manual sample review to confirm they are semantically desirable.

## Next steps

1. Pin the full TypeScript grid kind matrix.
2. Add a read-only `doctor` command that diagnoses runtime, dependencies, manifests and host discovery.
3. Produce install/discover/invoke/uninstall receipts for the four hosts on macOS and Linux.
4. Decide the license and public repository location, then cut a release candidate.
5. After the real release, track install success rate and false-positive/false-negative fixtures as product metrics.

## Sources

- Ponytail: https://github.com/DietrichGebert/ponytail
- Caveman: https://github.com/JuliusBrussee/caveman
- Oh My Claude Code: https://github.com/Yeachan-Heo/oh-my-claudecode
- Oh My OpenAgent: https://github.com/code-yeongyu/oh-my-openagent
- Gajae Code: local revision `28e375925cf5cf2887b030a693b7e7f8a9a391b4`
- Claude read-only audit: run on 2026-09-27. External local sources were outside the Claude sandbox and could not be read directly; that comparison was supplemented by a Codex local read-back and review of the official repositories.
