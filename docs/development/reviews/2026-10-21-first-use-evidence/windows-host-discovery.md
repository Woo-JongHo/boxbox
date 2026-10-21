# Windows host identity discovery fix

## Ownership and trigger

This worker edited only `product/installer/platform.mjs` and added `test/installer-platform.test.ts`. The root agent owns installer orchestration, artifact tests/builds, documentation, native Windows SSH verification, and host registration verification. No user PATH or host settings were changed by this worker.

The root agent reproduced an actual native Windows npx PATH with an unrelated `C:\\Users\\woo\\node_modules\\.bin\\codex.exe` ahead of the user's global OpenAI package. That executable reports `0.2.3` and returns success for arbitrary plugin commands. Selecting it solely by name allowed an installation to claim success without reaching real OpenAI Codex.

## Change

Native Windows candidates named `codex.exe` now pass a bounded shell-free identity probe before selection. `findCommand` invokes `--version` with `spawnSync`, a 3000 ms timeout, 4096-byte buffer cap, `SIGKILL`, hidden windows, and argument arrays. A candidate is accepted only for status 0, no error/signal, and stdout consisting entirely of `codex-cli <semver>` after trimming. Normal releases, prereleases and build suffixes are accepted. Failed/ambiguous/throwing probes continue to the next PATH directory rather than terminating discovery.

The known standard npm entry `node_modules/@openai/codex/bin/codex.js` still resolves directly to the configured Node runtime and its entry argument. npm and Claude discovery behavior is preserved. `findCommand` accepts an optional injected `probe` with the `spawnSync` calling convention, enabling Windows path resolution tests without pretending fake Windows paths are executable on macOS.

This is a CLI identity check against accidental name collisions, not code-signing or protection against a malicious executable deliberately impersonating OpenAI Codex.

## Verification

`bun test test/installer-platform.test.ts --timeout 60000`: 6 pass, 0 fail, 19 assertions. Coverage includes the reported unrelated shadow executable before a later standard npm entry, a valid native Codex that retains precedence, error/signal/nonzero/extra-output/malformed identity rejection, throwing probes, no usable fallback, continuation to a later verified native executable, and unchanged Claude discovery. Real child processes validate output identity flow, buffer overflow rejection, and the actual 3-second timeout path on macOS/Bun.

`bunx tsc --noEmit`: exit 0. `node --check product/installer/platform.mjs`: exit 0. `git diff --check`: exit 0. Import normalization and relevant TS/JS alignment commands completed successfully. Explicit TODO/test.skip/test.only/describe.skip/describe.only scan in owned files found no matches (`rg` exit 1).

Raw evidence is saved as `installer-platform-tests.log`, `installer-platform-types.log`, `installer-platform-alignment.log`, and `installer-platform-js-alignment.log` in this scratch directory.

Official Node child-process documentation was consulted for `spawnSync` timeout, maxBuffer, shell-free argument passing, and killSignal behavior: https://nodejs.org/api/child_process.html#child_processspawnsynccommand-args-options .

## Integration note and limits

The existing synthetic Windows native discovery case in `test/installer-artifact.test.ts` requires an injected successful version probe, e.g. `probe: () => ({ status: 0, stdout: "codex-cli 0.163.0\n" })`; root was notified and owns that file. The root agent must rebuild the installer and rerun native Windows npx registration to establish acceptance. This worker did not execute SSH or claim native Windows success.
