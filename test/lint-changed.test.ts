import { afterAll, beforeAll, expect, test } from "bun:test";
import { mkdirSync, mkdtempSync, readFileSync, readdirSync, rmSync, symlinkSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { parse } from "yaml";

import { checkerEnvironment, invoke, judge, lintConfig, prepareChecker, sha256 } from "../development/harness/lint-changed-checker.ts";
import { comparison, runChanged, safeFile, sourceBytes } from "../development/harness/lint-changed.ts";
import { git, selectChanges } from "../development/harness/lint-changed-git.ts";

const repository = resolve(import.meta.dir, "..")                                     ;
const scratch    = mkdtempSync(join(tmpdir(), "boxbox-changed-test-"))                ;
const configText = readFileSync(join(repository, ".github/boxbox-lint.json"), "utf8") ;
const config     = lintConfig(configText)                                             ;
let checker: ReturnType<typeof prepareChecker>                                        ;
let counter      = 0                                                                  ;

beforeAll(() => {
	const build = join(scratch, "build");
	mkdirSync(build);
	checker = prepareChecker(repository, build, config);
}, 180_000);

afterAll(() => rmSync(scratch, { recursive: true, force: true }));

function inspect(source: string, extension: string, language: string) {
	const root = join(scratch, `case-${counter++}`) ;
	const file = `input.${extension}`               ;
	mkdirSync(root);
	writeFileSync(join(root, file), source);
	const result   = invoke("node", [checker.entry, "check", "--file", file, "--json"], root, checkerEnvironment(scratch)) ;
	const judgment = judge (result, file, language                                                                       ) ;

	expect(readFileSync(join(root, file), "utf8")).toBe(source);
	return { result, judgment, file, language };
}

test("the pinned checker detects actual violations and accepts aligned full files without changing bytes", () => {
	const before = inspect("a = 1\nlonger = 2\nmid = 3\n"        , "py", "python") ;
	const after  = inspect("a      = 1\nlonger = 2\nmid    = 3\n", "py", "python") ;

	expect(checker.identity.commit ).toBe("9a0406e27fb43241d71f9e5a8815da7e4301e1b1") ;
	expect(checker.identity.version).toBe("0.2.5"                                   ) ;
	expect(before.result.status    ).toBe(1                                         ) ;
	expect(before.judgment.status  ).toBe("violation"                               ) ;
	expect(after.result.status     ).toBe(0                                         ) ;
	expect(after.judgment.status   ).toBe("pass"                                    ) ;
	expect(after.judgment.noGroups ).toBe(false                                     ) ;
});

test("unsupported ranges warn separately from no recognized groups and syntax failures", () => {
	const unsupported = inspect("items: [1, 2, 3]\n", "yaml", "yaml"      ) ;
	const empty       = inspect("print('hello')\n"  , "py"  , "python"    ) ;
	const broken      = inspect("const = ;\n"       , "ts"  , "typescript") ;

	expect(unsupported.judgment.status            ).toBe           ("pass" ) ;
	expect(unsupported.judgment.unsupported.length).toBeGreaterThan(0      ) ;
	expect(empty.judgment.status                  ).toBe           ("pass" ) ;
	expect(empty.judgment.noGroups                ).toBe           (true   ) ;
	expect(empty.judgment.unsupported             ).toEqual        ([]     ) ;
	expect(broken.result.status                   ).toBe           (2      ) ;
	expect(broken.judgment.status                 ).toBe           ("error") ;
});

test("the pinned JSON checker blocks scalar misalignment and accepts the preserved aligned values", () => {
	const before = '{\n  "a": 1,\n  "longer": 2,\n  "mid": 3\n}\n'         ;
	const after  = '{\n  "a"     : 1,\n  "longer": 2,\n  "mid"   : 3\n}\n' ;

	expect(JSON.parse(after)                              ).toEqual(JSON.parse(before)) ;
	expect(inspect(before, "json", "json").judgment.status).toBe   ("violation"       ) ;
	expect(inspect(after, "json", "json").judgment.status ).toBe   ("pass"            ) ;
});

test("process failures, malformed JSON, refusals and inconsistent success results all fail closed", () => {
	const { result, file, language } = inspect("print('hello')\n", "py", "python");
	for (const failed of [
		{ ...result, status: null, error: "timeout" },
		{ ...result, stdout: "not JSON" },
		{ ...result, stdout: "{}" },
		{ ...result, status: 127 },
	]) expect(judge(failed, file, language).status).toBe("error");
	const valid = JSON.parse(result.stdout);
	// Public check validates syntax separately; parse is the post-write reparse gate, which must not run here.
	expect(valid.syntax.status                 ).toBe("valid"  ) ;
	expect(valid.results[0].parse.status       ).toBe("not-run") ;
	expect(judge(result, file, language).status).toBe("pass"   ) ;
	const mutations = [
		(body: any) => { body.results[0].file = "wrong.py"; },
		(body: any) => { body.results[0].mode = "write"; },
		(body: any) => { body.results[0].summary.groups = 1; },
		(body: any) => { body.results[0].unsupported = [{ line: 0 }]; },
		(body: any) => { delete body.syntax; },
		(body: any) => { body.syntax.status = "skipped"; },
		(body: any) => { body.results[0].parse.status = "skipped"; },
		(body: any) => { body.results[0].parse.status = "changed"; },
	];
	for (const mutate of mutations) {
		const body = structuredClone(valid);
		mutate(body);
		expect(judge({ ...result, stdout: JSON.stringify(body) }, file, language).status).toBe("error");
	}
	valid.results[0].groups          = [{ kind: "unsafe", startLine: 1, endLine: 1, rows: 1, axes: [], edits: 0, state: "REFUSE" }] ;
	valid.results[0].summary.groups  = 1                                                                                            ;
	valid.results[0].summary.refused = 1                                                                                            ;
	expect(judge({ ...result, status: 2, stdout: JSON.stringify(valid) }, file, language).status).toBe("error");
});

test("personal/runtime injection settings cannot enter checker subprocesses", () => {
	const env = checkerEnvironment(scratch);

	expect(env.XDG_CONFIG_HOME).toBe(join(scratch, "config"));
	expect(env.NODE_OPTIONS).toBeUndefined();
	expect(env.BUN_OPTIONS).toBeUndefined();
	expect(env.NODE_PATH).toBeUndefined();
	expect(env.BOXBOX_REQUIRE_PARSERS).toBe("1");
});

test("preparation rejects unavailable commits and a version that disagrees with the pinned source", () => {
	const missing   = { ...config, checker: { ...config.checker, commit: "f".repeat(40) } } ;
	const mismatch  = { ...config, checker: { ...config.checker, version: "0.0.5" } }       ;
	const directory = join(scratch, "bad-version")                                          ;
	mkdirSync(directory);

	expect(() => prepareChecker(repository, directory, missing)).toThrow();
	expect(() => prepareChecker(repository, directory, mismatch)).toThrow("version mismatch");
	expect(() => lintConfig('{"schemaVersion":1}')).toThrow();
});

function project(): string {
	const root = join(scratch, `repo-${counter++}`);
	mkdirSync(join(root, ".github"), { recursive: true });
	writeFileSync(join(root, ".github/boxbox-lint.json"), configText);
	writeFileSync(join(root, ".gitignore"), ".boxbox/cache/\n");
	git(root, ["init", "-q"]);
	git(root, ["config", "user.email", "test@example.invalid"]);
	git(root, ["config", "user.name", "Test"]);
	git(root, ["add", "."]);
	git(root, ["commit", "-qm", "Initial"]);
	// Import only the baseline object graph. No test relies on an npm BoxBox publication.
	git(root, ["fetch", "-q", repository, config.checker.commit]);
	return root;
}

test("the full harness blocks a spaced-path violation, passes its correction and preserves source bytes", () => {
	const root = project()                    ;
	const file = join   (root, "new file.py") ;
	writeFileSync(file, "a = 1\nlonger = 2\nmid = 3\n");
	const bytes = readFileSync(file                    ) ;
	const bad   = runChanged  (root, ["--base", "HEAD"]) ;

	expect(bad.status                      ).toBe("violation"  ) ;
	expect(bad.counts.targets              ).toBe(1            ) ;
	expect(bad.files[0]?.beforeSha256      ).toBe(sha256(bytes)) ;
	expect(readFileSync(file).equals(bytes)).toBe(true         ) ;
	writeFileSync(file, "a      = 1\nlonger = 2\nmid    = 3\n");
	const good = runChanged(root, ["--base", "HEAD"]);

	expect(good.status                                                                                  )    .toBe("pass"                       ) ;
	expect(good.checker?.commit                                                                         )    .toBe(bad.checker?.commit          ) ;
	expect(good.selection?.base                                                                         )    .toBe(bad.selection?.base          ) ;
	expect(good.selection?.localChangesId                                                               ).not.toBe(bad.selection?.localChangesId) ;
	expect(good.files[0]?.afterSha256                                                                   )    .toBe(good.files[0]?.beforeSha256  ) ;
	expect(JSON.parse(readFileSync(join(root, ".boxbox/cache/lint-changed/report.json"), "utf8")).status)    .toBe("pass"                       ) ;
}, 180_000);

test("zero targets is explicit, and missing baselines or preparation failures still report errors", () => {
	const root = project();
	mkdirSync(join(root, "test/fixtures"), { recursive: true });
	mkdirSync(join(root, "plugin"));
	writeFileSync(join(root, "test/fixtures/invalid.ts"), "const = ;\n");
	writeFileSync(join(root, "plugin/invalid.ts"), "const = ;\n");
	writeFileSync(join(root, "notes.md"), "Unsupported language\n");
	writeFileSync(join(root, "deleted.py"), "print(1)\n");
	git(root, ["add", "deleted.py"]);
	git(root, ["commit", "-qm", "Deletion input"]);
	rmSync(join(root, "deleted.py"));
	const empty = runChanged(root, ["--base", "HEAD"]) ;

	expect(empty.status                                              ).toBe   ("pass"                  ) ;
	expect(empty.counts.targets                                      ).toBe   (0                       ) ;
	expect(empty.counts.excluded                                     ).toBe   (2                       ) ;
	expect(empty.counts.deleted                                      ).toBe   (1                       ) ;
	expect(readdirSync(join(root, ".boxbox/cache/lint-changed"))     ).toEqual(["report.json"]         ) ;
	expect(empty.files.find(file => file.path === "notes.md")?.status).toBe   ("not-supported-language") ;
	expect(runChanged(root, ["--base", "missing-commit"]).status     ).toBe   ("error"                 ) ;
	writeFileSync(join(root, ".github/boxbox-lint.json"), JSON.stringify({ ...config, checker: { ...config.checker, commit: "f".repeat(40) } }));
	const failed = runChanged(root, ["--base", "HEAD"]);

	expect(failed.status).toBe("error");
	expect(failed.errors.length).toBe(1);
}, 180_000);

test("local and CI commands fail then pass against identical commits, checker pins and input hashes", () => {
	const root      = project()                                               ;
	const harness   = join(repository, "development/harness/lint-changed.ts") ;
	const base      = git(root, ["rev-parse", "HEAD"]).toString().trim()      ;
	const eventPath = join(scratch, "command-event.json")                     ;
	const summary   = join(scratch, "summary.md")                             ;
	writeFileSync(eventPath, JSON.stringify({ pull_request: { base: { sha: base } } }));
	for (const [source, exitCode] of [["a = 1\nlonger = 2\nmid = 3\n", 1], ["a      = 1\nlonger = 2\nmid    = 3\n", 0]] as const) {
		writeFileSync(join(root, "with space.py"), source);
		git(root, ["add", "."]);
		git(root, ["commit", "-qm", `Expected exit ${exitCode}`]);
		const target      = git(root, ["rev-parse", "HEAD"]).toString().trim()                                                                                                                                             ;
		const env         = { ...process.env, GITHUB_ACTIONS: "true", GITHUB_EVENT_NAME: "pull_request", GITHUB_REF: "refs/pull/1/merge", GITHUB_SHA: target, GITHUB_EVENT_PATH: eventPath, GITHUB_STEP_SUMMARY: summary } ;
		const local       = invoke(process.execPath, [harness, "--base", base], root, checkerEnvironment(scratch), 180_000)                                                                                                ;
		const localReport = JSON.parse(readFileSync(join(root, ".boxbox/cache/lint-changed/report.json"), "utf8"))                                                                                                         ;
		const ci          = invoke(process.execPath, [harness, "--ci"], root, env, 180_000)                                                                                                                                ;
		const ciReport    = JSON.parse(readFileSync(join(root, ".boxbox/cache/lint-changed/report.json"), "utf8"))                                                                                                         ;

		expect(local.status                                     ).toBe   (exitCode                         ) ;
		expect(ci.status                                        ).toBe   (exitCode                         ) ;
		expect(ciReport.checker                                 ).toEqual(localReport.checker              ) ;
		expect(ciReport.selection.base                          ).toBe   (localReport.selection.base       ) ;
		expect(ciReport.selection.target                        ).toBe   (localReport.selection.target     ) ;
		expect(ciReport.files[0].beforeSha256                   ).toBe   (localReport.files[0].beforeSha256) ;
		expect(ciReport.files[0].beforeSha256                   ).toBe   (sha256(source)                   ) ;
		expect(readFileSync(join(root, "with space.py"), "utf8")).toBe   (source                           ) ;
	}
	expect(readFileSync(summary, "utf8")).toContain("BoxBox changed-file check: violation");
	expect(readFileSync(summary, "utf8")).toContain("BoxBox changed-file check: pass");
}, 180_000);

test("immutable comparison reads target blobs even when the worktree differs, and rejects symlinks", () => {
	const root = project()                                          ;
	const base = git(root, ["rev-parse", "HEAD"]).toString().trim() ;
	writeFileSync(join(root, "safe.py"), "print(1)\n");
	symlinkSync("safe.py", join(root, "link.py"));
	git(root, ["add", "."]);
	git(root, ["commit", "-qm", "Inputs"]);
	const selected = selectChanges(root, { base, target: "HEAD" });
	writeFileSync(join(root, "safe.py"), "print(2)\n");

	expect(sourceBytes(root, selected, { path: "safe.py", status: "A" }).toString()).toBe   ("print(1)\n"      ) ;
	expect(() => sourceBytes(root, selected, { path: "link.py", status: "A" })     ).toThrow("regular Git blob") ;
	expect(() => safeFile(root, "link.py")                                         ).toThrow("Unsafe input"    ) ;
	mkdirSync(join(root, "real"));
	writeFileSync(join(root, "real/file.py"), "print(1)\n");
	symlinkSync("real", join(root, "alias"));
	expect(() => safeFile(root, "alias/file.py")).toThrow("Unsafe input");
});

test("CI uses PR merge, main push before/after and candidate baseline without silently guessing missing metadata", () => {
	const eventPath = join(scratch, "event.json")                                                                                                      ;
	const env       = { GITHUB_SHA: "b".repeat(40), GITHUB_EVENT_PATH: eventPath, GITHUB_EVENT_NAME: "pull_request", GITHUB_REF: "refs/pull/1/merge" } ;
	writeFileSync(eventPath, JSON.stringify({ pull_request: { base: { sha: "a".repeat(40) } } }));

	expect(comparison(["--ci"], config, env)).toEqual({ base: "a".repeat(40), target: "b".repeat(40) });
	expect(() => comparison(["--ci"], config, { ...env, GITHUB_REF: "refs/heads/topic" })).toThrow();
	writeFileSync(eventPath, JSON.stringify({ ref: "refs/heads/main", before: "a".repeat(40), after: "b".repeat(40) }));
	expect(comparison(["--ci"], config, { ...env, GITHUB_EVENT_NAME: "push" })).toEqual({ base: "a".repeat(40), target: "b".repeat(40) });
	expect(comparison(["--ci"], config, { ...env, GITHUB_EVENT_NAME: "workflow_dispatch" })).toEqual({ base: config.checker.commit, target: "b".repeat(40) });
	writeFileSync(eventPath, JSON.stringify({ ref: "refs/heads/main", before: "0".repeat(40), after: "b".repeat(40) }));
	expect(() => comparison(["--ci"], config, { ...env, GITHUB_EVENT_NAME: "push" })).toThrow();
	expect(() => comparison(["--ci"], config, {})).toThrow();
	expect(() => comparison(["--target", "HEAD"], config)).toThrow();
});

test("the required workflow keeps functional gates and uploads lint evidence on failure", () => {
	const workflow = parse(readFileSync(join(repository, ".github/workflows/verify.yml"), "utf8"))           ;
	const steps    = workflow.jobs["plugin-contract"].steps                                                  ;
	const lint     = steps.find((step: any) => step.run === "bun run lint:changed -- --ci")                  ;
	const upload   = steps.find((step: any) => step.with?.path === ".boxbox/cache/lint-changed/report.json") ;
	const manifest = JSON.parse(readFileSync(join(repository, "package.json"), "utf8"))                      ;

	expect(manifest.scripts["lint:changed"]).toBe("bun development/harness/lint-changed.ts");
	expect(git(repository, ["check-ignore", "--no-index", ".boxbox/cache/lint-changed/probe.json"]).toString().trim()).toBe(".boxbox/cache/lint-changed/probe.json");

	expect(workflow.permissions                                                    ).toEqual({ contents: "read" } ) ;
	expect(steps[0].with["fetch-depth"]                                            ).toBe   (0                    ) ;
	expect(steps.some((step: any) => step.run === "bun run check")                 ).toBe   (true                 ) ;
	expect(steps.some((step: any) => step.run === "bun run sync:plugin -- --check")).toBe   (true                 ) ;
	expect(lint.if                                                                 ).toBe   ("${{ !cancelled() }}") ;
	expect(upload.if                                                               ).toBe   ("${{ !cancelled() }}") ;
	expect(upload.with["include-hidden-files"]                                     ).toBe   (true                 ) ;
	expect(upload.with["if-no-files-found"]                                        ).toBe   ("error"              ) ;
});
