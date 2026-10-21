---
name: boxbox-status
description: Show the installed BoxBox plugin, engine readiness and observed hook receipts in Codex for this development repository.
---

Run `node development/tools/hud.mjs --json` from this repository root. This development-only HUD reads the installed
Codex plugin and its engine rather than executing the checkout's engine. Present the result as a compact status panel
in the conversation: plugin version/enabled state, runtime, approved rules, formatter and latest observed hook receipt.

If the current BoxBox session context supplies its plugin data directory, pass that exact absolute directory with
`--plugin-data`. Otherwise retain `location-unknown`; a missing receipt is not a successful check. Receipt existence
does not prove the host accepted hook output. Configuration readiness leaves per-file safety verification pending.

Report failed probes as unknown/error with the supplied reason. Status inspection is read-only; installation, hook
trust, formatting, publication and source edits require their own user request. This panel appears on request inside
Codex's conversation; it does not install a persistent overlay or replace Codex's built-in footer.
