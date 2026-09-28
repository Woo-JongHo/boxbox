/**
 * Mutation tests: thousands of seeded variants of every line-engine fixture must keep the safety invariants —
 * whitespace-only output (T2), no refused table, idempotence, and an unchanged parse (T3, sampled because
 * parsers are slow).
 * XXX_MUTATIONS scales the variant count per language (default 1000); a failure prints its seed and a minimized input.
 */
import      {
              mkdtempSync                 ,
              readFileSync                ,
              rmSync                      ,
              writeFileSync               ,
                                            } from "node:fs"                                                ;
import      { join, relative                } from "node:path"                                              ;
import      { preservesTokens               } from "../skills/xxx/scripts/typescript/token-preservation.ts" ;
import      { describe, expect, test        } from "bun:test"                                               ;
import      { compareParse, parserAvailable } from "../skills/xxx/scripts/common/parse-check.ts"            ;
import      { changedLines                  } from "../skills/xxx/scripts/common/preservation.ts"           ;
import      { alignSource                   } from "../skills/xxx/scripts/common/table-engine.ts"           ;
import type { LineProfiler                  } from "../skills/xxx/scripts/common/table-engine.ts"           ;
import      { C_ALIGNER                     } from "../skills/xxx/scripts/c/profile.ts"                     ;
import      { CPP_ALIGNER                   } from "../skills/xxx/scripts/cpp/profile.ts"                   ;
import      { GO_ALIGNER                    } from "../skills/xxx/scripts/go/profile.ts"                    ;
import      { JAVA_ALIGNER                  } from "../skills/xxx/scripts/java/profile.ts"                  ;
import      { JAVASCRIPT_ALIGNER            } from "../skills/xxx/scripts/javascript/profile.ts"            ;
import      { PYTHON_ALIGNER                } from "../skills/xxx/scripts/python/profile.ts"                ;
import      { RUST_ALIGNER                  } from "../skills/xxx/scripts/rust/profile.ts"                  ;
import      { minimize, mutate              } from "./mutator.ts"                                           ;

const VARIANTS     = Number(process.env.XXX_MUTATIONS ?? 1000)                    ;
const PARSE_SAMPLE = Math.max(3, Math.floor(VARIANTS / 200))                      ;
const FIXTURES     = new URL("../skills/xxx/fixtures/", import.meta.url).pathname ;

interface Language {
	readonly aligner   : LineProfiler ;
	readonly extension : string       ;
	readonly comment   : string       ;
}

const LANGUAGES: readonly Language[] = [
	{ aligner : PYTHON_ALIGNER     , extension : "py"   , comment : "#"  },
	{ aligner : JAVA_ALIGNER       , extension : "java" , comment : "//" },
	{ aligner : GO_ALIGNER         , extension : "go"   , comment : "//" },
	{ aligner : RUST_ALIGNER       , extension : "rs"   , comment : "//" },
	{ aligner : JAVASCRIPT_ALIGNER , extension : "js"   , comment : "//" },
	{ aligner : C_ALIGNER          , extension : "c"    , comment : "//" },
	{ aligner : CPP_ALIGNER        , extension : "cpp"  , comment : "//" },
];

const align = (source: string, aligner: LineProfiler): string => alignSource(source, aligner, { minRows: 3, apply: true }).output;

/** Returns the first broken invariant for `variant`, or undefined when all hold. */
function violation(variant: string, aligner: LineProfiler): string | undefined {
	const result = alignSource(variant, aligner, { minRows: 3, apply: true });
	const once   = result.output;
	if (changedLines(variant, once, aligner.syntax).length > 0) return "changed more than whitespace between tokens";
	// A refusal is safe, but here it means a profiler and the preservation check disagree — a bug to find.
	if (result.refused.length > 0) return `refused ${result.refused.length} table(s)`;
	if (align(once, aligner) !== once) return "not idempotent";
	return undefined;
}

describe("mutation invariants", () => {
	for (const language of LANGUAGES) {
		const name    = language.aligner.language ;
		const sources = ["tables", "tricky"].map(file => readFileSync(`${FIXTURES}${name}/${file}.${language.extension}`, "utf8"));

		test(`${name}: ${VARIANTS} variants keep whitespace-only output and idempotence`, () => {
			for (let seed = 1; seed <= VARIANTS; seed += 1) {
				const source  = sources[seed % sources.length]!                                                      ;
				const variant = mutate(source, { syntax: language.aligner.syntax, comment: language.comment }, seed) ;
				const broken  = violation(variant, language.aligner)                                                 ;
				if (broken) {
					const smallest = minimize(variant, candidate => violation(candidate, language.aligner) !== undefined);
					throw new Error(`${name} seed=${seed}: ${broken}\n--- minimized input ---\n${smallest}`);
				}
			}
		}, 30_000 + VARIANTS * 5);

		test.skipIf(!parserAvailable(name))(`${name}: sampled variants parse like their aligned output`, () => {
			for (let sample = 0; sample < PARSE_SAMPLE; sample += 1) {
				const seed    = 1 + Math.floor((sample * VARIANTS) / PARSE_SAMPLE)                                   ;
				const source  = sources[seed % sources.length]!                                                      ;
				const variant = mutate(source, { syntax: language.aligner.syntax, comment: language.comment }, seed) ;
				const result  = compareParse(name, variant, align(variant, language.aligner))                        ;
				expect({ seed, delta: result.delta }).toEqual({ seed, delta: [] });
			}
		}, 120_000);
	}
});

describe("mutation invariants (TypeScript aligner)", () => {
	const TS_VARIANTS = Number(process.env.XXX_TS_MUTATIONS ?? 5)                 ;
	const root        = new URL("..", import.meta.url).pathname                   ;
	const script      = `${root}skills/xxx/scripts/typescript/06_align-tables.ts` ;
	const source      = readFileSync(`${FIXTURES}table-kinds.ts`, "utf8")         ;

	test(`${TS_VARIANTS} variants keep the token stream, refuse nothing, parse alike and are idempotent`, () => {
		const workspace = mkdtempSync(join(import.meta.dir, "mutation-ts-"));
		try {
			for (let seed = 1; seed <= TS_VARIANTS; seed += 1) {
				const variant = mutate(source, { syntax: JAVASCRIPT_ALIGNER.syntax, comment: "//" }, seed);
				const target  = join(workspace, `variant-${seed}.ts`);
				writeFileSync(target, variant);
				const file  = relative(root, target)                                                                                   ;
				const first = Bun.spawnSync(["bun", script, "--file", file, "--write"], { cwd: root, stderr: "pipe", stdout: "pipe" }) ;
				const again = Bun.spawnSync(["bun", script, "--file", file], { cwd: root, stderr: "pipe", stdout: "pipe" })            ;
				const out   = readFileSync(target, "utf8")                                                                             ;
				expect({ seed, exit: first.exitCode, refused: /refused=0/u.test(first.stdout.toString()), tokens: preservesTokens(variant, out), again: again.exitCode })
					.toEqual({ seed, exit: 0, refused: true, tokens: true, again: 0 });
			}
		} finally {
			rmSync(workspace, { recursive: true, force: true });
		}
	}, 30_000 + TS_VARIANTS * 2_000);
});
