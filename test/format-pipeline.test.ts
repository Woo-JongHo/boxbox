import      { afterEach, describe, expect, test                } from "bun:test"                    ;
import      { chmodSync, mkdirSync, mkdtempSync, readdirSync   } from "node:fs"                     ;
import      { readFileSync, rmSync, symlinkSync, writeFileSync } from "node:fs"                     ;
import      { join                                             } from "node:path"                   ;

import      { APPROVAL_VERSIONS, documentResolver              } from "@/common/approval-gate.ts"   ;
import type { ApprovalRegistry                                 } from "@/common/approval-gate.ts"   ;
import      { contentHashOf, sectionHash                       } from "@/common/examples.ts"        ;
import type { Example                                          } from "@/common/examples.ts"        ;
import      { runFormatPipeline                                } from "@/common/format-pipeline.ts" ;

const workspaces: string[] = [];

function workspace(): string {
	const root = mkdtempSync(join(import.meta.dir, "xxx-format-pipeline-"));
	workspaces.push(root);
	mkdirSync(join(root, "src"));
	mkdirSync(join(root, "docs"));
	writeFileSync(join(root, "docs/rules.md"), "# Rules\n\n## Table alignment\nRule approved only in tests\n");
	return root;
}

function example(id: string, language: string, rule: string, verdict: Example["verdict"]): Example {
	const before = `${id} before` ;
	const after  = `${id} after`  ;
	return {
		schemaVersion: 1, id, status: "approved", versions: APPROVAL_VERSIONS, language, regime: "table", patterns: ["DEFINE"], rules: [rule],
		before, after, contentHash: contentHashOf(before, after), verdict, asserts: { after: {} }, source: { kind: "synthetic", license: "test" },
		approvedBy: "synthetic-test-approver", date: "2026-10-04",
	};
}

function registry(root: string, language: "typescript" | "python", key: string, status: "approved" | "rejected" = "approved"): ApprovalRegistry {
	const rule     = `${language}-rule`                                          ;
	const positive = example(`${rule}-positive`, language, rule, "after-better") ;
	const counter  = example(`${rule}-counter`, language, rule, "bad")           ;
	const document = readFileSync(join(root, "docs/rules.md"), "utf8")           ;
	return {
		conventions : [{ schemaVersion: 1, id: rule, key, pattern: "DEFINE", status, scope: "src/**", examples: [positive.id, counter.id], versions: APPROVAL_VERSIONS, approvedBy: "synthetic-test-approver", date: "2026-10-04", layer: "project" }],
		examples    : new Map([[positive.id, positive], [counter.id, counter]]),
		decisions   : new Map([[rule, { schemaVersion: 1, id: rule, kind: "rule", layer: "convention", ref: "docs/rules.md#Table alignment", docHash: sectionHash(document, "Table alignment"), examples: [positive.id, counter.id], approvedBy: "synthetic-test-approver", date: "2026-10-04" }]]),
	};
}

function formatter(root: string, body: string): { readonly command: string; readonly args: readonly string[]; readonly timeoutMs: number } {
	const script = join(root, `formatter-${Math.random().toString(16).slice(2)}.js`);
	writeFileSync(script, body);
	return { command: process.execPath, args: [script, "{file}"], timeoutMs: 2_000 };
}

function leftovers(root: string): readonly string[] {
	return readdirSync(join(root, "src")).filter(name => name.includes("xxx-stage") || name.includes("xxx-write.lock"));
}

afterEach(() => {
	for (const root of workspaces.splice(0)) rmSync(root, { recursive: true, force: true });
});

const TS_KEY = "v1|typescript|SourceFile|declaration-equals|equals>call-open-paren>call-close-paren>semicolon" ;
const PY_KEY = "v1|python|-|table|name>equal>value"                                                            ;

for (const scenario of [
	{
		language: "typescript" as const, name: "TypeScript", file: "sample.ts", key: TS_KEY,
		source: "const a=fn(1);\nconst longer=fn(22);\nconst mid=fn(333);\n",
		formatterBody: `import { readFileSync, writeFileSync } from "node:fs"; const p=process.argv[2]; writeFileSync(p,readFileSync(p,"utf8").replaceAll("=fn", " = fn"));`,
	},
	{
		language: "python" as const, name: "Python", file: "sample.py", key: PY_KEY,
		source: "a=1\nlonger=22\nmid=333\n",
		formatterBody: `import { readFileSync, writeFileSync } from "node:fs"; const p=process.argv[2]; writeFileSync(p,readFileSync(p,"utf8").replaceAll("=", " = "));`,
	},
]) test(`the real ${scenario.name} pipeline writes only the approved working copy and stays fixed on rerun`, async () => {
	const root   = workspace()                      ;
	const target = join(root, "src", scenario.file) ;
	writeFileSync(target, scenario.source);
	const options = {
		root, file: `src/${scenario.file}`, language: scenario.language,
		formatter: formatter(root, scenario.formatterBody),
		registry: registry(root, scenario.language, scenario.key), resolveDocument: documentResolver(root),
	};
	const first  = await runFormatPipeline(options) ;
	const output = readFileSync(target)             ;
	const second = await runFormatPipeline(options) ;

	expect(first.formatterChanged             ).toBe   (true ) ;
	expect(first.xxxChanged                   ).toBe   (true ) ;
	expect(first.fixedPoint                   ).toBe   (true ) ;
	expect(first.safety.parserChecked         ).toBe   (true ) ;
	expect(second.written                     ).toBe   (false) ;
	expect(readFileSync(target).equals(output)).toBe   (true ) ;
	expect(leftovers(root)                    ).toEqual([]   ) ;
}, 60_000);

test("the TypeScript pipeline writes the same result even with a symlink in the root path", async () => {
	const root   = workspace()                                                                     ;
	const linked = join(import.meta.dir, `xxx-format-link-${Math.random().toString(16).slice(2)}`) ;
	const target = join(root, "src/sample.ts")                                                     ;
	symlinkSync(root, linked);
	workspaces.push(linked);
	writeFileSync(target, "const a=fn(1);\nconst longer=fn(22);\nconst mid=fn(333);\n");
	const result = await runFormatPipeline({
		root: linked, file: "src/sample.ts", language: "typescript",
		formatter: formatter(root, `import { readFileSync, writeFileSync } from "node:fs"; const p=process.argv[2]; writeFileSync(p,readFileSync(p,"utf8").replaceAll("=fn", " = fn"));`),
		registry: registry(root, "typescript", TS_KEY), resolveDocument: documentResolver(root),
	});

	expect(result.written  ).toBe   (true) ;
	expect(leftovers(root) ).toEqual([]  ) ;
}, 60_000);

describe("format pipeline fails closed", () => {
	function pythonCase(root: string, body: string, status: "approved" | "rejected" = "approved", timeoutMs = 2_000) {
		const target = join(root, "src/sample.py");
		writeFileSync(target, "a=1\nlonger=22\nmid=333\n");
		const configured = formatter(root, body);
		return { target, options: { root, file: "src/sample.py", language: "python" as const, formatter: { ...configured, timeoutMs }, registry: registry(root, "python", PY_KEY, status), resolveDocument: documentResolver(root) } };
	}

	test("dry-run returns the full verification result and bounded output without writing the original", async () => {
		const root = workspace()                                                                                                                                                                                ;
		const body = `import { readFileSync, writeFileSync } from "node:fs"; const p=process.argv[2]; process.stdout.write("x".repeat(70000)); writeFileSync(p,readFileSync(p,"utf8").replaceAll("=", " = "));` ;
		const { target, options } = pythonCase(root, body);
		const before = readFileSync(target)                                  ;
		const result = await runFormatPipeline({ ...options, dryRun: true }) ;
		expect(result.written                            ).toBe(false    ) ;
		expect(result.formatterChanged                   ).toBe(true     ) ;
		expect(result.formatter.truncated                ).toBe(true     ) ;
		expect(Buffer.byteLength(result.formatter.stdout)).toBe(64 * 1024) ;
		expect(readFileSync(target).equals(before)       ).toBe(true     ) ;
	});

	for (const [name, body, expected] of [
		["formatter abnormal exit", `process.exit(7);`, "exit code 7"],
		["parser failure", `import { writeFileSync } from "node:fs"; writeFileSync(process.argv[2], "def broken(:\\n");`, "does not parse"],
	] as const) test(`on ${name}, the original and temporary files are preserved`, async () => {
		const root = workspace();
		const { target, options } = pythonCase(root, body);
		const before = readFileSync(target);
		await expect(runFormatPipeline(options)).rejects.toThrow(expected);
		expect(readFileSync(target).equals(before)).toBe(true);
		expect(leftovers(root)).toEqual([]);
	});

	test("on timeout, the child process group is ended and the original is not written", async () => {
		const root = workspace()                                                                                                                                         ;
		const body = `import { spawn } from "node:child_process"; spawn(process.execPath,["-e","setInterval(()=>{},1000)"],{stdio:"ignore"}); setInterval(()=>{},1000);` ;
		const { target, options } = pythonCase(root, body, "approved", 100);
		const before = readFileSync(target);
		await expect(runFormatPipeline(options)).rejects.toThrow("timed out");
		expect(readFileSync(target).equals(before)).toBe(true);
		expect(leftovers(root)).toEqual([]);
	});

	test("a missing executable and an approval refusal each close before writing", async () => {
		const root    = workspace()                          ;
		const missing = pythonCase(root, `process.exit(0);`) ;
		await expect(runFormatPipeline({ ...missing.options, formatter: { command: "xxx-no-such-formatter", args: ["{file}"], timeoutMs: 100 } })).rejects.toThrow("executable not found");
		const denied = pythonCase(root, `process.exit(0);`, "rejected");
		await expect(runFormatPipeline(denied.options)).rejects.toThrow("approval denied");
		expect(leftovers(root)).toEqual([]);
	});

	test("the direct API also refuses parent-directory symlink root escapes and invalid timeouts", async () => {
		const root    = workspace() ;
		const outside = workspace() ;
		writeFileSync(join(outside, "sample.py"), "a=1\nlonger=22\nmid=333\n");
		symlinkSync(outside, join(root, "linked"));
		const base = pythonCase(root, `process.exit(0);`);

		await expect(runFormatPipeline({ ...base.options, file: "linked/sample.py" })).rejects.toThrow("resolves outside project root");
		for (const timeoutMs of [0, 60_001, 1.5, Number.NaN]) {
			await expect(runFormatPipeline({ ...base.options, formatter: { ...base.options.formatter, timeoutMs } })).rejects.toThrow("integer from 1 to 60000");
		}
		expect(leftovers(root)).toEqual([]);
	});

	test("does not write when the approval rules are empty or the second full run differs", async () => {
		const root  = workspace()                          ;
		const empty = pythonCase(root, `process.exit(0);`) ;
		await expect(runFormatPipeline({ ...empty.options, registry: { conventions: [], examples: new Map(), decisions: new Map() } })).rejects.toThrow("approval denied");

		const changing = pythonCase(root, `import { appendFileSync } from "node:fs"; appendFileSync(process.argv[2], "# tick\\n");`) ;
		const before   = readFileSync(changing.target)                                                                               ;
		await expect(runFormatPipeline(changing.options)).rejects.toThrow("byte fixed point");
		expect(readFileSync(changing.target).equals(before)).toBe(true);
	});

	test("external edits and provenance changes are detected right before commit", async () => {
		const root     = workspace()                          ;
		const external = pythonCase(root, `process.exit(0);`) ;
		await expect(runFormatPipeline({ ...external.options, beforeCommit: () => writeFileSync(external.target, "external=True\n") })).rejects.toThrow("target changed before commit");
		expect(readFileSync(external.target, "utf8")).toBe("external=True\n");

		const provenance = pythonCase(root, `process.exit(0);`) ;
		let revision     = "one"                                ;
		await expect(runFormatPipeline({ ...provenance.options, provenance: () => revision, beforeCommit: () => { revision = "two"; } })).rejects.toThrow("provenance changed");
		expect(leftovers(root)).toEqual([]);
	});
});
