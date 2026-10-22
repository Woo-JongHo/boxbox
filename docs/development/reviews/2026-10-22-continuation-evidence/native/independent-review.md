# Native authoring and HUD evidence review

## Verdict

The retained evidence verifies genuine Python Write and structural Refactor behavior through the exact 0.2.4 Codex
candidate, plus honest engine refusal and bounded HUD state evidence. It does **not** verify matrix alignment, native hook
acceptance, or an authenticated interactive Codex upper pane.

## Candidate and workflow binding

The installer archive recomputed to SHA-256
`c18a7da980cfcbd42bd4cfef4c1676b13a9c12759a3d4c9fc2689b0d7af0fb84`. Selected completed transcript events show
that both workflows used the candidate's installed 0.2.4 launcher. Write ran `guide --authoring` before adding `quote.py`.
Refactor read the one-Return baseline, then ran authoring Guide and Check before updating `refactor_quote.py`.

The complete raw JSONL transcripts were inspected before selection. Their event types were limited to thread/turn
boundaries, agent messages, command execution and file changes; no reasoning event was present. They were not copied
because they also contain thread IDs, usage metadata, duplicated started events and the full installed skill text.
`workflow-selected-events.json` retains the checked completion order without those fields. Raw final Check and Align
responses are retained separately.

Filesystem inspection found only `quote.py` outside `.git` in the Write project and only `refactor_quote.py` outside
`.git` in the Refactor project. The final retained files are byte-identical, and the retained Refactor baseline differs
bytewise from the result.

## Independent behavior and structure check

An independent AST/behavior pass executed the Refactor baseline and both final files over the same 180-value product:
five unit prices, three quantities, four discounts and three shipping values. Every result equaled
`max(0, unit_price * quantity - discount) + shipping`. The set includes zero price/quantity, exact and over discounts,
and multiple shipping values.

Both final ASTs have the exact four-argument signature and body sequence `Assign, Assign, Assign, Return`, with targets
`subtotal`, `discounted`, `total` and final return of `total`. The baseline body is exactly one `Return`.
`independent-180.json` records the domains, assertions and file hashes.

## Engine result and alignment boundary

Final installed Check reports valid Python syntax, `groups: 0`, `misaligned: 0`, and `approvalEligible: false` for both
files. Align returns exit 2 / `ALIGN_NOT_ELIGIBLE` because no verified approval rule applies. These results verify safe
refusal and honest reporting. Zero groups means the heterogeneous calculations received no deterministic matrix coverage;
it is not evidence that their assignment columns were aligned. No matrix-alignment claim is made here.

## HUD evidence

The sanitized Claude PTY record verifies exact-candidate ready → not-ready → ready rendering with approved count 2 →
unknown → 2. Every state retained receipt unknown/not-observed, file not run and host unverified. Hook trust and hook-output
acceptance were not exercised.

The retained Codex companion capture verifies a ready 0.2.4 lower pane with approved 2 and honest unknown/file-not-run/
host-unverified qualifiers. The authored acceptance report records companion error/recovery, but no separate raw Codex
not-ready/recovery pane capture was available in the selected source directory, so this review does not independently
promote that sequence beyond the report. The upper interactive Codex pane remained on its login menu; authenticated Write
and Refactor used direct `codex exec` instead.

### Supplemental Codex recovery evidence

The preceding missing-evidence statement records the state of the first review and is intentionally retained. A later
bounded PTY rerun supplied raw companion captures in `codex-hud-recovery/`. They independently verify the same exact
candidate's ready → malformed-config not-ready → recovered-ready sequence. Each state names version 0.2.4 and the
canonical disposable project; every state keeps the `project history (not current session)` receipt unknown, file not run
qualifiers. The pane-width ellipsis prevents the raw captures from independently displaying the source report's later
`host unverified` qualifier. The candidate archive digest matches the retained 0.2.4 digest.

The upper-pane raw capture still shows the Codex login menu, so this supplements companion-rendering evidence only and
does not establish authenticated interactive Codex acceptance. Exact owned PIDs and the unique tmux socket were absent
after exit, the malformed config was removed, and project status matched before/after. No hook trust, receipt acceptance
or matrix alignment was exercised.

## Hygiene and cleanup

No credential, OAuth/device code, authorization header, cookie, email address or private key is retained here. Raw plugin
inventory, auth metadata/hashes, thread IDs, usage fields and unrelated evidence were excluded. The source report states
that the temporary candidate auth copy was removed and live Codex auth/config hashes were unchanged; those private hashes
are intentionally not republished.

The temporary workflow and candidate roots remain outside the repository and may be removed only after the main evidence
owner confirms all required artifacts are retained. This review performed no native session, trust, profile or cleanup
mutation.

## Retained files

- Exact source bytes: `quote.py`, `refactor_quote.py`, `refactor_quote.before.py`
- Candidate identity: `candidate.sha256`
- Selected workflow order: `workflow-selected-events.json`
- Raw engine results: `write-final-check.json`, `write-final-align.json`, `refactor-final-check.json`,
  `refactor-final-align.json`
- Independent verification: `independent-180.json`
- Sanitized host surfaces: `claude-hud-sanitized.txt`, `codex-companion-sanitized.txt`
- Supplemental raw Codex companion sequence and cleanup: `codex-hud-recovery/`
- Qualified Codex authentication diagnosis: `codex-auth-diagnosis/`

### Supplemental Codex authentication diagnosis

The retained bounded evidence supports a narrower conclusion than a fully ready interactive session. The candidate
launcher process, Node wrapper and native child all received the same disposable `HOME`, `CODEX_HOME` and
`XDG_CONFIG_HOME`; the candidate-scoped login-status command recognized ChatGPT authentication. Before restart, the
selected candidate process lines show an already-running managed app-server. The official candidate-scoped stop record
targets that daemon, and a subsequent ordinary HUD launch reached Codex's authenticated folder-access prompt instead of
the sign-in screen. This supports the diagnosis that stale candidate-managed daemon state explained the earlier
direct-exec/TUI difference; it does not establish a general credential hot-reload contract.

The folder prompt was deliberately left unanswered. Therefore this evidence establishes authentication recognition,
but does not establish folder or hook trust, a fully ready upper session, model interaction, current-session hook
delivery, receipt acceptance, or matrix alignment. The companion pane remained ready with approved count 2 and the
same history/unknown/file-not-run qualifier. The diagnostic report records candidate-scoped daemon shutdown, temporary
auth-copy removal and candidate trust cleanup. This review retained no auth contents or auth hashes, no full process
inventory, and no candidate config containing prior trust entries.
