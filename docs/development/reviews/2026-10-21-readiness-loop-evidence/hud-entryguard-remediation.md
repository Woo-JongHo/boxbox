# HUD direct-entry remediation

The guards in `product/hud/status.mjs`, `setup.mjs` and `codex.mjs` now compare canonical real paths while retaining
the missing-argv guard for import-only evaluation. Focused regressions invoke each entry through a symlink and verify
that importing status has no output.

`bun test test/product-hud.test.ts test/hud-installation.test.ts test/codex-hud-launcher.test.ts --timeout 60000`
passed **24 tests, 0 failures, 159 assertions**. Node syntax and `git diff --check` passed. The failed archive does not
contain this correction; rebuild and native rerun with a new digest remain required.

