# REL10 WSL Codex HUD configuration lifecycle — independent evidence review

Date: 2026-10-22 KST  
Verdict: **PASS**  
Mandatory findings: **0**

## Scope and binding

This review read `/tmp/boxbox-readiness/rel10-wsl-codex-hud-pass/`, its author report, all ten bounded command logs, the transfer record, and the frozen harness digest manifest. It did not access or mutate the live WSL cell.

- The standalone harness is bound to SHA-256 `73da0018b1761b18c271fe50cc18ab87b2daf8bd086d1c6e606794968a5059e0`; the frozen manifest and WSL transfer record agree.
- The previous artifact/setup bindings are `f07df7...572c` / `4ad73e...814f`.
- The current default unpublished candidate is bound to archive `bec626...be` and setup `e888c9...927d`. The terminal record explicitly describes that provenance; it makes no CI-execution claim for this HUD cell.
- The full evidence JSON has SHA-256 `b3e511735c381db167456cf8026115bd56c6ab2a1b10aba40d8e81b73a18d2af`; the summary has `311d6132881228593b889bff2a021779b0233245cc6030b99baf12734b497e28`.

## Result

The terminal lifecycle is `ok: true` on Linux/WSL and runs from `17:29:55.303Z` to `17:29:56.106Z`, exactly 803 ms. All ten command records are complete. Six successful ownership operations exit 0; four expected ownership refusals exit 1 and are accepted only with the exact diagnostic and an empty inventory delta.

The evidence proves this bounded configuration sequence:

1. old-version enable and disable;
2. current-version enable;
3. refusal to overwrite or disable a user-edited current launcher;
4. harness restoration of the exact owned launcher and successful current disable before rollback;
5. old-version rollback enable and disable;
6. refusal to overwrite or disable a foreign launcher;
7. harness removal of its foreign test file;
8. final launcher absence and preservation of unrelated HUD-bin data.

Each successful setup action changes only `hud-bin:boxbox-codex`. Each refusal records no inventory delta, and all four stderr logs contain the same precise ownership diagnostic. The lifecycle's final assertion reports the launcher absent and unrelated bin content preserved. The old/current version roots, preserved core bytes, stable unrelated HUD data, and unrelated Codex configuration are asserted unchanged by the terminal verifier.

## Limits

- This is configuration ownership behavior in an isolated WSL workspace. It does not establish host acceptance, HUD rendering, tmux behavior, model/authentication, hooks, trust, or interactive UI behavior.
- Windows HUD remains unsupported in this evidence.
- This review verified the copied logs, recorded bindings, frozen manifest, and transfer record; it did not independently rehash the live WSL filesystem.
