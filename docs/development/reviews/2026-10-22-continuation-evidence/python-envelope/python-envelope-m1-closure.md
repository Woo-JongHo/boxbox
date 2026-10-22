# Independent review M1 closure

Only `test/python-assignment-envelope.test.ts` changed. Product sources and the existing Python align suite remain at their frozen SHA-256 values. No full suite rerun, product edits or approval changes.

The inline SOURCE now exactly matches retained `native/quote.py`, including the final newline. EXPECTED uses the same function name and only the authorized assignment gap changes. The inline baseline exactly matches `native/refactor_quote.before.py`. The test does not read documentation or durable evidence at runtime. It pins the native source SHA-256 and runs the actual quote source, aligned output and one-return baseline over the recorded 5 × 3 × 4 × 3 domains (180 cases), comparing all three with an independently written conditional-clamp reference. Existing positional-call evaluation-order assertions remain.

Domains: prices `[0,1,7,25,100]`, quantities `[0,1,4]`, discounts `[0,1,7,100]`, shipping `[0,2,11]`.

Verification:

- `bun test test/python-assignment-envelope.test.ts test/python-align.test.ts --timeout 60000`: 33 pass, 0 fail, 186 assertions, exit 0. Log `python-envelope-m1-tests.log`.
- `bunx tsc --noEmit`: exit 0. Log `python-envelope-m1-typecheck.log`.
- Current-source proposal formatting: zero edits; read-only second pass also zero edits. Receipts `python-envelope-m1-format.json` and `python-envelope-m1-format-fixedpoint.json`.
- `git diff --check`: exit 0. Direct placeholder/skip/only search empty (`python-envelope-m1-placeholders.log`).
- Scratch byte comparison confirms SOURCE/native quote equality and baseline/native before equality. Existing three product source hashes and legacy test hash unchanged. Evidence `python-envelope-m1-evidence.json`.
- No test failure, process hang or retry occurred in this closure. Original implementation logs remain intact. Previous test bytes retained in `python-envelope-m1-before.test.ts`.

Hashes:

- Native SOURCE: `bcaa36507954fe1d1933c5e44dbb939bc7540f63377b985c4d38575cb8aa802b`
- Native baseline: `aede577151b277e860eac2952d837aa1c001a0059440c225d78207e5a65782f2`
- Final test file: `563e9a1845699616851638155dac319440624e98dc558ab60fa1c67b5b79d1b5`

Source/test freeze restored for parent review. This closes the evidence gap without claiming an independent acceptance verdict; the reviewer/parent owns that decision.
