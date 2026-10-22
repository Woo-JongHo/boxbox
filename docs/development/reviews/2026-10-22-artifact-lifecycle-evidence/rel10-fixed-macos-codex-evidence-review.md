# REL10 fixed candidate — macOS Codex evidence review

Date: 2026-10-22  
Scope: read-only review; no installer, host, or HUD mutation was executed.  
Verdict: **PASS for the exact macOS Codex core and HUD cells.**

## Findings

- Both reports bind the unpublished local candidate `1f1343e91d2799998884ed5d75e1a26d7858226d2f9f51f07621bfeedaf6ecd3`, the immutable historical `f07df7…` fixture, and the reviewed core/HUD verifier hashes. The current artifact is repeatedly rehashed at pre-execution, cold failure, upgrade/install, warm repair, and final stages.
- Core lifecycle is schema 1, `ok:true`, macOS arm64, Node 22.22.3, Codex CLI 0.163.0, npm 10.9.8. It records 110 commands with no failed state.
- Fresh 0.2.3 installation and warm repair have exact marketplace/plugin roots and pass engine version, doctor, check, format, content-preservation, and idempotence gates.
- Cold-cache current installation produces the expected TypeScript `ENOTCACHED` failure, leaves no accepted partial current registration, and preserves the 0.2.3 registration and usable engine.
- Direct upgrade and rollback each fail only with the recognized named marketplace/different-source collision. After each collision, the existing registration and engine are reverified before documented plugin/marketplace removal. Explicit reinstall then binds the intended 0.2.4 or 0.2.3 root and repeats all engine gates. The transitions are truthfully recorded as marketplace collisions rather than atomic updates.
- The failed direct upgrade conservatively retains its candidate destination/phase receipt; the subsequent documented removal and exact retry consume that owned partial state successfully. No registration is claimed from the failed attempt.
- Warm 0.2.4 repair succeeds. Final plugin and marketplace removal succeeds, while both permanent version directories remain as documented residue.
- Nine pinned project, approval, and user files retain their hashes; the unrelated Codex setting remains `hide_agent_reasoning = true` at every preservation boundary.

## HUD

- HUD report is schema 1 and `ok:true`, with exact archive/setup bindings and the canonical successful core roots.
- Ten setup commands cover old enable/disable, current enable, edited enable/disable refusal, current disable, old rollback enable/remove, and foreign enable/disable refusal.
- Every successful mutation changes only the exact `hud-bin:boxbox-codex` inventory key. All four refusal cases exit 1 with the pinned ownership diagnostic and zero inventory delta.
- Historical disables are protected by the verifier's exact-byte/mode gate. The final launcher is absent, the unrelated bin sentinel remains intact, the Codex config is unchanged, and complete version-root inventories remain unchanged.

No mandatory inconsistency was found. This evidence proves the isolated Codex registration/engine lifecycle and HUD launcher filesystem ownership for this exact candidate on macOS. It does not prove tmux pane rendering, model/session behavior, authentication, hooks, trust, UI acceptance, publication, clean/CI provenance, or other platforms.
