/**
 * Mutation tests: thousands of seeded variants of every line-engine fixture must keep the safety invariants —
 * whitespace-only output (T2), no preservation-refused table, idempotence, and an unchanged parse (T3, sampled because
 * parsers are slow).
 * BOXBOX_MUTATIONS scales the variant count per language (default 1000); a failure prints its seed and a minimized input.
 */
import      { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs"                               ;
import      { join, relative                                   } from "node:path"                             ;
import      { fileURLToPath                                    } from "node:url"                              ;
import      { preservesTokens                                  } from "@/typescript/16_token-preservation.ts" ;
import      { describe, expect, test                           } from "bun:test"                              ;
import      { compareParse, syntaxDiagnostics                  } from "@/common/08_parse-check.ts"            ;
import      { changedLines                                     } from "@/common/09_preservation.ts"           ;
import      { alignSource                                      } from "@/common/06_table-engine.ts"           ;
import type { CodeSyntax, LineProfiler                         } from "@/common/06_table-engine.ts"           ;
import      { PYTHON_ALIGNER                                   } from "@/python/03_profile.ts"                ;
import      { PythonSourceSyntaxError                          } from "@/python/07_string-ranges.ts"          ;
import      { minimize, mutate                                 } from "./mutator.ts"                          ;

const VARIANTS     = Number       (process.env.BOXBOX_MUTATIONS ?? 1000         ) ;
const PARSE_SAMPLE = Math.max     (3, Math.floor(VARIANTS / 200)                ) ;
const FIXTURES     = fileURLToPath(new URL("../test/fixtures/", import.meta.url)) ;

interface Language {
	readonly aligner   : LineProfiler ;
	readonly extension : string       ;
	readonly comment   : string       ;
}

const LANGUAGES: readonly Language[] = [
	{ aligner : PYTHON_ALIGNER     , extension : "py"    , comment : "#"  },
];

/** Masking syntax for the TypeScript variants: comments plus the three string quotes, so mutations never land inside them. */
const TYPESCRIPT_MASK: CodeSyntax = {
	lineComments  : ["//"]                        ,
	blockComments : [{ open: "/*", close: "*/" }] ,
	strings       : [
		{ open : '"' , close : '"' , escape : true },
		{ open : "'" , close : "'" , escape : true },
		{ open : "`" , close : "`" , escape : true },
	],
};

const align = (source: string, aligner: LineProfiler): string => alignSource(source, aligner, { minRows: 3, apply: true }).output;

/** Only a typed rejection of independently invalid Python is an expected refusal. */
function invalidRejection(source: string, error: unknown): boolean {
	if (!(error instanceof PythonSourceSyntaxError)) throw error;
	return syntaxDiagnostics("python", source).diagnostics.length > 0;
}

/** A refusal is distinct from a successful alignment and a broken invariant. */
function violation(variant: string, aligner: LineProfiler): { readonly status: "valid-aligned" | "invalid-aligned" | "invalid-rejected" | "broken"; readonly reason?: string } {
	const valid = syntaxDiagnostics("python", variant).diagnostics.length === 0;
	let result: ReturnType<typeof alignSource>;
	try { result = alignSource(variant, aligner, { minRows: 3, apply: true }); }
	catch (error) {
		if (!(error instanceof PythonSourceSyntaxError)) throw error;
		return !valid
			? { status: "invalid-rejected" }
			: { status: "broken", reason: "string tokenizer rejected valid Python" };
	}
	const once   = result.output                                              ;
	if (changedLines(variant, once, aligner.syntax).length > 0) return { status: "broken", reason: "changed more than whitespace between tokens" };
	// A preservation refusal is safe, but here it means a profiler and the preservation check disagree — a bug to find.
	// A wide-character refusal is policy: injected Hangul, Han or Kana makes the column width viewer-dependent.
	const unsafe = result.refused.filter(table => table.refusal !== "wide-characters");
	if (unsafe.length > 0) return { status: "broken", reason: `refused ${unsafe.length} table(s)` };
	if (align(once, aligner) !== once) return { status: "broken", reason: "not idempotent" };
	return { status: valid ? "valid-aligned" : "invalid-aligned" };
}

describe("mutation invariants", () => {
	for (const language of LANGUAGES) {
		const name    = language.aligner.language                                                                                  ;
		const sources = ["tables", "tricky"].map(file => readFileSync(`${FIXTURES}${name}/${file}.${language.extension}`, "utf8")) ;

		test(`${name}: ${VARIANTS} variants keep whitespace-only output and idempotence`, () => {
			expect(invalidRejection("if:\n", new PythonSourceSyntaxError())           ).toBe   (true              ) ;
			expect(invalidRejection("x = 1\n", new PythonSourceSyntaxError())         ).toBe   (false             ) ;
			expect(() => invalidRejection("x = 1\n", new Error("parser failure"))     ).toThrow("parser failure"  ) ;
			expect(violation("a=1\nlonger=2\nthird=3\nif:\n", language.aligner).status).toBe   ("invalid-rejected") ;
			expect(violation("a=1\nlonger=2\nthird=3\n", language.aligner).status     ).toBe   ("valid-aligned"   ) ;
			expect(violation("text=f\"{1}\"\nif:\n", language.aligner).status         ).toBe   ("invalid-rejected") ;

			const outcomes = { validAligned: 0, invalidAligned: 0, invalidRejected: 0 };
			for (let seed = 1; seed <= VARIANTS; seed += 1) {
				const source  = sources[seed % sources.length]!                                                      ;
				const variant = mutate(source, { syntax: language.aligner.syntax, comment: language.comment }, seed) ;
				const broken  = violation(variant, language.aligner)                                                 ;
				if (broken.status === "broken") {
					const smallest = minimize(variant, candidate => violation(candidate, language.aligner).status === "broken");
					throw new Error(`${name} seed=${seed}: ${broken.reason}\n--- minimized input ---\n${smallest}`);
				}
				if (broken.status === "invalid-rejected") outcomes.invalidRejected += 1;
				else if (broken.status === "valid-aligned") outcomes.validAligned += 1;
				else outcomes.invalidAligned += 1;
			}
			const total = outcomes.validAligned + outcomes.invalidAligned + outcomes.invalidRejected;
			expect(total                  ).toBe           (VARIANTS) ;
			expect(outcomes.validAligned  ).toBeGreaterThan(0       ) ;
			expect(outcomes.invalidAligned).toBe           (0       ) ;
			console.log(`${name} mutation outcomes: valid-aligned=${outcomes.validAligned} invalid-aligned=${outcomes.invalidAligned} invalid-rejected=${outcomes.invalidRejected} total=${total}`);
		}, 30_000 + VARIANTS * 150);

		test(`${name}: sampled variants parse like their aligned output`, () => {
			for (let sample = 0; sample < PARSE_SAMPLE; sample += 1) {
				const seed    = 1 + Math.floor((sample * VARIANTS) / PARSE_SAMPLE)                                   ;
				const source  = sources[seed % sources.length]!                                                      ;
				const variant = mutate(source, { syntax: language.aligner.syntax, comment: language.comment }, seed) ;
				let output: string                                                                                   ;
				try { output = align(variant, language.aligner); }
				catch (error) {
					if (!invalidRejection(variant, error)) throw new Error(`${name} seed=${seed}: string tokenizer rejected valid Python`);
					continue;
				}
				const result  = compareParse(name, variant, output)                                                   ;
				expect({ seed, delta: result.delta }).toEqual({ seed, delta: [] });
			}
		}, 120_000);
	}
});

describe("mutation invariants (TypeScript aligner)", () => {
	const TS_VARIANTS = Number(process.env.BOXBOX_TS_MUTATIONS ?? 5)          ;
	const root        = fileURLToPath(new URL("..", import.meta.url))         ;
	const script      = `${root}product/engine/typescript/07_align-tables.ts` ;
	const source      = readFileSync(`${FIXTURES}table-kinds.ts`, "utf8")     ;

	test(`${TS_VARIANTS} variants keep the token stream, refuse nothing, parse alike and are idempotent`, () => {
		const workspace = mkdtempSync(join(import.meta.dir, "mutation-ts-"));
		try {
			for (let seed = 1; seed <= TS_VARIANTS; seed += 1) {
				const variant = mutate(source, { syntax: TYPESCRIPT_MASK, comment: "//" }, seed) ;
				const target  = join  (workspace, `variant-${seed}.ts`                         ) ;
				writeFileSync(target, variant);
				const file  = relative     (root, target                                                                             ) ;
				const first = Bun.spawnSync(["bun", script, "--file", file, "--write"], { cwd: root, stderr: "pipe", stdout: "pipe" }) ;
				const again = Bun.spawnSync(["bun", script, "--file", file], { cwd: root, stderr: "pipe", stdout: "pipe" }           ) ;
				const out   = readFileSync (target, "utf8"                                                                           ) ;
				expect({ seed, exit: first.exitCode, refused: /refused=0/u.test(first.stdout.toString()), tokens: preservesTokens(variant, out), again: again.exitCode })
					.toEqual({ seed, exit: 0, refused: true, tokens: true, again: 0 });
			}
		} finally {
			rmSync(workspace, { recursive: true, force: true });
		}
	}, 30_000 + TS_VARIANTS * 2_000);
});
