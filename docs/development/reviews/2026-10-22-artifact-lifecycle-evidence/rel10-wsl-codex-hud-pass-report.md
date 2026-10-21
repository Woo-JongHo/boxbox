# REL10 WSL Codex HUD configuration lifecycle

Date: 2026-10-22 KST  
Verdict: **PASS**

The independently reviewed standalone HUD harness was transferred to the owned WSL prefix and verified before execution:

- Harness SHA-256: `73da0018b1761b18c271fe50cc18ab87b2daf8bd086d1c6e606794968a5059e0`.
- Core input: successful WSL Codex lifecycle `/tmp/boxbox-rel10-linux.VfqJoi/wsl-codex-02/lifecycle.json`.
- Previous artifact binding: `f07df7ada9aa234c2935ed500b4fe15b1a5d53f7b7a6de7d8ec107f53c8f572c`.
- Current exact CI artifact binding: `bec626435e525c2d7324d156f85d2c114427d875725abcecb42fed561b2b92be`.
- Previous setup binding: `4ad73e096bd7db86add4c348a2b45f88df285d07059da82bf9527fa7e43b814f`.
- Current setup binding: `e888c90357f6165d553fd5e095206a83f4b7bd442b563d7a9f4f3631f0ac927d`.

A fresh output `wsl-hud-codex-01` completed in 803 ms with 10 commands passed. Four commands were expected ownership refusals with exit 1 and were accepted only after exact diagnostic and zero-mutation assertions.

The cell proved old enable/disable, current enable, refusal to overwrite or disable a user-edited current launcher, restoration of the exact owned launcher, disable before rollback, old-version rollback enable/disable, refusal to replace or disable a foreign launcher, exact removal of the harness-created foreign file, final launcher absence, and preservation of unrelated HUD-bin data. Version roots, preserved core bytes, unrelated stable HUD data, and unrelated Codex configuration remained unchanged.

This scope is configuration ownership only. It does not claim host UI, tmux rendering, model/authentication, hooks, trust, or Windows HUD support.

Evidence:

- Remote original: `/tmp/boxbox-rel10-linux.VfqJoi/wsl-hud-codex-01/hud-lifecycle.json`.
- Compact local evidence: `/tmp/boxbox-readiness/rel10-wsl-codex-hud-pass/`.
- Full HUD JSON SHA-256: `b3e511735c381db167456cf8026115bd56c6ab2a1b10aba40d8e81b73a18d2af`.
- Compact summary SHA-256: `311d6132881228593b889bff2a021779b0233245cc6030b99baf12734b497e28`.
- Transfer proof: `/tmp/boxbox-readiness/rel10-wsl-hud-transfer.raw`.
