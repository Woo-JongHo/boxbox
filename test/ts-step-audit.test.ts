import      { afterEach, expect, test                          } from "bun:test"           ;
import      { mkdtempSync, rmSync, writeFileSync               } from "node:fs"            ;
import      { join                                             } from "node:path"          ;
import      { tmpdir                                           } from "node:os"            ;
import      { spawnSync                                        } from "node:child_process" ;

const CLI                   = join(import.meta.dir, "../product/packages/cli/entry.ts") ;
const workspaces : string[] = []                                                        ;

afterEach(() => {
	for (const root of workspaces.splice(0)) rmSync(root, { recursive: true, force: true });
});

function kinds(source: string): readonly string[] {
	const root = mkdtempSync(join(tmpdir(), "boxbox-ts-audit-"));
	workspaces.push(root);
	writeFileSync(join(root, "code.ts"), source);
	const run = spawnSync(process.execPath, [CLI, "check", "--file", "code.ts", "--json"], { cwd: root, encoding: "utf8", env: { ...process.env, XDG_CONFIG_HOME: join(root, "user-config") } });
	return JSON.parse(run.stdout).results[0].groups.map((group: { kind: string }) => group.kind);
}

const OBJECT = "\t{\n\t\tname: \"x\",\n\t\tlonger: 1,\n\t\tmid: 22,\n\t},\n";

// Audit 2026-10-27, leak 1: object-rows marked every array element as claimed before knowing whether any run formed a
// table, so multi-line objects inside an all-object array silently lost their registration table.
test("multi-line objects inside an all-object array keep their registration tables", () => {
	expect(kinds(`export const list = [\n${OBJECT}${OBJECT}${OBJECT}];\n`)).toEqual(["registration", "registration", "registration"]);
}, 60_000);

test("single-line object rows are still claimed by object-rows, not registration", () => {
	const rows = "\t{ name: \"a\", longer: 1 },\n\t{ name: \"bb\", longer: 22 },\n\t{ name: \"ccc\", longer: 333 },\n";
	expect(kinds(`export const list = [\n${rows}${OBJECT}];\n`)).toEqual(["object-rows", "registration"]);
}, 60_000);
