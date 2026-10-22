# HUD direct-entry native failure

Date: 2026-10-21. Local candidate `boxbox-plugin-0.2.4.tgz`, 256,841 bytes, SHA-256
`13e099e00f160f95481a38afeb7ed717bf44afe9aa04ad11e347bcf5e9fc0177`; this is not a CI artifact.

The candidate installed both plugins with `--hud` into disposable `/tmp/boxbox-native-final.qH0Z1c` paths and exited 0,
but created neither the Codex launcher nor Claude statusLine. Installed `status.mjs` also exited 0 with zero stdout.
`process.argv[1]` retained `/tmp/...`, while Node imported the module through canonical `/private/tmp/...`.
The three literal entry guards therefore classified direct execution as an import and skipped main. Historical 0.2.3
captures do not verify this candidate. Original logs remain in `/tmp/boxbox-readiness/native-final-evidence/`.

