# REL10 native Windows Codex lifecycle closure

Date: 2026-10-22 KST  
Verdict: **PASS**

The independently reviewed updated harness was transferred under a new filename and verified before execution:

- Harness SHA-256: `292b730c122612479e39d0745623d8095ea066b1c2129c71d30e0a1f8bfa5d30`.
- Previous installer SHA-256: `f07df7ada9aa234c2935ed500b4fe15b1a5d53f7b7a6de7d8ec107f53c8f572c`.
- Current exact CI installer SHA-256: `bec626435e525c2d7324d156f85d2c114427d875725abcecb42fed561b2b92be`.

A new unique native cell `win-codex-03` ran through PowerShell `Start-Process node.exe`. It did not reuse either retained failure cell. Environment/profile state remained inside the harness workspace; no authentication, hook trust, HUD, model call, or live host profile was involved.

## Result

- Platform: native `win32` x64, Node `v24.12.0`.
- Host: `codex-cli 0.157.1`; npm `11.6.2`.
- Duration: 54,054 ms.
- Commands: 110 total; 107 passed, 3 expected/observed, 0 failed.
- Archive checks: 12.
- Preservation checks: 21; 9 retained user/project files.
- Both transitions used the documented marketplace-collision path, preserving the prior registration and engine before exact unregister/reinstall.
- Final plugin and marketplace registration were absent.
- Both permanent version directories remained: 0.2.3 with 608 inventory entries and 0.2.4 with 609.

The completed cell covers fresh exact 0.2.3 installation, engine init/doctor/approved TypeScript check-dry-run-apply-recheck-idempotence, expected cold-cache 0.2.4 `ENOTCACHED` failure with prior state preserved, warm offline repairs, upgrade to exact CI 0.2.4, rollback to exact 0.2.3, final registration removal, and preservation/residue checks.

The updated verifier successfully handled the measured Codex 0.157.1 marketplace schema and Windows extended-drive path while retaining exact root, plugin provenance, manifest/runtime, and containment checks.

## Evidence

Remote original:

```text
C:\Users\woo\AppData\Local\Temp\BoxBox-rel10-7b25a75cbb5446069c3e3bfa5b464a4c\win-codex-03\lifecycle.json
```

Compact local copy with all bounded command logs:

```text
/tmp/boxbox-readiness/rel10-windows-codex-pass/
```

- Full lifecycle JSON SHA-256: `c7dbe0939734526a61254783ae843a2f3ef691e321257855f4986bb34f63fea8`.
- Compact summary SHA-256: `543e249bbfafa4cc39a1dce9fbe085701e2f79f0e89a5b3e147208e54636cf8d`.
- Transfer proof: `/tmp/boxbox-readiness/rel10-windows-core292b-transfer.raw`.
- Exact native runner input: `/tmp/boxbox-readiness/rel10-windows-codex-03-run.ps1`.

The earlier transport hang and legacy-schema failure remain preserved separately and were not rewritten or cleaned as part of this PASS.
