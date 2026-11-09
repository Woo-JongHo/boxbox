import      { afterEach, expect, test } from "bun:test"              ;
import      {
              existsSync            ,
              mkdirSync             ,
              mkdtempSync           ,
              readFileSync          ,
              rmSync                ,
              writeFileSync
                                      } from "node:fs"               ;
import      { tmpdir                  } from "node:os"               ;
import      { join, resolve           } from "node:path"             ;
import      { buildReport             } from "@/common/23_report.ts" ;

const repository      = resolve(import.meta.dir, "..")               ;
const cli             = join(repository, "product/engine/00_cli.ts") ;
const roots: string[] = []                                           ;

function workspace(): string {
	const root = mkdtempSync(join(tmpdir(), "boxbox-python-guide-"));
	roots.push(root);
	return root;
}

function invoke(root: string, args: readonly string[], withoutPython = false) {
	const source = `import {runCli} from ${JSON.stringify(cli)}; process.exitCode=await runCli(JSON.parse(process.env.BOXBOX_TEST_ARGS!),process.cwd());`;
	const result = Bun.spawnSync([process.execPath, "-e", source], {
		cwd    : root   ,
		env    : {
			...process.env,
			XDG_CONFIG_HOME: join(root, "user-config"),
			BOXBOX_TEST_ARGS: JSON.stringify(args),
			...(withoutPython ? { PATH: join(root, "no-python") } : {}),
		},
		stdout : "pipe" ,
		stderr : "pipe" ,
	});
	expect(result.stdout.toString().trim().split("\n"), result.stderr.toString()).toHaveLength(1);
	return { code: result.exitCode, value: JSON.parse(result.stdout.toString()) };
}

afterEach(() => {
	for (const root of roots.splice(0)) rmSync(root, { recursive: true, force: true });
});

test("Python authoring vocabulary works without a source or parser and approves only an exact variant", () => {
	const root   = workspace()                                                                        ;
	const result = invoke   (root, ["guide", "--file", "new/code.py", "--authoring", "--json"], true) ;
	expect(result.code).toBe(0);
	expect(result.value).toMatchObject({ verification: "not-run", writeAuthorized: false });
	for (const kind of ["assignments", "annotated-assignments", "class-fields", "dict-rows", "keyword-arguments", "parameters", "bundle-rows"]) {
		expect(result.value.columnSets.some((set: { kind: string }) => set.kind === kind), kind).toBe(true);
	}
	expect(result.value.columnSets.filter((set: { approved: boolean }) => set.approved).map((set: { key: string }) => set.key))
		.toEqual(["v1|python|-|table|name>equal>value"]);
	for (const set of result.value.columnSets) {
		for (const axis of set.columns) expect(result.value.axisNotes[axis], axis).toBeString();
	}
	expect(existsSync(join(root, "new"))).toBe(false);
	expect(existsSync(join(root, ".boxbox"))).toBe(false);
});

test("project rejection retains Python vocabulary without presenting a sibling variant as approved", () => {
	const root = workspace();
	mkdirSync(join(root, ".boxbox"));
	const rules = readFileSync(join(repository, "product/rules/presets/recommended/conventions.jsonl"), "utf8").trim().split("\n").map(line => JSON.parse(line)) ;
	const rule  = rules.find(record => record.id === "py-simple-assignments")                                                                                    ;
	writeFileSync(join(root, ".boxbox/conventions.jsonl"), JSON.stringify({ ...rule, id: "local-rejection", status: "rejected" }) + "\n");
	const result = invoke(root, ["guide", "--file", "new.py", "--authoring", "--json"], true);
	expect(result.code                                                                 ).toBe           (1   ) ;
	expect(result.value.rules                                                          ).toEqual        ([]  ) ;
	expect(result.value.columnSets.length                                              ).toBeGreaterThan(6   ) ;
	expect(result.value.columnSets.every((set: { approved: boolean }) => !set.approved)).toBe           (true) ;
});

test("Python axis requests use the reported punctuation and normalized call vocabulary", () => {
	const root   = workspace()                                                    ;
	const source = "a = make(1, 22)\nlonger = make(333, 4)\nmid = make(5, 666)\n" ;
	writeFileSync(join(root, "code.py"), source);
	const result = invoke(root, ["check", "--file", "code.py", "--expect-axis", "open(", "--expect-axis", "call:*", "--expect-axis", "typo", "--json"]);
	expect(result.code                                                                      ).toBe   (1                  ) ;
	expect(result.value.axisExpectation.covered.map((entry: { axis: string }) => entry.axis)).toEqual(["open(", "call:*"]) ;
	expect(result.value.axisExpectation.unknown                                             ).toEqual(["typo"]           ) ;
	expect(result.value.axisExpectation.missing                                             ).toEqual([]                 ) ;
	expect(readFileSync(join(root, "code.py"), "utf8")                                      ).toBe   (source             ) ;
});

test("human findings show the Python family while leaving legacy group identity unchanged", () => {
	const root   = workspace()                 ;
	const source = "a=1\nlonger=22\nmid=333\n" ;
	writeFileSync(join(root, "code.py"), source);
	const checked = invoke(root, ["check", "--file", "code.py", "--json"]).value.results[0] ;
	const before  = JSON.stringify(checked)                                                 ;
	const report  = buildReport({ result: checked, text: source })                          ;
	expect(report.alarms.find(alarm => alarm.id === "A0")?.detail).toContain("assignments (table)") ;
	expect(checked.groups[0].kind                                ).toBe     ("table"              ) ;
	expect(JSON.stringify(checked)                               ).toBe     (before               ) ;
});
