import      { afterAll, expect, test                               } from "bun:test"           ;
import      { spawnSync                                            } from "node:child_process" ;
import      { createHash                                           } from "node:crypto"        ;
import      {
              chmodSync                                          ,
              cpSync                                             ,
              existsSync                                         ,
              mkdirSync                                          ,
              mkdtempSync                                        ,
              readFileSync                                       ,
              realpathSync                                       ,
              rmSync                                             ,
              writeFileSync                                      ,
                                                                       } from "node:fs"            ;
import      { tmpdir                                               } from "node:os"            ;
import      { join, resolve                                        } from "node:path"          ;

const ROOT                 = resolve(import.meta.dir, "..")                                                                ;
const VERSION              = (JSON.parse(readFileSync(join(ROOT, "package.json"), "utf8")) as { version: string }).version ;
const workspaces: string[] = []                                                                                            ;

function temporary(): string {
	const path = mkdtempSync(join(tmpdir(), "boxbox installer integrity "));
	workspaces.push(path);
	return realpathSync(path);
}

function run(command: string, args: readonly string[], options: Parameters<typeof spawnSync>[2] = {}) {
	return spawnSync(command, args, { encoding: "utf8", timeout: 30_000, ...options });
}

function expectStatus(result: ReturnType<typeof run>, status: number): void {
	expect({ status: result.status, error: result.error?.message, output: `${result.stdout}\n${result.stderr}` }).toMatchObject({ status });
}

function digest(path: string): string {
	return createHash("sha256").update(readFileSync(path)).digest("hex");
}

function engineArchive(workspace: string, identity: string, version = VERSION): string {
	const source = join(workspace, `${identity} engine` ) ;
	const output = join(workspace, `${identity} archive`) ;
	mkdirSync(join(source, "dist"), { recursive: true });
	mkdirSync(output);
	writeFileSync(join(source, "package.json"), JSON.stringify({ name: "boxbox", version }, null, "\t") + "\n");
	writeFileSync(join(source, "identity.txt"), identity + "\n");
	writeFileSync(join(source, "dist/cli.js"), `if (process.argv.includes("--version")) console.log(${JSON.stringify(version)});\n`);
	const packed = run("npm", ["pack", source, "--pack-destination", output, "--json"]);
	expectStatus(packed, 0);
	return join(output, (JSON.parse(String(packed.stdout)) as Array<{ filename: string }>)[0]!.filename);
}

function preparedPayload(workspace: string, archive: string, engineSha256: unknown): string {
	const root                              = join(workspace, "payload")                                                         ;
	const metadata: Record<string, unknown> = { name: "boxbox", version: VERSION, host: "codex", marketplace: "boxbox-plugins" } ;
	if (engineSha256 !== undefined) metadata.engineSha256 = engineSha256;
	mkdirSync(join(root, "packages"), { recursive: true });
	for (const name of ["install.mjs", "platform.mjs", "install-state.mjs", "claude-registration.mjs"]) cpSync(join(ROOT, "product/installer", name), join(root, name));
	cpSync(archive, join(root, "packages", `boxbox-${VERSION}.tgz`));
	mkdirSync(join(root, "plugin/scripts"), { recursive: true });
	mkdirSync(join(root, "plugin/skills/boxbox"), { recursive: true });
	mkdirSync(join(root, "plugin/hooks"), { recursive: true });
	writeFileSync(join(root, "plugin/skills/boxbox/SKILL.md"), "@BOXBOX_ENGINE_COMMAND@ doctor\n");
	writeFileSync(join(root, "plugin/hooks/hooks.json"), JSON.stringify({ hooks: { SessionStart: [{ hooks: [{}] }], PostToolUse: [{ hooks: [{}] }], Stop: [{ hooks: [{}] }] } }) + "\n");
	writeFileSync(join(root, "bundle.json"), JSON.stringify(metadata) + "\n");
	writeFileSync(join(root, ".boxbox-install-state.json"), JSON.stringify({ schema: 1, root: realpathSync(root), name: metadata.name, version: metadata.version, host: metadata.host, marketplace: metadata.marketplace, phase: "prepared" }) + "\n");
	return root;
}

function guardedEnvironment(workspace: string, npmMarker: string, hostMarker: string): NodeJS.ProcessEnv {
	const bin = join(workspace, "guarded bin");
	mkdirSync(bin);
	writeFileSync(join(bin, "npm"), `#!/bin/sh\n: > ${JSON.stringify(npmMarker)}\nexit 99\n`);
	writeFileSync(join(bin, "codex"), `#!/bin/sh\n: > ${JSON.stringify(hostMarker)}\nexit 99\n`);
	chmodSync(join(bin, "npm"), 0o755);
	chmodSync(join(bin, "codex"), 0o755);
	return { ...process.env, PATH: bin };
}

afterAll(() => {
	for (const path of workspaces) rmSync(path, { recursive: true, force: true });
});

test("a matching bundled engine installs locally and its CLI version remains enforced", () => {
	const workspace = temporary      ()                                                                  ;
	const matching  = engineArchive  (workspace, "matching"                                            ) ;
	const payload   = preparedPayload(workspace, matching, digest(matching)                            ) ;
	const installed = run            (process.execPath, [join(payload, "install.mjs"), "--engine-only"]) ;
	expectStatus(installed, 0);
	expect(readFileSync(join(payload, "runtime/node_modules/boxbox/identity.txt"), "utf8")).toBe("matching\n");

	const wrongVersion = engineArchive  (workspace, "wrong version", `${VERSION}-other`                        ) ;
	const rejected     = preparedPayload(join(workspace, "version control"), wrongVersion, digest(wrongVersion)) ;
	const result       = run            (process.execPath, [join(rejected, "install.mjs"), "--engine-only"]    ) ;
	expectStatus(result, 1);
	expect(`${result.stdout}\n${result.stderr}`).toContain(`Installed engine version mismatch: ${VERSION}-other`);
});

test("foreign bytes and invalid integrity metadata fail before npm or runtime writes", () => {
	const workspace = temporary    ()                      ;
	const expected  = engineArchive(workspace, "expected") ;
	const foreign   = engineArchive(workspace, "foreign" ) ;
	for (const [label, value, message] of [
		["foreign bytes", digest(expected), "Bundled engine integrity check failed"],
		["missing metadata", undefined, "Bundled engine integrity metadata is missing or invalid"],
		["malformed metadata", "A".repeat(64), "Bundled engine integrity metadata is missing or invalid"],
	] as const) {
		const payload    = preparedPayload(join(workspace, label), foreign, value                                                                                      ) ;
		const npmMarker  = join           (workspace, `${label} npm was called`                                                                                        ) ;
		const hostMarker = join           (workspace, `${label} host was called`                                                                                       ) ;
		const result     = run            (process.execPath, [join(payload, "install.mjs")], { env: guardedEnvironment(join(workspace, label), npmMarker, hostMarker) }) ;
		expectStatus(result, 1);
		expect(`${result.stdout}\n${result.stderr}`            ).toContain(message) ;
		expect(existsSync(npmMarker                      )     ).toBe     (false  ) ;
		expect(existsSync(hostMarker                     )     ).toBe     (false  ) ;
		expect(existsSync(join(payload, "runtime")      )      ).toBe     (false  ) ;
		expect(existsSync(join(payload, "plugin/runtime.json"))).toBe     (false  ) ;
	}
});
