# BoxBox status in Codex

In a new Codex session opened in this checkout, invoke `$boxbox-status` or ask for the BoxBox plugin status. The
project skill runs `node development/tools/hud.mjs --json` and renders a compact panel in the conversation. A terminal can run
`bun run hud` directly. Node 22.22.3 or newer and an installed Codex CLI are required.

The canonical skill is `development/skills/boxbox-status/SKILL.md`. This machine's project discovery link is
`.agents/skills/boxbox-status` (local skills are Git-excluded). To enable discovery in another checkout on macOS/Linux:

```bash
mkdir -p .agents/skills
ln -s ../../development/skills/boxbox-status .agents/skills/boxbox-status
```

On Windows, copy that canonical skill folder into `.agents/skills/boxbox-status` instead. The terminal command works
without a discovery link.

The panel reports the plugin version and enabled state from Codex's filtered plugin list, then calls that installed
plugin's engine `doctor`. It does not execute the development engine or format project sources. Approval counts and
formatter configuration describe configuration only; actual file safety remains a `format --dry-run` decision.

Hook receipts are available only when their real data directory is known. The optional
`--plugin-data <absolute-directory>` argument accepts either the data root or the session receipt directory reported
by BoxBox's session hook. A session path for another project reports `location-mismatch`. `CLAUDE_PLUGIN_DATA` takes
precedence over `PLUGIN_DATA`, matching the engine's hook writer. Without a directory the panel shows `location-unknown`. Invalid receipts
produce `incomplete`. Receipt records remain distinct from native host acceptance, which this HUD does not measure.

This is a development tool and project skill, excluded from both release artifacts. No host trust settings are changed.
After installing BoxBox or adding the project skill, start a new Codex session to load it. The supported surface is an
on-request conversation panel. Codex's [configuration reference](https://learn.chatgpt.com/docs/config-file/config-reference)
documents a footer made of status item identifiers; this tool does not modify that footer. The
[plugin hook contract](https://learn.chatgpt.com/docs/hooks#plugin-bundled-hooks) separately defines registration and trust.
