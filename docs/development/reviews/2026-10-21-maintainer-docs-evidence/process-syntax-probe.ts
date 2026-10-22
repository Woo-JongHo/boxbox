import { mkdtempSync, writeFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { runCli } from "/Users/jonghoPro/woo/00_project/98_BoxBox/product/engine/cli.ts";
const root = mkdtempSync(join(tmpdir(), "boxbox-inspection-audit-"));
try {
  writeFileSync(join(root, "invalid.py"), "def broken(:\n");
  console.log("AUDIT_EXIT", await runCli(["check", "--file", "invalid.py", "--json"], root));
} finally {
  rmSync(root, { recursive: true, force: true });
}
