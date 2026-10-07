import      { afterEach, describe, expect, test } from "bun:test"                   ;
import      {
              mkdirSync                       ,
              mkdtempSync                     ,
              readFileSync                    ,
              rmSync                          ,
              symlinkSync                     ,
              writeFileSync                   ,
                                                } from "node:fs"                    ;
import      { join                              } from "node:path"                  ;

import      {
              initializeProjectConfig         ,
              readProjectConfig               ,
              resolveConfig                   ,
              validateProjectConfig           ,
                                                } from "@/common/project-config.ts" ;

const workspaces: string[] = [];

afterEach(() => {
	for (const workspace of workspaces.splice(0)) rmSync(workspace, { recursive: true, force: true });
});

function workspace(): string {
	const path = mkdtempSync(join(import.meta.dir, "config-layers-"));
	workspaces.push(path);
	return path;
}

function writeConfig(path: string, value: unknown): void {
	mkdirSync(join(path, ".."), { recursive: true });
	writeFileSync(path, `${JSON.stringify(value, null, 2)}\n`);
}

const prettier = { command: "prettier", args: ["--write", "{file}"] }                       ;
const black    = { command: "python3", args: ["-m", "black", "{file}"], timeoutMs: 15_000 } ;

describe("config layers", () => {
	test("replaces arrays and per-language formatters in Base → Preset → User → Project order", () => {
		const root     = workspace()                          ;
		const userRoot = workspace()                          ;
		const user     = join(userRoot, "xxx", "config.json") ;
		writeConfig(user, { schemaVersion: 2, languages: ["python"], formatters: { typescript: prettier, python: black } });
		writeConfig(join(root, ".xxx", "config.json"), { schemaVersion: 2, languages: ["typescript"], formatters: { typescript: { command: "biome", args: ["format", "--write", "{file}"], timeoutMs: 1000 } } });
		const resolved = resolveConfig(root, {
			userConfigPath : user,
			preset         : { schemaVersion: 2, languages: ["typescript", "python"], formatters: { python: { command: "ruff", args: ["format", "{file}"], timeoutMs: 2000 } } },
		});
		expect(resolved.effective.languages                       ).toEqual(["typescript"]                       ) ;
		expect(resolved.effective.formatters.typescript?.command  ).toBe   ("biome"                              ) ;
		expect(resolved.effective.formatters.typescript?.timeoutMs).toBe   (1000                                 ) ;
		expect(resolved.effective.formatters.python               ).toEqual({ ...black, timeoutMs: 15_000 }      ) ;
		expect(resolved.sources.map(source => source.layer)       ).toEqual(["base", "preset", "user", "project"]) ;
	});

	test("schema 1 migrates only in memory and never changes the original", () => {
		const root = workspace()                       ;
		const path = join(root, ".xxx", "config.json") ;
		writeConfig(path, { schemaVersion: 1, languages: ["python"] });
		const before   = readFileSync(path, "utf8")                                               ;
		const direct   = readProjectConfig(root)!                                                 ;
		const resolved = resolveConfig(root, { userConfigPath: join(root, "missing-user.json") }) ;
		expect(direct.schemaVersion                                                 ).toBe   (2         ) ;
		expect(direct.languages                                                     ).toEqual(["python"]) ;
		expect(resolved.sources.find(source => source.layer === "project")?.migrated).toBe   (1         ) ;
		expect(readFileSync(path, "utf8")                                           ).toBe   (before    ) ;
	});

	test("schema 2 init writes a minimal file that does not shadow upper-layer values", () => {
		const root   = workspace()                   ;
		const result = initializeProjectConfig(root) ;
		expect(result.created).toBe(true);
		expect(JSON.parse(readFileSync(result.path, "utf8"))).toEqual({ schemaVersion: 2 });
		const resolved = resolveConfig(root, { userConfigPath: join(root, "missing-user.json"), preset: { schemaVersion: 2, languages: ["python"] } });
		expect(resolved.effective.languages).toEqual(["python"]);
	});

	test("refuses unknown fields, safety overrides and future schemas fail-closed", () => {
		expect(() => validateProjectConfig({ schemaVersion: 2, safety: { tokenPreservation: false } }, "config")).toThrow("unsupported config option: safety"  ) ;
		expect(() => validateProjectConfig({ schemaVersion: 2, surprise: true }, "config")                      ).toThrow("unsupported config option: surprise") ;
		expect(() => validateProjectConfig({ schemaVersion: 3 }, "config")                                      ).toThrow("unsupported schemaVersion 3"        ) ;
		expect(() => validateProjectConfig({ schemaVersion: 2, preset: "custom" }, "config")                    ).toThrow("preset must be recommended"         ) ;
	});

	test("strictly validates the formatter command contract and timeout bounds", () => {
		const config = (formatter: unknown): unknown => ({ schemaVersion: 2, formatters: { python: formatter } });
		expect(() => validateProjectConfig(config({ command: "black", args: [] }), "config")                                ).toThrow("exactly one {file}"              ) ;
		expect(() => validateProjectConfig(config({ command: "black", args: ["{file}", "{file}"] }), "config")              ).toThrow("exactly one {file}"              ) ;
		expect(() => validateProjectConfig(config({ command: "black --write", args: ["{file}"], shell: true }), "config")   ).toThrow("unsupported config option: shell") ;
		expect(() => validateProjectConfig(config({ command: "black", args: ["{file}", 1] }), "config")                     ).toThrow("array of strings"                ) ;
		expect(() => validateProjectConfig(config({ command: "black", args: ["{file}"], timeoutMs: 0 }), "config")          ).toThrow("1 to 60000"                      ) ;
		expect(() => validateProjectConfig(config({ command: "black", args: ["{file}"], timeoutMs: 60_001 }), "config")     ).toThrow("1 to 60000"                      ) ;
		expect(validateProjectConfig(config({ command: "black", args: ["{file}"] }), "config").formatters?.python?.timeoutMs).toBe   (30_000                            ) ;
	});

	test("refuses empty languages and unsupported formatter languages", () => {
		expect(() => validateProjectConfig({ schemaVersion: 2, languages: [] }, "config")                                  ).toThrow("non-empty array");
		expect(() => validateProjectConfig({ schemaVersion: 2, formatters: { rust: prettier } }, "config")                 ).toThrow("unsupported config option: rust");
	});

	test("missing layers keep defaults, the fingerprint is deterministic and detects raw changes", () => {
		const root   = workspace()                                   ;
		const user   = join(root, "missing", "config.json")          ;
		const first  = resolveConfig(root, { userConfigPath: user }) ;
		const second = resolveConfig(root, { userConfigPath: user }) ;
		expect(first.effective.languages).toEqual(["typescript", "python"]);
		expect(first.fingerprint).toBe(second.fingerprint);
		const path = join(root, ".xxx", "config.json");
		writeConfig(path, { schemaVersion: 2 });
		const compact = resolveConfig(root, { userConfigPath: user });
		writeFileSync(path, '{ "schemaVersion": 2 }\n');
		const spaced = resolveConfig(root, { userConfigPath: user });
		expect(compact.effective).toEqual(spaced.effective);
		expect(compact.fingerprint).not.toBe(spaced.fingerprint);
	});

	test("refuses project and user config symbolic links", () => {
		const root    = workspace() ;
		const outside = workspace() ;
		writeConfig(join(outside, "config.json"), { schemaVersion: 2 });
		symlinkSync(outside, join(root, ".xxx"));
		expect(() => resolveConfig(root, { userConfigPath: join(root, "missing-user.json") })).toThrow("symlink");
		rmSync(join(root, ".xxx"));
		const userRoot = workspace();
		mkdirSync(join(userRoot, "xxx"));
		symlinkSync(join(outside, "config.json"), join(userRoot, "xxx", "config.json"));
		expect(() => resolveConfig(root, { userConfigPath: join(userRoot, "xxx", "config.json") })).toThrow("symlink");
	});
});
