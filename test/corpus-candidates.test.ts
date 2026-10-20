import      { afterEach, describe, expect, test         } from "bun:test"                                  ;
import      { createHash                                } from "node:crypto"                               ;
import      { spawnSync                                 } from "node:child_process"                        ;
import      {
              mkdtempSync                             ,
              mkdirSync                               ,
              readFileSync                            ,
              rmSync                                  ,
              writeFileSync                           ,
                                                        } from "node:fs"                                   ;
import      { join                                      } from "node:path"                                 ;
import      { tmpdir                                    } from "node:os"                                   ;
import      { generateCandidates, selectRepresentatives } from "../development/tools/corpus-candidates.ts" ;

const workspaces: string[] = []                                                                          ;
const sha                  = (value: string): string => createHash("sha256").update(value).digest("hex") ;
const tagged               = (value: string): string => `sha256:${sha(value)}`                           ;

afterEach(() => { for (const workspace of workspaces.splice(0)) rmSync(workspace, { recursive: true, force: true }); });

function fixture(): { root: string; input: string; output: string; commit: string; source: string; sourceTs: string; aligned: string } {
	const root     = mkdtempSync(join(tmpdir(), "boxbox-candidates-test-"))                      ;
	const input    = join(root, "input")                                                         ;
	const repo     = join(input, "sample")                                                       ;
	const output   = join(root, "output")                                                        ;
	const source   = "alpha = call(1, 22)\nbeta = call(2, 33)\ngamma = call(3, 44)\n"            ;
	const sourceTs = "const alpha = call(1);\nconst longer = call(2);\nconst gamma = call(3);\n" ;
	const aligned  = "alpha = call(1)\nbetaa = call(2)\ngamma = call(3)\n"                       ;
	workspaces.push(root);
	mkdirSync(repo, { recursive: true });
	writeFileSync(join(repo, "sample.py"), source);
	writeFileSync(join(repo, "sample.ts"), sourceTs);
	writeFileSync(join(repo, "aligned.py"), aligned);
	for (const args of [["init"], ["add", "sample.py", "sample.ts", "aligned.py"], ["-c", "user.name=Test", "-c", "user.email=test@example.invalid", "commit", "-m", "fixture"]]) {
		const result = spawnSync("git", args, { cwd: repo, encoding: "utf8" });
		if (result.status !== 0) throw new Error(result.stderr);
	}
	const commit = spawnSync("git", ["rev-parse", "HEAD"], { cwd: repo, encoding: "utf8" }).stdout.trim();
	return { root, input, output, commit, source, sourceTs, aligned };
}

function writeObservations(input: string, rows: readonly unknown[]): void {
	const raw = rows.map(value => JSON.stringify(value)).join("\n") + "\n";
	writeFileSync(join(input, "observations.jsonl"), raw);
	writeFileSync(join(input, "signatures.json"), JSON.stringify({ schemaVersion: 2, observations: { schemaVersion: 1, path: "observations.jsonl", sha256: tagged(raw), rows: rows.length } }));
}

describe("corpus candidate builder", () => {
	test("representatives secure source diversity first and keep status priority within each pick", () => {
		const row      = (id: string, source: string, state: string) => ({ schemaVersion: 1 as const, id, lookupKey: "v1|python|-|table|name>equal>value", signature: "sig", state, rows: 3, edits: 0, source: { id: source, repository: "local", commit: "a".repeat(40), license: "MIT" }, file: `${id}.py`, startLine: 1, endLine: 3, sourceHash: `sha256:${"0".repeat(64)}` }) ;
		const selected = selectRepresentatives([row("a-pass", "a", "PASS"), row("a-fix", "a", "FIXABLE"), row("b-refuse", "b", "REFUSE"), row("b-pass", "b", "PASS"), row("c-refuse", "c", "REFUSE")], 3)                                                                                                                                                                         ;
		expect(selected.map(value => value.id)).toEqual(["a-fix", "b-pass", "c-refuse"]);
	});

	test("safely copies the real pinned checkout, verifies before and after, and reruns identically", () => {
		const item = fixture()                            ;
		const key  = "v1|python|-|table|name>equal>value" ;
		const observations = [
			{ schemaVersion: 1, id: "ev-1", lookupKey: key, signature: "sig", state: "FIXABLE", rows: 3, edits: 3, source: { id: "sample", repository: "local", commit: item.commit, license: "MIT" }, file: "sample.py", startLine: 1, endLine: 3, sourceHash: tagged(item.source) },
			{ schemaVersion: 1, id: "ev-2", lookupKey: key, signature: "sig", state: "PASS", rows: 3, edits: 0, source: { id: "sample", repository: "local", commit: item.commit, license: "MIT" }, file: "sample.py", startLine: 1, endLine: 3, sourceHash: tagged(item.source) },
		];
		writeObservations(item.input, observations);
		const first = generateCandidates({ inputDir: item.input, outputDir: item.output, reps: 1 });
		expect(first).toEqual({ candidates: 1, examples: 1, verified: 1 });
		const before  = readFileSync(join(item.output, "examples.jsonl"), "utf8") ;
		const example = JSON.parse(before.trim())                                 ;
		expect(example.status                                               )    .toBe("verified"            ) ;
		expect(example.before                                               )    .toBe(item.source.trimEnd() ) ;
		expect(example.after                                                ).not.toBe(example.before        ) ;
		expect(example.parseStatus                                          )    .toBe("ok"                  ) ;
		expect(readFileSync(join(item.input, "sample", "sample.py"), "utf8"))    .toBe(item.source           ) ;
		generateCandidates({ inputDir: item.input, outputDir: item.output, reps: 1 });
		expect(readFileSync(join(item.output, "examples.jsonl"), "utf8")).toBe(before);
	});

	test("a failed representative extraction is kept without a fake after and every key keeps its candidate", () => {
		const item = fixture()                                                                                                                                                                                                                                                                                                                                                                      ;
		const rows = ["python", "ruby"].map((language, index) => ({ schemaVersion: 1, id: `ev-${index}`, lookupKey: `v1|${language}|-|table|name>equal>value`, signature: `sig-${index}`, state: "FIXABLE", rows: 3, edits: 3, source: { id: "sample", repository: "local", commit: item.commit, license: "MIT" }, file: "sample.py", startLine: 1, endLine: 3, sourceHash: tagged(item.source) })) ;
		writeObservations(item.input, rows);
		const result = generateCandidates({ inputDir: item.input, outputDir: item.output, limit: 2, reps: 1 });
		expect(result.candidates).toBe(2);
		const examples = readFileSync(join(item.output, "examples.jsonl"), "utf8").trim().split("\n").map(value => JSON.parse(value));
		expect(examples                                                                                                                       ).toHaveLength(2   ) ;
		expect(examples.some(value => value.status === "failed" && value.after === undefined && value.reason === "unsupported language: ruby")).toBe        (true) ;
		expect(readFileSync(join(item.output, "candidates.jsonl"), "utf8").trim().split("\n")                                                 ).toHaveLength(2   ) ;
	});

	test("TypeScript representatives also verify the native aligner's parser status and fixed point", () => {
		const item = fixture()                                                                                                                                                                                                                                                                                                                                  ;
		const row  = { schemaVersion: 1, id: "ev-ts", lookupKey: "v1|typescript|SourceFile|declaration-equals|equals>semicolon", signature: "sig-ts", state: "FIXABLE", rows: 3, edits: 3, source: { id: "sample", repository: "local", commit: item.commit, license: "MIT" }, file: "sample.ts", startLine: 1, endLine: 3, sourceHash: tagged(item.sourceTs) } ;
		writeObservations(item.input, [row]);
		expect(generateCandidates({ inputDir: item.input, outputDir: item.output, reps: 1 }).verified).toBe(1);
		const example = JSON.parse(readFileSync(join(item.output, "examples.jsonl"), "utf8"));
		expect(example.status                                               )    .toBe("verified"     ) ;
		expect(example.after                                                ).not.toBe(example.before ) ;
		expect(example.parseStatus                                          )    .toBe("ok"           ) ;
		expect(readFileSync(join(item.input, "sample", "sample.ts"), "utf8"))    .toBe(item.sourceTs  ) ;
	});

	test("an unchanged representative states that the parser did not run, and a review document is written", () => {
		const item = fixture()                                                                                                                                                                                                                                                                                                                  ;
		const row  = { schemaVersion: 1, id: "ev-pass", lookupKey: "v1|python|-|table|name>equal>value", signature: "sig-pass", state: "PASS", rows: 3, edits: 0, source: { id: "sample", repository: "example/sample", commit: item.commit, license: "MIT" }, file: "aligned.py", startLine: 1, endLine: 3, sourceHash: tagged(item.aligned) } ;
		writeObservations(item.input, [row]);
		generateCandidates({ inputDir: item.input, outputDir: item.output, reps: 1 });
		const example = JSON.parse(readFileSync(join(item.output, "examples.jsonl"), "utf8")) ;
		const summary = JSON.parse(readFileSync(join(item.output, "summary.json"), "utf8")  ) ;
		expect(example.parseStatus                                 ).toBe     ("not-run"                                                               ) ;
		expect(summary.parseNotRunCount                            ).toBe     (1                                                                       ) ;
		expect(readFileSync(join(item.output, "REVIEW.md"), "utf8")).toContain(`https://github.com/example/sample/blob/${item.commit}/aligned.py#L1-L3`) ;
	});

	test("does not replace a valid existing cache when the observation linkage or source hash differs", () => {
		const item = fixture();
		mkdirSync(item.output, { recursive: true });
		writeFileSync(join(item.output, "sentinel"), "keep");
		const row = { schemaVersion: 1, id: "ev-bad", lookupKey: "v1|python|-|table|name>equal>value", signature: "sig", state: "PASS", rows: 3, edits: 0, source: { id: "sample", repository: "local", commit: item.commit, license: "MIT" }, file: "sample.py", startLine: 1, endLine: 3, sourceHash: `sha256:${"0".repeat(64)}` };
		writeObservations(item.input, [row]);
		expect(() => generateCandidates({ inputDir: item.input, outputDir: item.output })).toThrow("source hash mismatch");
		expect(readFileSync(join(item.output, "sentinel"), "utf8")).toBe("keep");
	});
});
