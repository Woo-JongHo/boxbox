import { afterEach, describe, expect, test } from "bun:test";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { columnSetGuide } from "@/common/authoring-guide.ts";
import { axisExpectation, baseAxis } from "@/common/axis-expectations.ts";
import { AXIS_NOTES, KIND_AXES } from "@/typescript/grid-kinds.ts";

const cli                  = resolve(import.meta.dir, "../product/engine/cli.ts") ;
const workspaces: string[] = []                                                   ;

function workspace(): string {
	const root = mkdtempSync(join(tmpdir(), "boxbox-engine-judgment-"));
	workspaces.push(root);
	return root;
}

function invoke(root: string, args: string[]) {
	const source = `import { runCli } from ${JSON.stringify(cli)}; process.exitCode = await runCli(JSON.parse(process.env.BOXBOX_TEST_ARGS!), process.cwd());`;
	const result = Bun.spawnSync([process.execPath, "-e", source], {
		cwd: root, env: { ...process.env, XDG_CONFIG_HOME: join(root, "user-config"), BOXBOX_TEST_ARGS: JSON.stringify(args) },
		stdout: "pipe", stderr: "pipe",
	});
	const output = result.stdout.toString();
	return { code: result.exitCode, output, value: output.trim().startsWith("{") ? JSON.parse(output) : undefined };
}

afterEach(() => {
	for (const root of workspaces.splice(0)) rmSync(root, { recursive: true, force: true });
});

describe("axis names", () => {
	test("a reported column and an indexed policy name are the same axis", () => {
		expect(baseAxis("call-comma2=26"     )).toBe("call-comma"    ) ;
		expect(baseAxis("call-comma{i}"      )).toBe("call-comma"    ) ;
		expect(baseAxis("list-arg0-comma1=40")).toBe("list-arg-comma") ;
		expect(baseAxis("semicolon"          )).toBe("semicolon"     ) ;
	});
});

describe("axisExpectation", () => {
	const groups = [
		{ startLine: 3 , axes: ["equals=16", "call-open-paren=22", "call-comma1=26", "semicolon=35"] },
		{ startLine: 9 , axes: ["equals=12", "semicolon=20"]                                         },
	];

	test("splits requested axes into covered with their lines, missing and unknown", () => {
		const known  = new Set(["equals", "call-open-paren", "call-comma", "semicolon", "guard-return"])       ;
		const result = axisExpectation(groups, ["semicolon", "call-comma{i}", "guard-return", "colum"], known) ;
		expect(result.requested).toEqual(["semicolon", "call-comma", "guard-return", "colum"]                                            ) ;
		expect(result.covered  ).toEqual([{ axis: "semicolon", groups: 2, lines: [3, 9] }, { axis: "call-comma", groups: 1, lines: [3] }]) ;
		expect(result.missing  ).toEqual(["guard-return"]                                                                                ) ;
		expect(result.unknown  ).toEqual(["colum"]                                                                                       ) ;
	});

	test("a typo is never reported as missing, and duplicates collapse", () => {
		const result = axisExpectation(groups, ["colum", "colum=4", "colum"], new Set(["equals"]));
		expect(result.unknown).toEqual(["colum"]);
		expect(result.missing).toEqual([]);
	});

	test("without a vocabulary every name is judged by coverage only", () => {
		const result = axisExpectation(groups, ["equals", "anything"]);
		expect(result.unknown).toEqual([]);
		expect(result.missing).toEqual(["anything"]);
	});

	test("no groups means every known requested axis is missing", () => {
		expect(axisExpectation([], ["equals"], new Set(["equals"])).missing).toEqual(["equals"]);
	});
});

describe("columnSetGuide", () => {
	test("marks a kind approved only when an approved rule key names it, and explains every column", () => {
		const key    = "v1|typescript|SourceFile|declaration-equals|equals>call-open-paren>call-close-paren>semicolon" ;
		const result = columnSetGuide(KIND_AXES, AXIS_NOTES, [key])                                                    ;
		expect(result.columnSets.filter(set => set.approved).map(set => set.kind)).toEqual(["declaration-equals"]);
		expect(result.columnSets.map(set => set.kind)                            ).toEqual(Object.keys(KIND_AXES));
		for (const set of result.columnSets) {
			for (const column of set.columns) expect(result.axisNotes[column.replaceAll("{i}", "")], `${set.kind}.${column}`).toBeString();
		}
	});

	test("with no approved key nothing is approved", () => {
		expect(columnSetGuide(KIND_AXES, AXIS_NOTES, []).columnSets.some(set => set.approved)).toBe(false);
	});
});

describe("CLI", () => {
	test("guide --authoring lists TypeScript column sets as vocabulary and nothing for other languages", () => {
		const root       = workspace()                                                                  ;
		const typescript = invoke   (root, ["guide", "--file", "new/code.ts", "--authoring", "--json"]) ;
		const python     = invoke   (root, ["guide", "--file", "new/code.py", "--authoring", "--json"]) ;
		expect(typescript.code                                                                                                          ).toBe           (0                     ) ;
		expect(typescript.value.writeAuthorized                                                                                         ).toBe           (false                 ) ;
		expect(typescript.value.columnSets.filter((set: { approved: boolean }) => set.approved).map((set: { kind: string }) => set.kind)).toEqual        (["declaration-equals"]) ;
		expect(Object.keys(typescript.value.axisNotes).length                                                                           ).toBeGreaterThan(30                    ) ;
		expect(python.value.columnSets                                                                                                  ).toEqual        ([]                    ) ;
		expect(python.value.axisNotes                                                                                                   ).toEqual        ({}                    ) ;
	});

	test("check --expect-axis reports coverage and does not change the exit status", () => {
		const root = workspace();
		writeFileSync(join(root, "calls.ts"), "const short = make(1);\nconst muchLonger = make(22);\nconst middle = make(333);\n");
		const plain = invoke(root, ["check", "--file", "calls.ts", "--json"]);
		const asked = invoke(
			root                                                                                                                                    ,
			["check", "--file", "calls.ts", "--expect-axis", "call-open-paren", "--expect-axis", "guard-return", "--expect-axis", "colum", "--json"]
		);
		expect(plain.value.axisExpectation                                       ).toBeUndefined();
		expect(asked.code                                                                      ).toBe   (plain.code         ) ;
		expect(asked.value.results                                                             ).toEqual(plain.value.results) ;
		expect(asked.value.axisExpectation.covered.map((entry: { axis: string }) => entry.axis)).toEqual(["call-open-paren"]) ;
		expect(asked.value.axisExpectation.missing                                             ).toEqual(["guard-return"]   ) ;
		expect(asked.value.axisExpectation.unknown                                             ).toEqual(["colum"]          ) ;
	});

	test("--expect-axis is refused without a valid axis name and on other commands", () => {
		const root = workspace();
		writeFileSync(join(root, "calls.ts"), "const a = make(1);\n");
		expect(invoke(root, ["check", "--file", "calls.ts", "--expect-axis", "--json"]).value.error.code               ).toBe("MISSING_VALUE" ) ;
		expect(invoke(root, ["check", "--file", "calls.ts", "--expect-axis", "Not An Axis", "--json"]).value.error.code).toBe("MISSING_VALUE" ) ;
		expect(invoke(root, ["guide", "--file", "calls.ts", "--expect-axis", "equals", "--json"]).value.error.code     ).toBe("UNKNOWN_OPTION") ;
	});
});
