import      { afterEach, describe, expect, test } from "bun:test"                  ;
import      {
              existsSync                      ,
              mkdtempSync                     ,
              mkdirSync                       ,
              readFileSync                    ,
              realpathSync                    ,
              rmSync                          ,
              symlinkSync                     ,
              statSync                        ,
              writeFileSync                   ,
                                                } from "node:fs"                   ;
import      { join, resolve                     } from "node:path"                 ;
import      { spawnSync                         } from "node:child_process"        ;

import      { APPROVAL_VERSIONS                 } from "@/common/approval-gate.ts" ;
import      { contentHashOf, sectionHash        } from "@/common/examples.ts"      ;

const root                  = resolve(import.meta.dir, "..") ;
const workspaces : string[] = []                             ;

function workspace(): string {
	const value = mkdtempSync(join(import.meta.dir, "boxbox-public-artifact-"));
	workspaces.push(value);
	return value;
}

function run(command: string, args: readonly string[], options: { readonly cwd: string; readonly env?: NodeJS.ProcessEnv; readonly timeout?: number }) {
	return spawnSync(command, args, {
		cwd      : options.cwd                ,
		env      : options.env                ,
		encoding : "utf8"                     ,
		timeout  : options.timeout ?? 120_000 ,
	});
}

function expectStatus(result: ReturnType<typeof run>, status: number): void {
	expect(result.error).toBeUndefined();
	expect(`${result.stdout}\n${result.stderr}`).not.toContain("ETIMEDOUT");
	expect(result.status, `${result.stdout}\n${result.stderr}`).toBe(status);
}

afterEach(() => {
	for (const value of workspaces.splice(0)) rmSync(value, { recursive: true, force: true });
});

describe("public CLI local package artifact", () => {
	test("the isolated installed boxbox bin ships approved standalone rules and safely honors project overrides", () => {
		const temporary = workspace()                         ;
		const project   = join     (temporary, "project"    ) ;
		const packs     = join     (temporary, "public-pack") ;
		mkdirSync(project);
		mkdirSync(packs);

		expectStatus(run("bun", ["run", "build:cli"], { cwd: root }), 0);
		const packed = run("npm", ["pack", resolve(root, "dist/cli"), "--pack-destination", packs, "--json"], { cwd: temporary });
		expectStatus(packed, 0);
		const packResult = JSON.parse(packed.stdout) as [{ readonly filename: string; readonly files: readonly { readonly path: string }[] }];
		expect(packResult[0]!.files.map(file => file.path).sort()).toEqual([
			"LICENSE",
			"README.md",
			"THIRD_PARTY_NOTICES",
			"dist/cli.js",
			"package.json",
			"rules/presets/recommended/conventions.jsonl",
			"rules/presets/recommended/decisions.jsonl",
			"rules/presets/recommended/docs/public/decisions/py-simple-assignments.md",
			"rules/presets/recommended/docs/public/decisions/ts-sourcefile-call-declarations.md",
			"rules/presets/recommended/examples.jsonl",
		]);

		writeFileSync(join(project, "package.json"), '{"private":true,"type":"module"}\n');
		const tarball = join(packs, packResult[0]!.filename);
		expectStatus(run("npm", ["install", "--offline", "--ignore-scripts", "--no-audit", "--no-fund", tarball], { cwd: project }), 0);

		const installed  = join(project, "node_modules/boxbox")                                                                                                                                                                                ;
		const executable = join(project, "node_modules/.bin/boxbox")                                                                                                                                                                           ;
		const manifest   = JSON.parse(readFileSync(join(installed, "package.json"), "utf8")) as { readonly private: boolean; readonly bin: Record<string, string>; readonly dependencies: Record<string, string>; readonly exports?: unknown } ;
		expect(manifest.private                                                         ).toBe   (true                                       ) ;
		expect(readFileSync(join(installed, "LICENSE"), "utf8")                         ).toBe   (readFileSync(join(root, "LICENSE"), "utf8")) ;
		expect(JSON.parse(readFileSync(join(installed, "package.json"), "utf8")).license).toBe   ("MIT"                                      ) ;
		expect(manifest.bin                                                             ).toEqual({ boxbox: "dist/cli.js" }                  ) ;
		expect(manifest.dependencies                                                    ).toEqual({ typescript: "7.0.2" }                    ) ;
		expect(manifest.exports     ).toBeUndefined()               ;
		expect(existsSync(join(installed, "dist/internal-runner.js"))).toBe(false);
		const yamlLicense = readFileSync(join(root, "node_modules/yaml/LICENSE"), "utf8");
		expect(readFileSync(join(installed, "THIRD_PARTY_NOTICES"), "utf8")).toBe(`yaml 2.9.1 (ISC)\n\n${yamlLicense}`);
		expect(existsSync(join(installed, "node_modules/yaml"))).toBe(false);
		for (const [name, rows] of [["conventions.jsonl", 2], ["examples.jsonl", 4], ["decisions.jsonl", 2]] as const) {
			const records = readFileSync(join(installed, "rules/presets/recommended", name), "utf8").trim().split("\n").map(line => JSON.parse(line));
			expect(records).toHaveLength(rows);
			expect(records.every(record => record.approvedBy === "maintainer")).toBe(true);
		}
		expect(existsSync(join(installed, "rules/presets/recommended/docs/candidates/initial-rules.md"))).toBe(false);

		const pythonLookup = run("sh", ["-lc", "command -v python3"], { cwd: project });
		expectStatus(pythonLookup, 0);
		const nodeLookup = run("node", ["-p", "process.execPath"], { cwd: project });
		expectStatus(nodeLookup, 0);
		const runtimeNode = realpathSync(nodeLookup.stdout.trim()) ;
		const runtimeBin  = join        (temporary, "runtime-bin") ;
		mkdirSync(runtimeBin);
		symlinkSync(runtimeNode, join(runtimeBin, "node"));
		symlinkSync(realpathSync(pythonLookup.stdout.trim()), join(runtimeBin, "python3"));
		const runtimeEnv = { ...process.env, PATH: [runtimeBin, "/usr/bin", "/bin"].join(":"), XDG_CONFIG_HOME: join(temporary, "xdg") };
		expect(run("sh", ["-lc", "command -v bun"], { cwd: project, env: runtimeEnv }).status).not.toBe(0);
		const nodeIdentity = run(runtimeNode, ["-p", "String(process.versions.bun)"], { cwd: project, env: runtimeEnv });
		expectStatus(nodeIdentity, 0);
		expect(nodeIdentity.stdout.trim()).toBe("undefined");

		const help = run(executable, ["--help"], { cwd: project, env: runtimeEnv });
		expectStatus(help, 0);
		expect(help.stdout).toContain("Usage: boxbox");
		const version = run(executable, ["--version"], { cwd: project, env: runtimeEnv });
		expectStatus(version, 0);
		expect(version.stdout.trim()).toBe(JSON.parse(readFileSync(join(root, "package.json"), "utf8")).version);

		const init = run(executable, ["init", "--json"], { cwd: project, env: runtimeEnv });
		expectStatus(init, 0);
		expect(JSON.parse(init.stdout)).toMatchObject({ command: "init", ok: true, created: true, config: ".boxbox/config.json" });
		expect(existsSync(join(project, ".boxbox/config.json"))).toBe(true);
		const doctor = run(executable, ["doctor", "--json"], { cwd: project, env: runtimeEnv });
		expectStatus(doctor, 0);
		expect(JSON.parse(doctor.stdout)).toMatchObject({ command: "doctor", ok: true, runtimeUsable: true, formatConfigured: true, releaseReady: false });
		const guarded = run(executable, ["run", "--root", project, "--json", "--", "python3", "-c", "open('guarded.py','w').write('x = 1\\n')"], { cwd: project, env: runtimeEnv });
		expectStatus(guarded, 0);
		expect(JSON.parse(guarded.stdout)).toMatchObject({ command: "run", state: "PASS", childExitCode: 0, nativeHookVerified: false, automaticFixPerformed: false });
		const guardedStatus = run(executable, ["status", "--root", project, "--json"], { cwd: project, env: runtimeEnv });
		expectStatus(guardedStatus, 0);
		expect(JSON.parse(guardedStatus.stdout)).toMatchObject({ command: "status", state: "PASS", runs: 1 });
		writeFileSync(join(project, "guarded.py"), "x = 2\n");
		const staleStatus = run(executable, ["status", "--root", project, "--json"], { cwd: project, env: runtimeEnv });
		expectStatus(staleStatus, 0);
		expect(JSON.parse(staleStatus.stdout)).toMatchObject({ state: "STALE", changesSinceRun: ["guarded.py"] });
		const dbInit = run(executable, ["db", "init", "--json"], { cwd: project, env: runtimeEnv });
		expectStatus(dbInit, 0);
		expect(JSON.parse(dbInit.stdout)).toMatchObject({ command: "db init", ok: true, files: [{ name: "conventions", created: true }, { name: "examples", created: true }, { name: "decisions", created: true }] });
		const userDb = join(temporary, "xdg", "boxbox");
		for (const name of ["conventions.jsonl", "examples.jsonl", "decisions.jsonl"]) {
			expect(readFileSync(join(userDb, name), "utf8")).toBe("");
			if (process.platform !== "win32") expect(statSync(join(userDb, name)).mode & 0o777).toBe(0o600);
		}
		const dbStatus = run(executable, ["db", "status", "--json"], { cwd: project, env: runtimeEnv });
		expectStatus(dbStatus, 0);
		const emptyDbStatus = JSON.parse(dbStatus.stdout);
		expect(emptyDbStatus).toMatchObject({ command: "db status", ok: true, exists: true, bytes: 0 });
		expect(emptyDbStatus.files.map((file: { name: string; rows: number; bytes: number; exists: boolean }) => ({ name: file.name, rows: file.rows, bytes: file.bytes, exists: file.exists }))).toEqual([
			{ name : "conventions" , rows : 0 , bytes : 0 , exists : true },
			{ name : "examples"    , rows : 0 , bytes : 0 , exists : true },
			{ name : "decisions"   , rows : 0 , bytes : 0 , exists : true },
		]);

		const authoring = run(executable, ["guide", "--file", "new/sample.ts", "--authoring", "--json"], { cwd: project, env: runtimeEnv });
		expectStatus(authoring, 0);
		expect(JSON.parse(authoring.stdout)).toMatchObject({ basis: "authoring", verification: "not-run", writeAuthorized: false, rules: [{ id: "ts-sourcefile-call-declarations" }] });
		expect(existsSync(join(project, "new"))).toBe(false);

		const jsonTarget = join(project, "sample.json")                         ;
		const jsonSource = "{\n  \"a\":1,\n  \"longer\" : 2,\n  \"x\"  :3\n}\n" ;
		writeFileSync(jsonTarget, jsonSource);
		const jsonCheck = run(executable, ["check", "--file", "sample.json", "--json"], { cwd: project, env: runtimeEnv });
		expectStatus(jsonCheck, 1);
		expect(JSON.parse(jsonCheck.stdout)).toMatchObject({ syntax: { status: "valid", tool: "JSON.parse" }, formatReadiness: { approvalEligible: false }, results: [{ language: "json", summary: { misaligned: 1 } }] });
		const jsonAlign = run(executable, ["align", "--file", "sample.json", "--dry-run", "--json"], { cwd: project, env: runtimeEnv });
		expectStatus(jsonAlign, 2);
		expect(JSON.parse(jsonAlign.stdout)).toMatchObject({ ok: false, error: { code: "ALIGN_NOT_ELIGIBLE" } });
		expect(readFileSync(jsonTarget, "utf8")).toBe(jsonSource);

		writeFileSync(join(project, "invalid.json"), '{"a":1,}\n');
		const invalidJson = run(executable, ["check", "--file", "invalid.json", "--json"], { cwd: project, env: runtimeEnv });
		expectStatus(invalidJson, 2);
		expect(JSON.parse(invalidJson.stdout)).toMatchObject({ syntax: { status: "invalid", tool: "JSON.parse" }, formatReadiness: { approvalEligible: false } });

		const yamlTarget = join(project, "unsupported.yaml")               ;
		const yamlSource = "block: |2\n    keep:  exact\nflow: { a: 1 }\n" ;
		writeFileSync(yamlTarget, yamlSource);
		const yamlCheck = run(executable, ["check", "--file", "unsupported.yaml", "--json"], { cwd: project, env: runtimeEnv });
		expectStatus(yamlCheck, 0);
		expect(JSON.parse(yamlCheck.stdout)).toMatchObject({ syntax: { status: "valid", tool: "yaml@2.9.1" }, formatReadiness: { approvalEligible: false }, results: [{ language: "yaml", summary: { misaligned: 0 } }] });
		expect(readFileSync(yamlTarget, "utf8")).toBe(yamlSource);
		writeFileSync(join(project, "invalid.yaml"), "a: one\na: two\n");
		const invalidYaml = run(executable, ["check", "--file", "invalid.yaml", "--json"], { cwd: project, env: runtimeEnv });
		expectStatus(invalidYaml, 2);
		expect(JSON.parse(invalidYaml.stdout)).toMatchObject({ syntax: { status: "invalid", tool: "yaml@2.9.1" }, formatReadiness: { approvalEligible: false } });

		const target = join(project, "sample.ts");
		writeFileSync(target, "const a = make(1);\nconst muchLonger = make(22);\nconst mid = make(333);\n");
		const original = readFileSync(target                                                                         ) ;
		const check    = run         (executable, ["check", "--file", "sample.ts"], { cwd: project, env: runtimeEnv }) ;
		expectStatus(check, 1);
		expect(readFileSync(target).equals(original)).toBe(true);

		const alignment = run(executable, ["align", "--file", "sample.ts", "--dry-run", "--json"], { cwd: project, env: runtimeEnv });
		expectStatus(alignment, 0);
		expect(JSON.parse(alignment.stdout)                      ).toMatchObject  ({ command: "align", horizontalWhitespaceOnly: true, formatterExecuted: false, written: false }) ;
		expect(JSON.parse(alignment.stdout).alignmentEdits.length).toBeGreaterThan(0                                                                                             ) ;
		expect(readFileSync(target).equals(original)             ).toBe           (true                                                                                          ) ;
		const textPreview = run(executable, ["align", "--file", "sample.ts", "--dry-run"], { cwd: project, env: runtimeEnv });
		expectStatus(textPreview, 0);
		expect(textPreview.stdout).toContain("line 1\n- const a = make(1);\n+ const a");
		expect(readFileSync(target).equals(original)).toBe(true);

		const dryRun = run(executable, ["format", "--file", "sample.ts", "--dry-run", "--json"], { cwd: project, env: runtimeEnv });
		expectStatus(dryRun, 0);
		expect(JSON.parse(dryRun.stdout)).toMatchObject({ formatMode: "standalone", formatterExecuted: false, formatter: null, written: false, approvals: ["ts-sourcefile-call-declarations"] });
		expect(readFileSync(target).equals(original)).toBe(true);
		const standalone = run(executable, ["format", "--file", "sample.ts", "--json"], { cwd: project, env: runtimeEnv });
		expectStatus(standalone, 0);
		expect(JSON.parse(standalone.stdout)).toMatchObject({ written: true, fixedPoint: true, approvals: ["ts-sourcefile-call-declarations"] });
		const standaloneOutput = readFileSync(target                                                                                    ) ;
		const unchanged        = run         (executable, ["format", "--file", "sample.ts", "--json"], { cwd: project, env: runtimeEnv }) ;
		expectStatus(unchanged, 0);
		expect(JSON.parse(unchanged.stdout).written).toBe(false);
		expect(readFileSync(target).equals(standaloneOutput)).toBe(true);
		writeFileSync(target, original);

		const rule      = "synthetic-ts-rule"                                                                                                                                                  ;
		const positive  = `${rule}-positive`                                                                                                                                                   ;
		const counter   = `${rule}-counter`                                                                                                                                                    ;
		const before    = "const a = make(1);\nconst muchLonger = make(22);\nconst mid = make(333);"                                                                                           ;
		const after     = "const a          = make(1  ) ;\nconst muchLonger = make(22 ) ;\nconst mid        = make(333) ;"                                                                     ;
		const document  = "# Test rules\n\n## Table alignment\nsynthetic rule approved only in the artifact test\n\n## JSON mapping\nsynthetic JSON rule approved only in the artifact test\n" ;
		const formatter = join(project, "formatter.mjs")                                                                                                                                       ;
		writeFileSync(formatter, "// explicit no-op formatter for the artifact test\n");
		writeFileSync(join(project, ".boxbox/config.json"), `${JSON.stringify({ schemaVersion: 2, formatters: { typescript: { command: runtimeNode, args: [formatter, "{file}"], timeoutMs: 2_000 } } }, null, 2)}\n`);
		mkdirSync(join(project, ".boxbox/docs"));
		writeFileSync(join(project, ".boxbox/docs/rules.md"), document);
		const convention      = { schemaVersion: 1, id: rule, key: "v1|typescript|SourceFile|declaration-equals|equals>call-open-paren>call-close-paren>semicolon", pattern: "DEFINE", status: "approved", scope: "**", examples: [positive, counter], versions: APPROVAL_VERSIONS, approvedBy: "synthetic-artifact-test", date: "2026-10-04" }                                                                                                                                                ;
		const positiveExample = { schemaVersion: 1, id: positive, status: "approved", versions: APPROVAL_VERSIONS, language: "typescript", regime: "table", patterns: ["DEFINE"], rules: [rule], before, after, contentHash: contentHashOf(before, after), verdict: "after-better", asserts: { after: {} }, source: { kind: "synthetic", license: "test" }, approvedBy: "synthetic-artifact-test", date: "2026-10-04" }                                                                        ;
		const counterExample  = { schemaVersion: 1, id: counter, status: "approved", versions: APPROVAL_VERSIONS, language: "typescript", regime: "table", patterns: ["DEFINE"], rules: [rule], before: "const one = make(1);", after: "const one = make(1);", contentHash: contentHashOf("const one = make(1);", "const one = make(1);"), verdict: "bad", asserts: { after: {} }, source: { kind: "synthetic", license: "test" }, approvedBy: "synthetic-artifact-test", date: "2026-10-04" } ;
		const decision        = { schemaVersion: 1, id: rule, kind: "rule", layer: "convention", ref: ".boxbox/docs/rules.md#Table alignment", docHash: sectionHash(document, "Table alignment"), examples: [positive, counter], approvedBy: "synthetic-artifact-test", date: "2026-10-04" }                                                                                                                                                                                                   ;
		const jsonRule = "synthetic-json-rule", jsonPositive = `${jsonRule}-positive`, jsonCounter = `${jsonRule}-counter`;
		const jsonAfter           = "{\n  \"a\"     : 1,\n  \"longer\": 2,\n  \"x\"     : 3\n}\n"                                                                                                                                  ;
		const jsonConvention      = { ...convention, id: jsonRule, key: "v1|json|object|mapping|key-colon>value", scope: "**/*.json", examples: [jsonPositive, jsonCounter] }                                                      ;
		const jsonPositiveExample = { ...positiveExample, id: jsonPositive, language: "json", rules: [jsonRule], before: jsonSource, after: jsonAfter, contentHash: contentHashOf(jsonSource, jsonAfter) }                         ;
		const jsonCounterExample  = { ...counterExample, id: jsonCounter, language: "json", rules: [jsonRule], before: '{"single":1}\n', after: '{"single":1}\n', contentHash: contentHashOf('{"single":1}\n', '{"single":1}\n') } ;
		const jsonDecision        = { ...decision, id: jsonRule, ref: ".boxbox/docs/rules.md#JSON mapping", docHash: sectionHash(document, "JSON mapping"), examples: [jsonPositive, jsonCounter] }                                ;
		writeFileSync(join(project, ".boxbox/conventions.jsonl"), `${JSON.stringify(convention)}\n${JSON.stringify(jsonConvention)}\n`);
		writeFileSync(join(project, ".boxbox/examples.jsonl"), `${JSON.stringify(positiveExample)}\n${JSON.stringify(counterExample)}\n${JSON.stringify(jsonPositiveExample)}\n${JSON.stringify(jsonCounterExample)}\n`);
		writeFileSync(join(project, ".boxbox/decisions.jsonl"), `${JSON.stringify(decision)}\n${JSON.stringify(jsonDecision)}\n`);

		const guide = run(executable, ["guide", "--file", "sample.ts", "--json"], { cwd: project, env: runtimeEnv });
		expectStatus(guide, 0);
		expect(JSON.parse(guide.stdout)).toMatchObject({ command: "guide", ok: true, conventions: [rule] });
		const formatted = run(executable, ["format", "--file", "sample.ts", "--json"], { cwd: project, env: runtimeEnv, timeout: 60_000 });
		expectStatus(formatted, 0);
		expect(JSON.parse(formatted.stdout)).toMatchObject({ command: "format", ok: true, written: true, fixedPoint: true, approvals: [rule] });
		expect(readFileSync(target, "utf8")).toBe(`${after}\n`);
		const jsonPreview = run(executable, ["format", "--file", "sample.json", "--dry-run", "--json"], { cwd: project, env: runtimeEnv });
		expectStatus(jsonPreview, 0);
		expect(JSON.parse(jsonPreview.stdout)).toMatchObject({ written: false, fixedPoint: true, approvals: [jsonRule] });
		expect(readFileSync(jsonTarget, "utf8")).toBe(jsonSource);
		const jsonFormatted = run(executable, ["format", "--file", "sample.json", "--json"], { cwd: project, env: runtimeEnv });
		expectStatus(jsonFormatted, 0);
		expect(JSON.parse(jsonFormatted.stdout)).toMatchObject({ written: true, fixedPoint: true, approvals: [jsonRule] });
		expect(readFileSync(jsonTarget, "utf8")).toBe(jsonAfter);
		const privatePayload = `{"id":"private-example","body":"PRIVATE_USER_CODE"}\n`;
		writeFileSync(join(userDb, "examples.jsonl"), privatePayload);
		const dbReinit = run(executable, ["db", "init", "--json"], { cwd: project, env: runtimeEnv });
		expectStatus(dbReinit, 0);
		expect(readFileSync(join(userDb, "examples.jsonl"), "utf8")).toBe(privatePayload);
		const privateStatus = run(executable, ["db", "status", "--json"], { cwd: project, env: runtimeEnv });
		expectStatus(privateStatus, 0);
		expect(privateStatus.stdout).not.toContain("PRIVATE_USER_CODE");
		const privateDbStatus = JSON.parse(privateStatus.stdout);
		expect(privateDbStatus.bytes).toBe(Buffer.byteLength(privatePayload));
		expect(privateDbStatus.files.map((file: { name: string; rows: number; bytes: number; exists: boolean }) => ({ name: file.name, rows: file.rows, bytes: file.bytes, exists: file.exists }))).toEqual([
			{ name : "conventions" , rows : 0 , bytes : 0                                 , exists : true },
			{ name : "examples"    , rows : 1 , bytes : Buffer.byteLength(privatePayload) , exists : true },
			{ name : "decisions"   , rows : 0 , bytes : 0                                 , exists : true },
		]);

		const bundle = readFileSync(join(installed, "dist/cli.js"), "utf8");
		for (const forbidden of ["Bun.", "bun:", "@/", root, "internal-runner", "00_normalize-imports", "00_expand-interface-members", "07_wrap-conditions", "08_function-map", "09_observe-shapes"]) {
			expect(bundle).not.toContain(forbidden);
		}
	}, 180_000);
});
