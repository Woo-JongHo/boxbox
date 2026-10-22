import      { afterEach, expect, test                   } from "bun:test"                             ;
import      {
              existsSync                              ,
              mkdirSync                               ,
              mkdtempSync                             ,
              readFileSync                            ,
              rmSync                                  ,
              symlinkSync                             ,
              writeFileSync                           ,
                                                        } from "node:fs"                              ;
import      { tmpdir                                    } from "node:os"                              ;
import      { join                                      } from "node:path"                            ;

import      { applyProductIdentity, planProductIdentity } from "../development/tools/sync-product.ts" ;

const temporary: string[] = [];

afterEach(() => {
	for (const path of temporary.splice(0)) rmSync(path, { recursive: true, force: true });
});

function workspace(): string {
	const parent = mkdtempSync(join(tmpdir(), "product-identity-"));
	temporary.push(parent);
	const root = join(parent, "98_BeforeGrid");
	for (const directory of ["development/tools", "development/skills/beforegrid", "plugin/scripts", "development/harness/evidence", ".beforegrid/cache", ".github/workflows"]) mkdirSync(join(root, directory), { recursive: true });
	writeFileSync(join(root, "product.json"), JSON.stringify({ displayName: "AfterGrid" }));
	writeFileSync(join(root, "development/tools/product-identity.generated.json"), JSON.stringify({ displayName: "BeforeGrid", id: "beforegrid", envPrefix: "BEFOREGRID", repositoryDirectory: "98_BeforeGrid" }));
	writeFileSync(join(root, "development/skills/beforegrid/SKILL.md"), "BeforeGrid beforegrid BEFOREGRID_OPTION 98_BeforeGrid\n");
	writeFileSync(join(root, "plugin/scripts/beforegrid"), "npx beforegrid@0.2.0\n");
	writeFileSync(join(root, ".github/workflows/check.yml"), "env: BEFOREGRID_REQUIRE_PARSERS\n");
	writeFileSync(join(root, "development/harness/evidence/run.json"), '{"tool":"beforegrid"}\n');
	writeFileSync(join(root, ".beforegrid/cache/run.json"), '{"tool":"beforegrid"}\n');

	mkdirSync(join(root, ".agents/skills"), { recursive: true });
	symlinkSync("../../development/skills/beforegrid", join(root, ".agents/skills/beforegrid"));
	mkdirSync(join(parent, "consumer/plugins/code-style"), { recursive: true });
	symlinkSync("../../../98_BeforeGrid/development/skills/beforegrid", join(parent, "consumer/plugins/code-style/source"));

	return root;
}

test("a naming preview changes nothing; applying it updates discovery, runtime references and directory identity together", () => {
	const root = workspace          ()     ;
	const plan = planProductIdentity(root) ;
	expect(readFileSync(join(root, "plugin/scripts/beforegrid"), "utf8")).toBe("npx beforegrid@0.2.0\n");
	const renamed = applyProductIdentity(plan);
	expect(existsSync(root)                                                            ).toBe(false                                                ) ;
	expect(readFileSync(join(renamed, "development/skills/aftergrid/SKILL.md"), "utf8")).toBe("AfterGrid aftergrid AFTERGRID_OPTION 98_AfterGrid\n") ;
	expect(readFileSync(join(renamed, "plugin/scripts/aftergrid"), "utf8")             ).toBe("npx aftergrid@0.2.0\n"                              ) ;
	expect(readFileSync(join(renamed, ".github/workflows/check.yml"), "utf8")          ).toBe("env: AFTERGRID_REQUIRE_PARSERS\n"                   ) ;
	expect(readFileSync(join(renamed, "development/harness/evidence/run.json"), "utf8")).toBe('{"tool":"beforegrid"}\n'                            ) ;
	expect(readFileSync(join(renamed, ".aftergrid/cache/run.json"), "utf8")            ).toBe('{"tool":"beforegrid"}\n'                            ) ;
	expect(existsSync(join(renamed, ".agents/skills/aftergrid/SKILL.md"))              ).toBe(true                                                 ) ;
	expect(existsSync(join(renamed, "../consumer/plugins/code-style/source/SKILL.md")) ).toBe(true                                                 ) ;
	const repeated = planProductIdentity(renamed);
	expect(repeated.changes).toEqual([]);
	expect(repeated.moves).toEqual([]);
});

test("an occupied rename destination is rejected before any content changes", () => {
	const root = workspace();
	mkdirSync(join(root, "development/skills/aftergrid"));
	expect(() => planProductIdentity(root)).toThrow("Rename destination already exists");
	expect(readFileSync(join(root, "plugin/scripts/beforegrid"), "utf8")).toBe("npx beforegrid@0.2.0\n");
});

test("invalid names and inconsistent generated identity are rejected before planning", () => {
	const root = workspace();
	writeFileSync(join(root, "product.json"), JSON.stringify({ displayName: "../unsafe" }));
	expect(() => planProductIdentity(root)).toThrow("displayName must");
	writeFileSync(join(root, "product.json"), JSON.stringify({ displayName: "AfterGrid" }));
	writeFileSync(join(root, "development/tools/product-identity.generated.json"), JSON.stringify({ displayName: "BeforeGrid", id: "other", envPrefix: "BEFOREGRID", repositoryDirectory: "98_BeforeGrid" }));
	expect(() => planProductIdentity(root)).toThrow("Invalid generated identity snapshot");
});
