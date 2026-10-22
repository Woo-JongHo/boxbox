# BoxBox 0.2.4 Python/native local candidate verification

Date: 2026-10-22 KST

## Scope and binding

This report covers the frozen **local candidate**, not a CI-produced archive and not the earlier c18 candidate.

- Archive: `/Users/jonghoPro/woo/00_project/98_BoxBox/dist/installer/boxbox-plugin-0.2.4.tgz`
- SHA-256 before and after all work: `2b43d24eabfdde00ae8019b204aabd2cc8d04f1604a8ffd540ec3170606649f0`
- Fresh isolated root: `/tmp/boxbox-python-native.TflF0A`
- Raw evidence: `/tmp/boxbox-readiness/python-native-evidence.XWwScu`
- Full-check result supplied by main: 648 pass, 5 existing parser skips, 0 fail, with TypeScript and shell checks passing.
- SSH/Windows delivery was intentionally held pending the main audit instruction. No remote bytes were sent.
- The earlier c18 candidate and its evidence were not modified.

## Fresh installation and doctor

The exact archive was installed with `--codex --claude --hud` under subprocess-scoped `HOME`, `XDG_DATA_HOME`, `XDG_CONFIG_HOME`, `CODEX_HOME`, `CLAUDE_CONFIG_DIR`, and npm cache paths. The installer created independent Codex and Claude 0.2.4 roots under the fresh root. It did not change the ordinary `codex` command. Installer output is `install.log`; the installed inventory is `installed-files.txt`.

The installed Codex runtime launcher ran `doctor --json` successfully:

- `ok=true`, `runtimeUsable=true`
- Node 22.22.3 and Python 3.14.2
- embedded base and recommended preset fingerprints loaded
- two approved convention records
- isolated user config path absent and isolated project config path absent
- standalone alignment available

The first unsandboxed diagnostic invocation accidentally inherited the caller's normal HOME and only read config metadata; it was discarded as acceptance evidence. `doctor.stdout` is the repeated correctly scoped result and names only the disposable paths.

## Unknown Python assignment-value boundary

Fixture `python_unknown.py` is the retained meaningful quote implementation with consecutive `subtotal`, `discounted`, and `total` calculations.

Installed public CLI results:

- Check returned the product's diagnostic status 1 and detected one three-row `table` group with axes `name > equal > assignment-value`, `misaligned=1`, `edits=2`.
- Approval fact `v1|python|-|table|name>equal>assignment-value` was `unknown`, `proofComplete=false`, with reason `no matching convention`.
- Guide returned status 1, `ok=false`, and empty conventions/guides. It did not inherit the simple-assignment approval.
- Align preview and apply each returned status 2 with `ALIGN_NOT_ELIGIBLE` and `approval denied: no matching convention`.
- The before, after-preview, and after-apply SHA-256 values were all `bcaa36507954fe1d1933c5e44dbb939bc7540f63377b985c4d38575cb8aa802b`.
- Final Check reproduced the same group and unknown fact.

An independent Python assertion parsed the file, verified the calculation names/order, and evaluated all 180 products of 5 unit prices × 4 quantities × 3 discounts × 3 shipping values against `max(0, unit_price*quantity-discount)+shipping`: 180/180 passed.

## Approved-regression journeys

The approved Python simple-assignment and TypeScript top-level call-declaration fixtures both followed Check → Align preview → Align apply → Check → second Align.

- Their initial Check status was 1 because each fixture was intentionally misaligned.
- Every preview, apply, final Check, and second Align returned status 0.
- Python final Check reported `py-simple-assignments`, proof complete, and `misaligned=0`.
- TypeScript final Check reported `ts-sourcefile-call-declarations`, proof complete, and `misaligned=0`.
- The after-apply and after-second hashes match for each fixture, proving byte idempotence.
- Independent assertions checked syntax, declaration/assignment order and exact values/arguments. They passed. The TypeScript approved contract also aligned call-close parentheses and semicolons, as expected from its four axes.

Raw command JSON, stderr, exit-status files, fixtures, hashes, and `independent-assertions.txt` are retained in the evidence directory.

## Native Codex HUD acceptance

Only the existing `~/.codex/auth.json` was copied into the fresh candidate CODEX_HOME at mode 0600 after asserting the target did not exist. No credential bytes were printed. Candidate-scoped `codex login status` reported `Logged in using ChatGPT`.

The candidate app-server daemon was stopped before launch, then the installed `/tmp/boxbox-python-native.TflF0A/home/.local/bin/boxbox-codex` ran in an actual PTY from the generated disposable Git project. Evidence captured both owned tmux panes:

- normal Codex folder-trust prompt for `/private/tmp/boxbox-python-native.TflF0A/project`;
- normal trust accepted only for that generated disposable fixture;
- hook-review prompt appeared; **Continue without trusting (hooks won't run)** was selected;
- upper pane reached the authenticated Codex 0.163.0 prompt with GPT-6.1-Sol and the exact project path;
- companion pane rendered `BoxBox 0.2.4 | engine ready | approved 2` and the exact pinned project.

The receipt line remained explicitly `project history (not current session) receipt: unknown ...`; this does not claim hook delivery or host acceptance.

The owned tmux server was killed. Candidate daemon stop was invoked, and its remaining candidate-owned `pid-update-loop` helper was terminated by exact root/PID match. The temporary candidate auth copy was deleted, the source auth hash before/after matched, and no process containing the disposable root remained. The disposable CODEX_HOME config/trust state remains only inside the retained scratch root and did not alter the live Codex profile.

## Claude status-line boundary

The exact installed Claude status-line command from the generated candidate settings was invoked with native Claude status JSON input against the disposable project:

1. ready: `BoxBox 0.2.4 | engine ready | approved 2`
2. after the parent shell created an owned malformed `.boxbox/config.json`: `engine not-ready | approved ?`
3. after the parent shell removed that exact file and empty directory: ready restored

All three outputs retained `session receipt: unknown ... | host unverified`, so no receipt or hook acceptance is inferred. This verifies the candidate status-line entry and ready/error/recovery renderer boundary. A full Claude interactive screen was not needed for this bounded engine/status-line check and was not run; existing normal Claude authentication/live profile was untouched.

## Result

PASS for the requested local candidate boundaries: exact archive installation and doctor, unknown Python detection/guide refusal/Align invariance, approved Python and TypeScript regression workflows, independent 180-case behavior, authenticated native Codex upper + candidate HUD ready, and Claude candidate status-line ready/error/recovery. SSH/Windows remains deliberately pending the main audit instruction.

## Post-audit cleanup correction (2026-10-22 KST)

The independent audit found that the normal folder-trust action had persisted the exact disposable-project table in the candidate-only `codex/config.toml`. Therefore the initial cleanup was incomplete at report time, even though no live profile was changed. After the finding, the exact two-line table for `/private/tmp/boxbox-python-native.TflF0A/project` was removed with compare-before-replace. All other candidate config bytes and mode 0600 were preserved. Sanitized verification now records zero occurrences of that project path/table, no temporary candidate auth file, and no candidate-root process. The authoritative closure proof is `python-native-cleanup-proof.txt`; the independent review remains unchanged as the historical finding.
