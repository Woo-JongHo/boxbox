# Evidence scopes

`check.log` is the pre-dot 565-pass baseline. `check-complete.log` is the missing-axis-note failure. `dot-contract-fixed.log` records the correction. `check-final.log` is the later child-deadline failure. `alignment-retry.log` is the unchanged targeted retry. `check-verified.log` is the final successful whole-suite run (571 pass, 5 skips, 0 fail).

Initial blocked reviews remain historical. Sonnet closure, metadata review and GLM closure address the implemented engine/skill corrections. Sonnet library closure covers the record/schema/validator design; two small diagnostic guards recommended by that review have direct negative-case evidence. Reviewers did not execute tests. The initial GLM audit read changing source; its closure used the immutable inline request with tools disabled. Later align.ts/result-json.ts padding changes have token-preservation and fresh-syntax evidence.

`archive-source-match.json` shows the final source rebuild is byte-identical to the installer exercised in `installed-transcript.json`. Isolated host registrations and launchers were tested; live profiles and native model sessions were not changed.
