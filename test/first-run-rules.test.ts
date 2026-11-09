import { afterEach, describe, expect, test                  } from "bun:test"             ;
import { spawnSync                                          } from "node:child_process"   ;
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs"     ;
import { tmpdir                                             } from "node:os"              ;
import { join, resolve                                      } from "node:path"            ;

const ENTRY           = resolve(import.meta.dir, "../product/packages/cli/entry.ts") ;
const roots: string[] = []                                                           ;

function align(source: string, name = "sample.ts"): { readonly status: number | null; readonly stdout: string; readonly stderr: string; readonly text: string } {
	const root = mkdtempSync(join(tmpdir(), "boxbox-first-run-"));
	roots.push(root);
	mkdirSync(join(root, ".git"));
	writeFileSync(join(root, name), source);
	const run = spawnSync(process.execPath, [ENTRY, "align", "--file", name, "--json"], { cwd: root, encoding: "utf8", env: { ...process.env, XDG_CONFIG_HOME: join(root, "xdg") } });
	return { status: run.status, stdout: run.stdout, stderr: run.stderr, text: readFileSync(join(root, name), "utf8") };
}

afterEach(() => {
	for (const root of roots.splice(0)) rmSync(root, { recursive: true, force: true });
});

describe("approved first-run declaration shapes", () => {
	const approved: readonly (readonly [string, string, string, string])[] = [
		["values"             , 'const name = "deploy";\nconst retries = 3;\nconst timeoutMs = 1000;\n'           , 'const name      = "deploy" ;\nconst retries   = 3        ;\nconst timeoutMs = 1000     ;\n'  , "ts-sourcefile-value-declarations"],
		["every value form"   , 'const a = "x";\nconst bb = 1;\nconst c = true;\nconst d = null;\nconst e = -1;\n' , 'const a  = "x"  ;\nconst bb = 1    ;\nconst c  = true ;\nconst d  = null ;\nconst e  = -1   ;\n' , "ts-sourcefile-value-declarations"],
		["comment-like strings", 'const a = "//x";\nconst bbb = "/*y*/";\n'                                     , 'const a   = "//x"   ;\nconst bbb = "/*y*/" ;\n'                                                 , "ts-sourcefile-value-declarations"],
		["a comment among arguments", "const a = f(1, /* x */ 2);\nconst bb = g(22);\n"                               , "const a  = f(1, /* x */ 2) ;\nconst bb = g(22          ) ;\n"                                , "ts-sourcefile-call-envelope-declarations"],
		["a regex argument"   , "const aa = g(22);\nconst b = f(/[/*]/);\n"                                    , "const aa = g(22    ) ;\nconst b  = f(/[/*]/) ;\n"                                             , "ts-sourcefile-call-envelope-declarations"],
		["a template argument", "const aa = g(22);\nconst b = f(`x${1}`);\n"                                   , "const aa = g(22     ) ;\nconst b  = f(`x${1}`) ;\n"                                            , "ts-sourcefile-call-envelope-declarations"],
		["exported values"    , "export const a = 1;\nexport const bbb = 2;\n"                                   , "export const a   = 1 ;\nexport const bbb = 2 ;\n"                                                , "ts-sourcefile-value-declarations"],
		["different callees"  , "const a = first(1);\nconst bb = second(22);\n"                                  , "const a  = first (1 ) ;\nconst bb = second(22) ;\n"                                             , "ts-sourcefile-call-envelope-declarations"],
		["different arity"    , "const a = f(1);\nconst bb = f(1, 2);\n"                                         , "const a  = f(1   ) ;\nconst bb = f(1, 2) ;\n"                                                   , "ts-sourcefile-call-envelope-declarations"],
		["non-null calls"     , "const a = f(1)!;\nconst bb = g(22)!;\n"                                         , "const a  = f(1 )! ;\nconst bb = g(22)! ;\n"                                                     , "ts-sourcefile-call-envelope-declarations"],
		["empty calls"        , "const app = createApp();\nconst router = createRouter();\n"                     , "const app    = createApp   () ;\nconst router = createRouter() ;\n"                               , "ts-sourcefile-empty-call-declarations"],
	];
	for (const [name, before, after, rule] of approved) {
		test(`${name} are written under ${rule}`, () => {
			const result = align(before);

			expect(result.status                      ).toBe     (0      ) ;
			expect(result.text                        ).toBe     (after  ) ;
			expect(JSON.parse(result.stdout).approvals).toEqual  ([rule] ) ;
		}, 60_000);
	}
});

describe("shapes outside the approval stay byte-identical", () => {
	const refused: readonly (readonly [string, string])[] = [
		["arrow functions"          , "const a = () => 1;\nconst bbb = 2;\n"                  ],
		["regular expressions"      , "const a = /x/g;\nconst bbb = 2;\n"                     ],
		["compound expressions"     , "const a = x && y;\nconst bbb = 2;\n"                   ],
		["a call mixed with values" , 'const a = 1;\nconst b = make();\nconst cc = "x";\n'    ],
		["arrays"                   , "const a = [1];\nconst bbb = 2;\n"                      ],
		["objects"                  , "const a = {};\nconst bbb = 2;\n"                       ],
		["template substitutions"   , 'const a = `x${y}`;\nconst bbb = "z";\n'                ],
		["negation"                 , "const a = !1;\nconst bbb = 2;\n"                       ],
		["signed identifiers"       , "const a = -x;\nconst bbb = 2;\n"                       ],
		["as const"                 , "const a = 1 as const;\nconst bbb = 2;\n"               ],
		["type annotations"         , 'const a: string = "x";\nconst bbb: number = 2;\n'      ],
		["values in a function"     , "function f() {\n  const a = 1;\n  const bbb = 2;\n}\n" ],
		["member calls"             , "const a = obj.f(1);\nconst bb = obj.g(2);\n"           ],
		["empty member calls"       , "const a = obj.f();\nconst bb = obj.g();\n"             ],
		["one member call"          , "const a = f(1);\nconst bb = obj.g(2);\n"               ],
		["one empty member call"    , "const a = f();\nconst bb = obj.g();\n"                 ],
		["new expressions"          , "const a = new A();\nconst bb = new B(1);\n"            ],
		["awaited calls"            , "const a = await f();\nconst bb = await g();\n"         ],
		["template literals"        , 'const a = `x`;\nconst bbb = "y";\n'                ],
		["bigint literals"          , "const a = 1n;\nconst bbb = 2n;\n"                   ],
		["signed bigint literals"   , "const a = -1n;\nconst bbb = 2;\n"                   ],
		["one typed value"          , "const a: number = 1;\nconst bbb = 2;\n"             ],
		["one typed empty call"     , "const a: X = f();\nconst bb = g();\n"               ],
		["one typed call"           , "const a: X = f(1);\nconst bb = g(22);\n"            ],
		["one commented value"      , "const a = 1;\nconst bbb = 2; // note\n"             ],
		["one commented call"       , "const a = f(1);\nconst bb = g(22); // note\n"       ],
		["one commented empty call" , "const a = f();\nconst bb = g(); // note\n"          ],
		["a tight value comment"    , "const a = 1;\nconst bbb = 2;// note\n"              ],
		["a tight call comment"     , "const c = f(1);\nconst dd = g(22);// note\n"        ],
		["a tight empty comment"    , "const e = h();\nconst ff = j();// note\n"           ],
		["an inner value comment"   , "const a = /* note */ 1;\nconst bbb = 2;\n"          ],
		["a leading value comment"  , "/* note */ const a = 1;\nconst bbb = 2;\n"          ],
		["an inner call comment"    , "const a = /* note */ f(1);\nconst bb = g(22);\n"    ],
		["a leading call comment"   , "/* note */ const a = f();\nconst bb = g();\n"       ],
		["a comment after a regex"  , "const aa = g(22);\nconst b = f(/[/*]/);// note\n"    ],
		["a comment after a template", "const aa = g(22);\nconst b = f(`x${1}`);// note\n"  ],
		["a single value"           , "const only = 1;\n"                                     ],
		["a single call"            , "const only = make();\n"                                ],
	];
	for (const [name, source] of refused) {
		test(name, () => {
			const result = align(source);

			expect(result.status                ).toBe    (2                                              ) ;
			expect(result.text                  ).toBe    (source                                         ) ;
			expect(result.stdout + result.stderr).toMatch (/approval denied|no verified approval rule/u   ) ;
		}, 60_000);
	}
});

test("check reports approved fixable groups separately without changing its exit code", () => {
	const root = mkdtempSync(join(tmpdir(), "boxbox-first-run-"));
	roots.push(root);
	mkdirSync(join(root, ".git"));
	writeFileSync(join(root, "sample.ts"), "const a = 1;\nconst bbb = 2;\n\nconst f = () => 1;\nconst ggg = 2;\n");
	const run = spawnSync(process.execPath, [ENTRY, "check", "--file", "sample.ts", "--json"], { cwd: root, encoding: "utf8", env: { ...process.env, XDG_CONFIG_HOME: join(root, "xdg") } });

	expect(run.status                                ).toBe         (1                                                                  ) ;
	expect(JSON.parse(run.stdout).formatReadiness    ).toMatchObject({ approvalEligible: false, fixableGroups: 2, approvedFixableGroups: 1 }) ;
}, 60_000);
