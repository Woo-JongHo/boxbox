# Independent M1 closure

Verdict: PASS. The mandatory exact-native regression gap is closed.

The focused test now embeds the retained `native/quote.py` bytes exactly, including its final newline, and pins SHA-256 `bcaa36507954fe1d1933c5e44dbb939bc7540f63377b985c4d38575cb8aa802b`. Its baseline matches retained `refactor_quote.before.py` at SHA-256 `aede577151b277e860eac2952d837aa1c001a0059440c225d78207e5a65782f2`.

The executable behavior test uses the recorded native domains: 5 unit prices `[0,1,7,25,100]`, 3 quantities `[0,1,4]`, 4 discounts `[0,1,7,100]`, and 3 shipping values `[0,2,11]`, exactly 180 cases. It compares the retained source shape, aligned output and one-return baseline against an independently expressed conditional-clamp reference, while retaining the separate call-order check.

Bounded verification: `bun test test/python-assignment-envelope.test.ts --timeout 60000 --test-name-pattern 'exact native|native 180-case'` passed 2 tests, 0 failures, 8 assertions. Current test hash matches the worker evidence (`563e9a...`). No product source or repository document was edited during this independent closure.
