# Final CI native raw-log closure

All numbered stdout/stderr files referenced by the six lifecycle metadata files were copied from the remote isolated cells without copying workspaces, caches, or `node_modules`. Each metadata file remains beside its logs under the same original filename, so its relative references resolve locally.

## Directory map

- WSL Codex core: `/tmp/boxbox-readiness/rel10-ci-wsl-codex/core/`
- WSL Codex HUD: `/tmp/boxbox-readiness/rel10-ci-wsl-codex/hud/`
- WSL Claude core: `/tmp/boxbox-readiness/rel10-ci-wsl-claude/core/`
- WSL Claude HUD: `/tmp/boxbox-readiness/rel10-ci-wsl-claude/hud/`
- Windows Codex core: `/tmp/boxbox-readiness/rel10-ci-windows-codex/core/`
- Windows Claude core: `/tmp/boxbox-readiness/rel10-ci-windows-claude/core/`

The four host roots each contain a `SHA256SUMS.txt`. The combined 854-file manifest is `/tmp/boxbox-readiness/rel10-ci-raw-SHA256SUMS.txt`, whose SHA-256 is `13b1eb9d9175a992af5c32e3991a2fdc27ed6c87739dd7b2d2df444ccd87adf3`.

Reference validation found zero missing numbered-log references across 110 + 93 + 110 + 93 core commands and 10 + 8 HUD commands. The prior flat lifecycle copies remain unchanged.

The core limitation about a historical uncommitted candidate fixture applies to the previous `0.2.3` transition fixture (`f07df7…`). The current `0.2.4` input is the clean CI archive `ebfe6a…`, bound to source `66eb978…` by candidate metadata and repeated digest checks.
