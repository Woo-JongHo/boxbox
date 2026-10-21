**Verdict: PASS.** The three blockers are closed and 007 is acceptable while it stays `verifying`. A few non-blocking defects remain.

**Blocker 1: failure events are machine-searchable. Closed.**
- Records 004 (seq 6), 005 (seq 5) and 007 (seq 1) each use `event: "verification-failed"` with `status: "failed"` and evidence.
- `validate.py` requires `status=failed` for that event, and any historical `passed` or `failed` status needs evidence.
- The README documents the convention, and its `rg` pattern finds both current and historical failed or pending states.

**Blocker 2: diagnosis versus passing fix verification. Closed.**
- 005 seq 7 and 006 seq 6 are now `diagnosed` entries, and their text says they are not fix verification.
- Neither record's current `verification` list claims a pass for the original diagnosis, and 005 has only a pending final review.
- The README states the rule.

**Blocker 3: draft ID collisions. Closed.**
- The validator maps canonical IDs first and rejects a different file that claims one.
- It still allows explicit validation of the canonical file itself.
- `validator-review-cases.json` shows the collision rejected (exit 1), the premature resolution rejected, and the canonical file accepted.

**Record 007: acceptable.**
- The failed concurrent run is recorded as an observed failure with evidence.
- The load cause is explicitly a hypothesis, and no deadline or product change is claimed.
- The retry's narrow scope is stated, and the serialized full-suite run is correctly `pending` with empty evidence.

**Remaining defects (none block):**
1. **007 seq 3 event name.** The unchanged retry is logged as `event: "verified"`. No fix was made, so it verifies nothing. Under the library's own rule it fits `diagnosed` (with `status: "passed"`) better. The summary already says "narrower than the complete suite", so this is a wording and semantics issue.
2. **007 resolution trap.**
   - The current `verification` list still holds the failed "Concurrent full-suite attempt".
   - When the parent appends the serialized pass, that entry must be replaced or moved. Its failure is already preserved in history.
   - Otherwise the validator will reject `resolved`.
   - A resolution note should keep the load cause as a hypothesis unless evidence confirms it. A passing serialized run does not confirm it.
3. **`validator-review-cases.json` is not referenced.** It isn't linked from any record or described in the README's "Evidence provenance" section. The `/tmp` draft files it exercised aren't preserved, and its stderr contains an absolute local path. It documents the checker's behavior but can't be replayed.
4. **Uncaught `KeyError`.** The canonical-ID pass reads `["id"]` from each record before any schema validation. A canonical file without `id` would raise `KeyError`, which `main`'s `except (ValueError, OSError)` doesn't catch, so the user would see a traceback. Convert it to a `ValueError`.
5. **One-directional failure check.** The validator enforces `verification-failed` ⇒ `status=failed`, but not the reverse. A history entry with `status: "failed"` under another event name, such as `verified`, would pass. That is the kind of ambiguity blocker 1 was about.

Items 1 and 2 are cheap to fix when the parent appends the final evidence.
