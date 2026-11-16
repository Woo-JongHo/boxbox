import      { spawnSync                    } from "node:child_process"                ;
import      { createRequire                } from "node:module"                       ;
import      { fileURLToPath, pathToFileURL } from "node:url"                          ;
import      { afterEach, expect, test      } from "bun:test"                          ;
import      {
              mkdirSync                  ,
              mkdtempSync                ,
              readFileSync               ,
              rmSync                     ,
              symlinkSync                ,
              writeFileSync
                                           } from "node:fs"                           ;
import      { tmpdir                       } from "node:os"                           ;
import      { join                         } from "node:path"                         ;

import      { inspectionRuntimeIdentity    } from "@/common/40_inspection-context.ts" ;
import type { InspectionIdentityInputs     } from "@/common/40_inspection-context.ts" ;

const roots: string[] = [];

afterEach(() => {
	for (const root of roots.splice(0)) rmSync(root, { recursive: true, force: true });
});

function fixture(source: boolean): { readonly root: string; readonly inputs: InspectionIdentityInputs } {
	const root = mkdtempSync(join(tmpdir(), "boxbox-identity-"));
	roots.push(root);
	for (const directory of ["engine/common", "rules", "typescript", "yaml"]) mkdirSync(join(root, directory), { recursive: true });
	const engineModule = join(root, source ? "engine/common/40_inspection-context.ts" : "cli.js");
	writeFileSync(engineModule, "same engine version");
	writeFileSync(join(root, "rules/rule.json"), "same rule");
	writeFileSync(join(root, "typescript/package.json"), '{"version":"7.0.2"}');
	writeFileSync(join(root, "typescript/client.js"), "same client");
	writeFileSync(join(root, "yaml/index.js"), "same YAML");
	writeFileSync(join(root, "parser"), "same parser");
	writeFileSync(join(root, "runtime"), "same runtime");
	return {
		root,
		inputs: {
			engineModule, rules: join(root, "rules"), typescript: join(root, "typescript"),
			parserExecutable: join(root, "parser"), runtimeExecutable: join(root, "runtime"), yaml: join(root, "yaml"),
			environment: { PATH: "/synthetic/bin", FLAG: "one" }, runtime: { node: "same-version", arch: "test", platform: "test" },
		},
	};
}

for (const source of [true, false]) test(`identity binds ${source ? "source tree" : "bundle"}, rules, parser client/native and runtime bytes despite unchanged versions`, () => {
	const { root, inputs } = fixture(source);
	const initial = inspectionRuntimeIdentity(inputs);
	expect(initial).toMatch(/^sha256:[a-f0-9]{64}$/u);
	expect(inspectionRuntimeIdentity(inputs)).toBe(initial);
	for (const path of [inputs.engineModule, join(root, "rules/rule.json"), join(root, "typescript/client.js"), inputs.parserExecutable, inputs.runtimeExecutable]) {
		const before = readFileSync(path);
		writeFileSync(path, Buffer.from(before.map(byte => byte ^ 1)));
		expect(inspectionRuntimeIdentity(inputs), path).not.toBe(initial);
		writeFileSync(path, before);
		expect(inspectionRuntimeIdentity(inputs), path).toBe(initial);
	}
});

test("source identity includes other engine modules and external YAML; a bundle excludes unrelated source and YAML", () => {
	for (const source of [true, false]) {
		const { root, inputs } = fixture(source);
		const initial = inspectionRuntimeIdentity(inputs);
		writeFileSync(join(root, "engine/other.ts"), "new module");
		if (source) expect(inspectionRuntimeIdentity(inputs)).not.toBe(initial);
		else expect(inspectionRuntimeIdentity(inputs)).toBe(initial);
		const beforeYaml = inspectionRuntimeIdentity(inputs);
		writeFileSync(join(root, "yaml/index.js"), "changed YAML");
		if (source) expect(inspectionRuntimeIdentity(inputs)).not.toBe(beforeYaml);
		else expect(inspectionRuntimeIdentity(inputs)).toBe(beforeYaml);
	}
});

test("environment and runtime metadata invalidate identity while entry order does not", () => {
	const { inputs } = fixture(true);
	const initial = inspectionRuntimeIdentity(inputs);
	expect(inspectionRuntimeIdentity({ ...inputs, environment: { FLAG: "one", PATH: "/synthetic/bin" } }     ))    .toBe(initial) ;
	expect(inspectionRuntimeIdentity({ ...inputs, environment: { ...inputs.environment, FLAG: "two" } }      )).not.toBe(initial) ;
	expect(inspectionRuntimeIdentity({ ...inputs, runtime: { ...inputs.runtime, node: "different-version" } })).not.toBe(initial) ;
});

test("unknown module formats, missing dependencies and internal symlinks disable reuse", () => {
	const { root, inputs } = fixture(true);
	expect(inspectionRuntimeIdentity({ ...inputs, engineModule: join(root, "engine.cjs") })).toBeNull();
	expect(inspectionRuntimeIdentity({ ...inputs, parserExecutable: join(root, "missing") })).toBeNull();
	expect(inspectionRuntimeIdentity({ ...inputs, yaml: undefined })).toBeNull();
	symlinkSync(inputs.runtimeExecutable, join(root, "typescript/linked-runtime"));
	expect(inspectionRuntimeIdentity(inputs)).toBeNull();
});

test("a linked package root resolves intentionally and target byte changes still invalidate", () => {
	const { root, inputs } = fixture(true);
	const linked = join(root, "typescript-link");
	symlinkSync(inputs.typescript, linked);
	const linkedInputs = { ...inputs, typescript: linked }       ;
	const initial      = inspectionRuntimeIdentity(linkedInputs) ;
	expect(initial).not.toBeNull();
	writeFileSync(join(inputs.typescript, "client.js"), "changed client");
	expect(inspectionRuntimeIdentity(linkedInputs)).not.toBe(initial);
});

test("the installed TypeScript resolver produces a measurable real runtime identity", () => {
	expect(inspectionRuntimeIdentity()).toMatch(/^sha256:[a-f0-9]{64}$/u);
});


test("a standalone Node bundle computes default identity without an external YAML installation", async () => {
	const root = mkdtempSync(join(tmpdir(), "boxbox-bundle-identity-"));
	roots.push(root);
	mkdirSync(join(root, "dist"));
	mkdirSync(join(root, "rules"));
	mkdirSync(join(root, "node_modules"));
	const require    = createRequire(import.meta.url                                                        ) ;
	const typescript = fileURLToPath(new URL(".", pathToFileURL(require.resolve("typescript/package.json")))) ;
	symlinkSync(typescript, join(root, "node_modules/typescript"), "junction");
	const entrypoint = fileURLToPath(new URL("../product/engine/common/40_inspection-context.ts", import.meta.url))                                      ;
	const module     = join(root, "dist/identity.mjs")                                                                                                   ;
	const built      = await Bun.build({ entrypoints: [entrypoint], outdir: join(root, "dist"), naming: "identity.mjs", target: "node", format: "esm" }) ;
	expect(built.success).toBe(true);
	const script = `import {createRequire} from "node:module"; import {inspectionRuntimeIdentity} from ${JSON.stringify(pathToFileURL(module).href)}; const require=createRequire(${JSON.stringify(pathToFileURL(module).href)}); let yamlInstalled=true; try {require.resolve("yaml/package.json")} catch {yamlInstalled=false} process.stdout.write(JSON.stringify({yamlInstalled,identity:inspectionRuntimeIdentity()}));` ;
	const run    = spawnSync("node", ["--input-type=module", "--eval", script], { cwd: root, encoding: "utf8", env: { ...process.env, NODE_PATH: "" }, timeout: 20_000 })                                                                                                                                                                                                                                                     ;
	expect(run.status, run.stderr).toBe(0);
	const observed = JSON.parse(run.stdout);
	expect(observed.yamlInstalled).toBe(false);
	expect(observed.identity).toMatch(/^sha256:[a-f0-9]{64}$/u);
});
