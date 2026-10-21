# Root README localization

Date: 2026-10-21. The user requested Korean, English and Chinese READMEs.

- English reference: [README.md](../../../README.md).
- Korean: [README.ko.md](../../../README.ko.md).
- Simplified Chinese: [README.zh-CN.md](../../../README.zh-CN.md).

All three contain the same language navigation and explain that linked detailed documentation is primarily English.
The English content is preserved, including the existing uncommitted maintainer-documentation link.
[AGENTS.md](../../../AGENTS.md) records the user-authorized exception for the root README set and requires updating
all three together. Other repository prose remains English. Runtime, plugin artifacts and approved rules are unchanged.

## Verification

[Mechanical parity](2026-10-21-readme-localization-evidence/parity.json) passed: four identical fenced code blocks,
20 identical link targets in order, matching heading hierarchy, existing local link targets, no placeholders and
clean whitespace for the README/AGENTS diff. The report records the exact README SHA-256 hashes.
No runtime suite was rerun for this translation-only change. No language-policy test exists in the inspected checkout;
translation synchronization is a maintainer instruction, not a new automated CI gate.

[Sonnet 5.5](2026-10-21-readme-localization-evidence/sonnet.md) requested four wording corrections. Korean CC0 marking,
native-host-event acceptance and rule wording were aligned with the English reference; Chinese now distinguishes
development-use engines from engines merely described as unfinished.
[Final Opus 5.5](2026-10-21-readme-localization-evidence/opus.md) confirmed all four corrections and returned PASS.
Both passes were read-only with tools and MCP disabled. Full model responses remain in the evidence directory.
