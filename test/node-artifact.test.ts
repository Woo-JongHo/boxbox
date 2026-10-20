import      {
              afterEach     ,
              describe      ,
              expect        ,
              test          ,
                              } from "bun:test"           ;
import      {
              existsSync    ,
              mkdtempSync   ,
              mkdirSync     ,
              readFileSync  ,
              realpathSync  ,
              rmSync        ,
              symlinkSync   ,
              writeFileSync ,
                              } from "node:fs"            ;
import      { join, resolve   } from "node:path"          ;
import      { spawnSync       } from "node:child_process" ;

const root                  = resolve(import.meta.dir, "..") ;
const workspaces : string[] = []                             ;

function workspace(): string {
	const value = mkdtempSync(join(import.meta.dir, "boxbox-node-artifact-"));
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

function expectSuccess(result: ReturnType<typeof run>): void {
	expect(result.error).toBeUndefined();
	expect(`${result.stdout}\n${result.stderr}`).not.toContain("ETIMEDOUT");
	expect(result.status, `${result.stdout}\n${result.stderr}`).toBe(0);
}

afterEach(() => {
	for (const value of workspaces.splice(0)) rmSync(value, { recursive: true, force: true });
});

describe("Node-only local package artifact", () => {
	test("the isolated installed tarball fixes and rechecks TypeScript/Python without Bun or the repository", () => {
		const temporary = workspace()                ;
		const project   = join(temporary, "project") ;
		const packs     = join(temporary, "packs")   ;
		mkdirSync(project);
		mkdirSync(packs);

		expectSuccess(run("bun", ["run", "build:node-artifact"], { cwd: root }));
		const packed = run("npm", ["pack", resolve(root, "dist/engine"), "--pack-destination", packs, "--json"], { cwd: temporary });
		expectSuccess(packed);
		const packResult = JSON.parse(packed.stdout) as [{ readonly filename: string; readonly files: readonly { readonly path: string }[] }];
		expect(packResult[0]!.files.map(file => file.path).sort()).toEqual([
			"README.md",
			"dist/internal-runner.js",
			"package.json",
		]);

		writeFileSync(join(project, "package.json"), '{"private":true,"type":"module"}\n');
		const tarball = join(packs, packResult[0]!.filename)                                                                           ;
		const install = run("npm", ["install", "--offline", "--ignore-scripts", "--no-audit", "--no-fund", tarball], { cwd: project }) ;
		expectSuccess(install);

		const installed = join(project, "node_modules/boxbox")                                                                                                                                      ;
		const runner    = join(installed, "dist/internal-runner.js")                                                                                                                                ;
		const manifest  = JSON.parse(readFileSync(join(installed, "package.json"), "utf8")) as { readonly private: boolean; readonly dependencies: Record<string, string>; readonly bin?: unknown } ;
		expect(manifest.private).toBe(true);
		expect(manifest.bin).toBeUndefined();
		expect(manifest.dependencies).toEqual({ typescript: "7.0.2" });
		expect(existsSync(join(project, "node_modules/typescript/lib/getExePath.js"))).toBe(true);
		const nativePackage = `typescript-${process.platform}-${process.arch}`;
		expect(existsSync(join(project, "node_modules/@typescript", nativePackage, "package.json"))).toBe(true);

		const pythonLookup = run("sh", ["-lc", "command -v python3"], { cwd: project });
		expectSuccess(pythonLookup);
		const nodeLookup = run("node", ["-p", "process.execPath"], { cwd: project });
		expectSuccess(nodeLookup);
		const runtimeNode = realpathSync(nodeLookup.stdout.trim()) ;
		const runtimeBin  = join(temporary, "runtime-bin")         ;
		mkdirSync(runtimeBin);
		symlinkSync(runtimeNode, join(runtimeBin, "node"));
		symlinkSync(realpathSync(pythonLookup.stdout.trim()), join(runtimeBin, "python3"));
		const runtimePath = [runtimeBin, "/usr/bin", "/bin"].join(":") ;
		const runtimeEnv  = { ...process.env, PATH: runtimePath }      ;
		expect(run("sh", ["-lc", "command -v bun"], { cwd: project, env: runtimeEnv }).status).not.toBe(0);
		const nodeIdentity = run(runtimeNode, ["-p", "String(process.versions.bun)"], { cwd: project, env: runtimeEnv });
		expectSuccess(nodeIdentity);
		expect(nodeIdentity.stdout.trim()).toBe("undefined");

		const typescript = join(project, "sample.ts") ;
		const python     = join(project, "sample.py") ;
		writeFileSync(typescript, "const a = make(1);\nconst muchLonger = make(22);\nconst mid = make(333);\n");
		writeFileSync(python, "class Example:\n    a: int = 1\n    much_longer: str = 'x'\n    mid: bool = True\n");

		for (const [language, target] of [["typescript", typescript], ["python", python]] as const) {
			const original = readFileSync(target);
			expect(run(runtimeNode, [runner, language, "--file", target], { cwd: project, env: runtimeEnv }).status).toBe(1);
			expect(readFileSync(target).equals(original)).toBe(true);

			const write = run(runtimeNode, [runner, language, "--file", target, "--write"], { cwd: project, env: runtimeEnv });
			expectSuccess(write);
			const aligned = readFileSync(target);
			expect(aligned.equals(original)).toBe(false);
			expectSuccess(run(runtimeNode, [runner, language, "--file", target], { cwd: project, env: runtimeEnv }));
			expectSuccess(run(runtimeNode, [runner, language, "--file", target, "--write"], { cwd: project, env: runtimeEnv }));
			expect(readFileSync(target).equals(aligned)).toBe(true);
		}

		const noPython = join(project, "no-python.py");
		writeFileSync(noPython, "class Example:\n    a: int = 1\n    much_longer: str = 'x'\n    mid: bool = True\n");
		const beforeFailure = readFileSync(noPython)           ;
		const nodeOnlyBin   = join(temporary, "node-only-bin") ;
		mkdirSync(nodeOnlyBin);
		symlinkSync(runtimeNode, join(nodeOnlyBin, "node"));
		const failure = run(runtimeNode, [runner, "python", "--file", noPython, "--write"], {
			cwd : project,
			env : { ...process.env, PATH: nodeOnlyBin },
		});
		expect(failure.status).not.toBe(0);
		expect(readFileSync(noPython).equals(beforeFailure)).toBe(true);

		const bundle = readFileSync(runner, "utf8");
		for (const forbidden of ["Bun.", "bun:", "@/", root, "00_normalize-imports", "07_wrap-conditions", "08_function-map", "09_observe-shapes"]) {
			expect(bundle).not.toContain(forbidden);
		}
	}, 180_000);
});
