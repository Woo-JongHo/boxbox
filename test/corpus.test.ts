import      { describe, expect, test   } from "bun:test"                   ;
import      { existsSync, readFileSync } from "node:fs"                    ;
import      { resolve                  } from "node:path"                  ;
import      { mergeSources             } from "../scripts/corpus-fetch.ts" ;

const ROOT = resolve(import.meta.dir, "..");

interface CorpusSource {
	readonly id         : unknown ;
	readonly language   : unknown ;
	readonly repository : unknown ;
	readonly commit     : unknown ;
	readonly license    : unknown ;
	readonly paths      : unknown ;
}

const readSources = (name: string): readonly CorpusSource[] => {
	const path = resolve(ROOT, "corpus", name)                        ;
	if (!existsSync(path)) return []                                  ;
	const manifest = JSON.parse(readFileSync(path, "utf8")) as { readonly schemaVersion: unknown; readonly sources: readonly CorpusSource[] };
	expect(manifest.schemaVersion).toBe(1)                            ;
	return manifest.sources                                           ;
};

describe("pinned corpus", () => {
	test("every manifest source is pinned by repository, 40-hex commit and a permissive license", () => {
		const sources = readSources("manifest.json");
		expect(sources.length         ).toBeGreaterThanOrEqual(8) ;
		const ids = new Set<string>();
		for (const source of sources) {
			expect(ids.has(String(source.id)         )  ).toBe     (false                                ) ;
			expect(String(source.repository          )  ).toMatch  (/^[A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+$/u) ;
			expect(String(source.commit              )  ).toMatch  (/^[0-9a-f]{40}$/u                    ) ;
			expect(String(source.license             )  ).toMatch  (/^(MIT|Apache-2\.0|BSD-3-Clause)$/u  ) ;
			expect(["typescript", "python"]             ).toContain(String(source.language             ) ) ;
			expect(Array.isArray(source.paths          )).toBe     (true                                 ) ;
			ids.add(String(source.id));
		}
	});

	test("the four TypeScript and four Python candidates from the plan are pinned", () => {
		const sources = readSources("manifest.json")             ;
		const ids     = sources.map(source => String(source.id)) ;
		expect(ids.sort()).toEqual(["django", "fastapi", "prisma", "pydantic", "requests", "trpc", "vscode", "zod"]);
	});

	test("local-only sources are gitignored and, when present, validate like manifest sources", () => {
		const gitignore = readFileSync(resolve(ROOT, ".gitignore"), "utf8") ;
		expect(gitignore).toContain("corpus/local.json")                    ;
		for (const source of readSources("local.json")) {
			expect(String(source.repository)).toMatch(/^[A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+$/u) ;
			expect(String(source.commit)    ).toMatch(/^[0-9a-f]{40}$/u)                     ;
		}
	});

	test("the fetcher merges manifest and local sources and refuses a duplicate id", () => {
		const source   = (id: string, repository: string, commit: string) => ({ id, language: "typescript", repository, commit, license: "MIT", paths: [] as readonly string[] }) ;
		const manifest = { schemaVersion: 1, sources: [source("zod", "colinhacks/zod", "a".repeat(40))] }                                                                         ;
		const local    = { schemaVersion: 1, sources: [source("my-project", "mycompany/my-project", "b".repeat(40))] }                                                            ;
		expect(mergeSources(manifest, local).length).toBe(2);
		expect(() => mergeSources(manifest, { schemaVersion: 1, sources: [source("zod", "evil/zod", "c".repeat(40))] })).toThrow("duplicate corpus id: zod");
	});
});
