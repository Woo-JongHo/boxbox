# History rewrite of 2026-10-22

On 2026-10-22 the history of `main` was rewritten once: the `Co-Authored-By` trailer lines were removed from the messages of 67 commits.
Authors, dates, trees and file contents are unchanged (the tip tree is byte-identical), so only commit hashes differ.
Documents and recorded evidence written before this date cite the old hashes; this table maps each changed commit to its new hash.

132 of 137 commits changed hash. The first 5 commits (before the first affected commit) are unchanged.

| Old | New | Subject |
| --- | --- | --- |
| `06fa1f9` | `ffdee2b` | Rename to placeholder xxx, translate to English, extend TS table kinds |
| `d598fb8` | `2f3db6f` | Add design, plan, agent rules and cross-review record |
| `94dedd7` | `a5fe284` | Pass the repository's own alignment check (T1) |
| `c1f63e9` | `f751a7a` | Prove whitespace-only edits with token-stream checks (T2) |
| `c0c7293` | `f7e3259` | Align imports as one section-wide table (T2.5) |
| `841fdcc` | `d96190c` | Re-parse aligned output with official parsers (T3) |
| `4de6939` | `18e81a3` | Add mutation tests and the TEST_COMPLETED review folder (T3.5, T3.6) |
| `d0759ed` | `05593fb` | Set row floors per kind (T4) |
| `636ed41` | `d809eee` | Make Go alignment report-only by default (T5) |
| `57d0f43` | `a1b0a14` | Emit one versioned result JSON from every aligner (T6) |
| `b44a772` | `7062d64` | Close M1 and plan nested tables before data (T7) |
| `c32a481` | `2876bb8` | Align the nested call layer in declaration and call-statement tables (N1) |
| `d8e002a` | `4367cc9` | Align literal lists inside declaration and call-statement tables (N2) |
| `46aa86f` | `318aaee` | Take declaration outlier rows to the vertical form (N3) |
| `a2c293e` | `4e20e1e` | Align guard rows and declaration subscript cells (N4) |
| `885bc97` | `e33ab33` | Align assigned call rows on the Python line engine (N5) |
| `bc91ef9` | `54ccd28` | Sync SKILL.md with the nested-table kinds and pin aligner test timeouts |
| `7170688` | `acde30d` | Pin the judged corpus for TypeScript and Python (D1) |
| `241092c` | `ccd30bf` | Collapse corpus tables into ranked signature types (D2) |
| `ea87b4f` | `65849ff` | Fix cross-review findings on the corpus census (D2) |
| `47b36bf` | `afc93cd` | Finish M1.5: judging, promotion, measures, edge inputs, Swift and Kotlin (D3-D7) |
| `4ea1cd5` | `ab43a2e` | Add a batch watchdog to the corpus census |
| `6a96ea3` | `f06dd0c` | Move the pattern signature into the shipped engine (M1.7 P1) |
| `9cd11c3` | `9cdb79a` | Plan the language model and distribution milestone (M1.8 S0) |
| `3779adb` | `1db421d` | Add the charter as layer 0 of the rule stack (M1.8 S1) |
| `616aef8` | `a9983fb` | Add the grammar as layer 1 and a measured line-width basis (M1.8 S2) |
| `c26e9fe` | `1fc449d` | Narrow the first scope to TypeScript and Python; defer Java (M1.8) |
| `7aaf31d` | `88249cf` | Map engine tables to grammar patterns through surface data (M1.8 S3) |
| `8ec4356` | `0dc25e0` | Add the check report with safety checks and alarms (M1.8 S3.5, part 1) |
| `b60b7dc` | `24a5908` | Design the authoring flow for new and modified code (M1.8 S3.5-S3.6) |
| `dde00ed` | `331dcf4` | Compare report alarms against a pre-edit baseline (M1.8 S3.5, part 2) |
| `fc6104b` | `b0bf905` | Separate paragraphs by attribute and import the engine through @/ |
| `6f8d2a5` | `9b4927a` | Record the define-then-guard exception, touched-files-first rollout and Korean report text until S8 |
| `c5e4402` | `801f05d` | Pre-triage the top corpus types with Codex into a review queue (M1.8 S3.5, part 3) |
| `84df1b3` | `63257e8` | Group corpus-judge paths by root and export, so the join calls share a shape |
| `dab8dc5` | `6c3ea64` | Narrow the paragraph attribute and keep original statement order (Codex review) |
| `997df52` | `e02f960` | Add read-only Claude Code authoring hooks (M1.8 S3.6) |
| `0c7f205` | `769d9d0` | Rewrite readCensusReport for readability |
| `9325897` | `24271de` | Add alarm A12 and remove stray semicolon padding outside tables |
| `75a1f3e` | `d40abd5` | Plan the pattern DB as the checker's lookup source (S5a-S5e) and record the learning-DB review |
| `4baea59` | `02e7d7d` | Look up every table in the pattern DB, report-only (M1.8 S5a) |
| `2f7bf88` | `4e960c6` | Record AI token usage for hooks and Codex calls |
| `cd35b1f` | `2898ac8` | Add example and decision records that run as tests (M1.8 S5b) |
| `2e196d3` | `12f4604` | Track model, effort and accuracy of AI use for a deployment cost estimate |
| `c969417` | `d14bf91` | Design the model evaluation: price canon, same-condition rules, statistical accuracy, escalation (E1) |
| `ff992ac` | `edd7412` | Write a pre-registrable evaluation protocol with enforced same-condition manifests |
| `74a7731` | `ec4fec9` | Write the Registered Report manuscript with Codex Astra as co-reviewer |
| `76e744c` | `871e969` | Write the evaluation methodology manuscript; keep the service paper separately |
| `8338798` | `32e1a72` | Add the two-layer benchmark: broad single runs for performance, stratified repeats for stability |
| `4c30cd3` | `a5ce152` | Add the public CLI, safe write pipeline, packaging and release tracking |
| `09ca855` | `2b819cf` | Package the plugin for Claude Code and Codex from one plugin/ folder |
| `884f06a` | `97944a4` | Translate code, tests, rules and shipped docs to English |
| `5e47bdd` | `96bf898` | Prepare the BoxBox distribution workspace [checkpoint] |
| `c25b335` | `8c54f99` | Add Python column layout examples |
| `31276de` | `57ca1b7` | Compare BoxBox with upstream agent architectures |
| `34581a7` | `7461ae6` | Record the chacada plugin candidate delivery |
| `93b5b4f` | `df3d355` | Restore approved formatting after a clean plugin install |
| `c0d81b3` | `486f4da` | Build verified GitHub release candidates |
| `485f96f` | `8185fa3` | Show installed BoxBox status inside Codex |
| `30e3356` | `288c067` | Read the hook receipt paths reported to Codex |
| `6913f91` | `19b5f84` | Checkpoint: import working tree from deploy snapshot (post-REL8) |
| `f164eec` | `b8660b5` | Record REL9 real-host acceptance evidence |
| `2f91a97` | `54eb548` | Ship the first two approved preset rules and align contracts |
| `443a3e5` | `91ee7c4` | Record the first preset-approved format journey |
| `45b29b0` | `a798b80` | Add the MIT license and run verify on ubuntu and macOS |
| `b7e678c` | `3e4c154` | Fix the probe-timeout race and track the Codex marketplace file |
| `39d3592` | `39aeeac` | Make the probe-timeout fake spin past its timeout |
| `10f0767` | `fd7254e` | Add contributing guide, changelog, issue templates, fresh status |
| `43d8fbd` | `665c313` | Add the one-pass rename script and refresh REL6/REL9 status |
| `4e146bb` | `bc17bc9` | Record the census-backed DATA2 candidate order |
| `6628666` | `e9a176b` | Integrate preserved GitHub main changes into BoxBox |
| `7d5583c` | `db3e2e3` | Record candidate pipeline and Codex HUD verification |
| `4327c6e` | `58d653b` | Verify the exact candidate on Linux WSL |
| `ec78ec8` | `6f1c670` | Merge branch 'm1-safety-proof' into ci/github-candidates |
| `4324426` | `0afd603` | Fix hosted parser verification for candidate 0.2.2 |
| `a291675` | `a135651` | Record independent integration audits and hosted CI diagnosis |
| `6e74c93` | `489964b` | Merge BoxBox development structure and candidate pipeline |
| `f9f6b8d` | `cce87ca` | Record verified 0.2.2 candidate and Codex delivery |
| `e8362d2` | `d84944e` | Record verified BoxBox 0.2.2 delivery |
| `b33f35e` | `11a7965` | Record native Codex hook verification and Windows boundary |
| `07f568c` | `93744d2` | Merge pull request #4 from Woo-JongHo/verify/codex-native-hooks |
| `57231c1` | `1c3bb7e` | Implement matrix-first plugin authoring workflows |
| `3811e34` | `77a70cd` | Record current candidate native verification |
| `9b20c44` | `0c5bf8d` | Record current candidate verification limits |
| `1152779` | `8a85874` | Add bounded Python assignment column projection |
| `d75c9dd` | `501f964` | Record Python candidate readiness evidence |
| `35b6178` | `c1d6364` | Normalize Windows evidence permissions |
| `1e0c29e` | `c577bf1` | Record verified cross-platform CI candidate and delivery |
| `a4e14a9` | `41ccd4d` | Reconcile bounded pattern and HUD verification records |
| `6bf7e76` | `794c48c` | Verify Claude plugin identity after installer transitions |
| `66eb978` | `05ca6bc` | Verify native plugin and HUD configuration lifecycles |
| `522887d` | `67ccba4` | Record exact-artifact lifecycle verification |
| `5ec7ee4` | `1f1bde1` | Align the trailing comma of object property rows |
| `d5913a5` | `17ad349` | Compose engine common modules grid-first |
| `fa451eb` | `af7bd02` | Document grid-first authoring and agent cost rules |
| `d0896de` | `b34df88` | Bump version to 0.2.5 |
| `148f298` | `7488c20` | Align product engine sources on the comma and call envelope axes |
| `dc4f618` | `d4771a4` | Align test sources on the comma and call envelope axes |
| `aedb254` | `24a5e1f` | Align development tools on the comma and call envelope axes |
| `c88e5c3` | `3f8c693` | Point current docs at the renamed boxbox repository |
| `924481b` | `a32723d` | Remove the unready line-engine languages |
| `b415f20` | `db07b90` | Remove the opt-in terminal HUD |
| `c0f3883` | `b7a85b7` | Propose per-host model and effort assignment and open issue 020 |
| `eebfbb4` | `c1edf1b` | Assign the inspector's model and effort from one source (#6) |
| `6c31dde` | `85d10ae` | Let the engine list column sets and check requested axes (#6) |
| `a7e0664` | `d07f770` | Measure per-step token usage from session records (#6) |
| `ba819a9` | `fcd4799` | Propose the /boxbox -monitor usage and change report and open issue 021 |
| `5e97c34` | `998a592` | Record the inspector baseline and read subagent records (#6) |
| `e25e71a` | `4ef4cd5` | Pre-register the inspector model pilot (#6) |
| `8e95196` | `d0b5bea` | Record the inspector model pilot results and correct earlier figures (#6) |
| `fe9cfef` | `011bd44` | Copy the development agent files into the layout test workspaces |
| `765b37f` | `1b613ae` | Resolve test fixture paths with fileURLToPath on Windows |
| `a92654f` | `79bc24c` | Give the Python colon column one space after the longest cell |
| `c2a4120` | `0193fc4` | Count newlines inside multi-line strings when masking |
| `1697323` | `ff78daf` | Keep Python field tables whole across annotation shapes and defaults |
| `aa3f008` | `eebd7b9` | Refuse line-engine tables whose columns would follow wide characters |
| `b5f3dfb` | `a660d6a` | Detect Python parameter and keyword-argument rows ending in a comma |
| `ea1df1e` | `c15708e` | Copy the development agent files into the layout test workspaces |
| `fb58f07` | `2627911` | Merge pull request #14: Fix Python table gaps found on a production RPA codebase |
| `01f7617` | `8e6e49d` | Merge pull request #5: Implement matrix-first BoxBox plugin workflows |
| `a403da5` | `9a42a9a` | Archive unreferenced REL10 lifecycle evidence outside the tree |
| `21bb742` | `5470ba1` | Merge pull request #15: Archive unreferenced REL10 lifecycle evidence outside the tree |
| `123e0c7` | `8858107` | Bind candidate smoke reruns to the producer artifact ID |
| `28e81cd` | `0ead482` | Merge pull request #16: Bind candidate smoke reruns to the producer artifact ID |
| `b87c18a` | `ef11de5` | Create a draft GitHub release from a pushed version tag |
| `741882f` | `af922ff` | Merge pull request #17: Create a draft GitHub release from a pushed version tag |
| `b0e6100` | `4437c41` | Describe the four-language scope in all three root READMEs |
| `b7e5400` | `8e73013` | Merge pull request #18: Describe the four-language scope in all three root READMEs |
| `b0909c0` | `15f0b36` | Drop title prefixes from the issue forms and follow the Kubernetes layout |
| `a861e44` | `5860960` | Merge pull request #20: Drop title prefixes from the issue forms and follow the Kubernetes layout |
| `fb20963` | `aeb8692` | Stop labeling issues from the issue forms |
| `d507de8` | `58cc1a4` | Merge pull request #21: Stop labeling issues from the issue forms |
