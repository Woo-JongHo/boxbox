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
	const value = mkdtempSync(join(import.meta.dir, "xxx-public-artifact-"));
	workspaces.push(value);
	return value;
}

function run(command: string, args: readonly string[], options: { readonly cwd: string; readonly env?: NodeJS.ProcessEnv; readonly timeout?: number }) {
	return spawnSync(command, args, {
		cwd      : options.cwd,
		env      : options.env,
		encoding : "utf8",
		timeout  : options.timeout ?? 120_000,
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
	test("the isolated installed xxx bin keeps the empty preset and applies only synthetic project approvals safely", () => {
		const temporary = workspace()                    ;
		const project   = join(temporary, "project")     ;
		const packs     = join(temporary, "public-pack") ;
		mkdirSync(project);
		mkdirSync(packs);

		expectStatus(run("bun", ["run", "build:cli"], { cwd: root }), 0);
		const packed = run("npm", ["pack", resolve(root, "dist/cli"), "--pack-destination", packs, "--json"], { cwd: temporary });
		expectStatus(packed, 0);
		const packResult = JSON.parse(packed.stdout) as [{ readonly filename: string; readonly files: readonly { readonly path: string }[] }];
		expect(packResult[0]!.files.map(file => file.path).sort()).toEqual([
			"README.md",
			"dist/cli.js",
			"package.json",
			"presets/recommended/conventions.jsonl",
			"presets/recommended/decisions.jsonl",
			"presets/recommended/examples.jsonl",
		]);

		writeFileSync(join(project, "package.json"), '{"private":true,"type":"module"}\n');
		const tarball = join(packs, packResult[0]!.filename);
		expectStatus(run("npm", ["install", "--offline", "--ignore-scripts", "--no-audit", "--no-fund", tarball], { cwd: project }), 0);

		const installed  = join(project, "node_modules/xxx")                                                                                                                                                                                   ;
		const executable = join(project, "node_modules/.bin/xxx")                                                                                                                                                                              ;
		const manifest   = JSON.parse(readFileSync(join(installed, "package.json"), "utf8")) as { readonly private: boolean; readonly bin: Record<string, string>; readonly dependencies: Record<string, string>; readonly exports?: unknown } ;
		expect(manifest.private     ).toBe   (true                   ) ;
		expect(manifest.bin         ).toEqual({ xxx: "dist/cli.js" } ) ;
		expect(manifest.dependencies).toEqual({ typescript: "7.0.2" }) ;
		expect(manifest.exports     ).toBeUndefined()               ;
		expect(existsSync(join(installed, "dist/internal-runner.js"))).toBe(false);
		for (const name of ["conventions.jsonl", "examples.jsonl", "decisions.jsonl"]) {
			expect(readFileSync(join(installed, "presets/recommended", name), "utf8")).toBe("");
		}
		expect(existsSync(join(installed, "presets/recommended/docs/candidates/initial-rules.md"))).toBe(false);

		const pythonLookup = run("sh", ["-lc", "command -v python3"], { cwd: project });
		expectStatus(pythonLookup, 0);
		const nodeLookup = run("node", ["-p", "process.execPath"], { cwd: project });
		expectStatus(nodeLookup, 0);
		const runtimeNode = realpathSync(nodeLookup.stdout.trim()) ;
		const runtimeBin  = join(temporary, "runtime-bin")         ;
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
		expect(help.stdout).toContain("Usage: xxx");
		const version = run(executable, ["--version"], { cwd: project, env: runtimeEnv });
		expectStatus(version, 0);
		expect(version.stdout.trim()).toBe("0.2.0");

		const init = run(executable, ["init", "--json"], { cwd: project, env: runtimeEnv });
		expectStatus(init, 0);
		expect(JSON.parse(init.stdout)).toMatchObject({ command: "init", ok: true, created: true, config: ".xxx/config.json" });
		expect(existsSync(join(project, ".xxx/config.json"))).toBe(true);
		const doctor = run(executable, ["doctor", "--json"], { cwd: project, env: runtimeEnv });
		expectStatus(doctor, 0);
		expect(JSON.parse(doctor.stdout)).toMatchObject({ command: "doctor", ok: true, runtimeUsable: true, formatConfigured: false, releaseReady: false });
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
		const userDb = join(temporary, "xdg", "xxx");
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

		const target = join(project, "sample.ts");
		writeFileSync(target, "const a = make(1);\nconst muchLonger = make(22);\nconst mid = make(333);\n");
		const original = readFileSync(target)                                                                 ;
		const check    = run(executable, ["check", "--file", "sample.ts"], { cwd: project, env: runtimeEnv }) ;
		expectStatus(check, 1);
		expect(readFileSync(target).equals(original)).toBe(true);

		const dryRun = run(executable, ["format", "--file", "sample.ts", "--dry-run"], { cwd: project, env: runtimeEnv });
		expectStatus(dryRun, 2);
		expect(dryRun.stderr).toContain("format refused");
		expect(readFileSync(target).equals(original)).toBe(true);
		const refused = run(executable, ["format", "--file", "sample.ts"], { cwd: project, env: runtimeEnv });
		expectStatus(refused, 2);
		expect(refused.stderr).toContain("format refused");
		expect(readFileSync(target).equals(original)).toBe(true);

		const rule      = "synthetic-ts-rule"                                                                              ;
		const positive  = `${rule}-positive`                                                                               ;
		const counter   = `${rule}-counter`                                                                                ;
		const before    = "const a = make(1);\nconst muchLonger = make(22);\nconst mid = make(333);"                       ;
		const after     = "const a          = make(1  ) ;\nconst muchLonger = make(22 ) ;\nconst mid        = make(333) ;" ;
		const document  = "# Test rules\n\n## Table alignment\nsynthetic rule approved only in the artifact test\n"        ;
		const formatter = join(project, "formatter.mjs")                                                                   ;
		writeFileSync(formatter, "// explicit no-op formatter for the artifact test\n");
		writeFileSync(join(project, ".xxx/config.json"), `${JSON.stringify({ schemaVersion: 2, formatters: { typescript: { command: runtimeNode, args: [formatter, "{file}"], timeoutMs: 2_000 } } }, null, 2)}\n`);
		mkdirSync(join(project, ".xxx/docs"));
		writeFileSync(join(project, ".xxx/docs/rules.md"), document);
		const convention      = { schemaVersion: 1, id: rule, key: "v1|typescript|SourceFile|declaration-equals|equals>call-open-paren>call-close-paren>semicolon", pattern: "DEFINE", status: "approved", scope: "**", examples: [positive, counter], versions: APPROVAL_VERSIONS, approvedBy: "synthetic-artifact-test", date: "2026-10-04" }                                                                                                                                                ;
		const positiveExample = { schemaVersion: 1, id: positive, status: "approved", versions: APPROVAL_VERSIONS, language: "typescript", regime: "table", patterns: ["DEFINE"], rules: [rule], before, after, contentHash: contentHashOf(before, after), verdict: "after-better", asserts: { after: {} }, source: { kind: "synthetic", license: "test" }, approvedBy: "synthetic-artifact-test", date: "2026-10-04" }                                                                        ;
		const counterExample  = { schemaVersion: 1, id: counter, status: "approved", versions: APPROVAL_VERSIONS, language: "typescript", regime: "table", patterns: ["DEFINE"], rules: [rule], before: "const one = make(1);", after: "const one = make(1);", contentHash: contentHashOf("const one = make(1);", "const one = make(1);"), verdict: "bad", asserts: { after: {} }, source: { kind: "synthetic", license: "test" }, approvedBy: "synthetic-artifact-test", date: "2026-10-04" } ;
		const decision        = { schemaVersion: 1, id: rule, kind: "rule", layer: "convention", ref: ".xxx/docs/rules.md#Table alignment", docHash: sectionHash(document, "Table alignment"), examples: [positive, counter], approvedBy: "synthetic-artifact-test", date: "2026-10-04" }                                                                                                                                                                                                      ;
		writeFileSync(join(project, ".xxx/conventions.jsonl"), `${JSON.stringify(convention)}\n`);
		writeFileSync(join(project, ".xxx/examples.jsonl"), `${JSON.stringify(positiveExample)}\n${JSON.stringify(counterExample)}\n`);
		writeFileSync(join(project, ".xxx/decisions.jsonl"), `${JSON.stringify(decision)}\n`);

		const guide = run(executable, ["guide", "--file", "sample.ts", "--json"], { cwd: project, env: runtimeEnv });
		expectStatus(guide, 0);
		expect(JSON.parse(guide.stdout)).toMatchObject({ command: "guide", ok: true, conventions: [rule] });
		const formatted = run(executable, ["format", "--file", "sample.ts", "--json"], { cwd: project, env: runtimeEnv, timeout: 60_000 });
		expectStatus(formatted, 0);
		expect(JSON.parse(formatted.stdout)).toMatchObject({ command: "format", ok: true, written: true, fixedPoint: true, approvals: [rule] });
		expect(readFileSync(target, "utf8")).toBe(`${after}\n`);
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
