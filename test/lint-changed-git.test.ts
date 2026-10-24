import      { spawnSync                    } from "node:child_process" ;
import      { mkdtempSync, rmSync, symlinkSync, unlinkSync, writeFileSync } from "node:fs"            ;
import      { tmpdir                       } from "node:os"            ;
import      { join                         } from "node:path"          ;
import      { afterEach, describe, expect, test } from "bun:test"             ;
import      { selectChanges                } from "../development/harness/lint-changed-git.ts" ;

const roots: string[] = [] ;

function command(root: string, ...args: string[]): string {
	const run = spawnSync("git", args, { cwd: root, encoding: "utf8" }) ;
	if (run.status !== 0) throw new Error(`${args.join(" ")}: ${run.stderr}`) ;
	return run.stdout.trim() ;
}

function repo(): string {
	const root = mkdtempSync(join(tmpdir(), "boxbox-lint-git-")) ;
	roots.push(root)                                              ;
	command(root, "init", "-q")                                 ;
	command(root, "config", "user.name", "BoxBox Test")         ;
	command(root, "config", "user.email", "boxbox@example.test") ;
	command(root, "branch", "-M", "main")                       ;
	return root ;
}

function commitAll(root: string, message: string): string {
	command(root, "add", "--all")       ;
	command(root, "commit", "-qm", message) ;
	return command(root, "rev-parse", "HEAD") ;
}

function seed(root: string): string {
	for (const path of ["committed.ts", "staged.ts", "unstaged.ts", "renamed.ts", "deleted.ts", "typed.ts", "cancelled.ts"]) {
		writeFileSync(join(root, path), `const ${path.replace(".ts", "")} = 1;\n`) ;
	}
	writeFileSync(join(root, ".gitignore"), "ignored.ts\n") ;
	return commitAll(root, "seed") ;
}

afterEach(() => {
	for (const root of roots.splice(0)) rmSync(root, { recursive: true, force: true }) ;
});

describe("selectChanges", () => {
	test("combines committed, staged, unstaged, renamed, deleted, type and untracked changes", () => {
		const root = repo()     ;
		const base = seed(root) ;
		writeFileSync(join(root, "committed.ts"), "const committed = 2;\n") ;
		writeFileSync(join(root, "committed-add.ts"), "export {};\n")       ;
		commitAll(root, "committed changes")                                 ;

		writeFileSync(join(root, "staged.ts"), "const staged = 2;\n") ;
		command(root, "add", "--", "staged.ts")                       ;
		writeFileSync(join(root, "unstaged.ts"), "const unstaged = 2;\n") ;
		command(root, "mv", "--", "renamed.ts", "renamed next.ts")       ;
		unlinkSync(join(root, "deleted.ts"))                                ;
		unlinkSync(join(root, "typed.ts"))                                  ;
		symlinkSync("staged.ts", join(root, "typed.ts"))                   ;
		writeFileSync(join(root, "cancelled.ts"), "const cancelled = 2;\n") ;
		command(root, "add", "--", "cancelled.ts")                         ;
		writeFileSync(join(root, "cancelled.ts"), "const cancelled = 1;\n") ;
		writeFileSync(join(root, "-odd\nfile.ts"), "const odd = 1;\n")       ;
		writeFileSync(join(root, "ignored.ts"), "ignored\n")                 ;

		const selected = selectChanges(root, { base })                                  ;
		const changes  = new Map(selected.changes.map(change => [change.path, change])) ;
		expect(selected.mode          ).toBe   ("local"                           ) ;
		expect(selected.base          ).toBe   (base                              ) ;
		expect(selected.target        ).toBe   (command(root, "rev-parse", "HEAD")) ;
		expect(selected.localChangesId).toMatch(/^[0-9a-f]{64}$/                  ) ;
		expect([...changes.keys()]).toEqual([
			"-odd\nfile.ts", "cancelled.ts", "committed-add.ts", "committed.ts", "deleted.ts",
			"renamed next.ts", "staged.ts", "typed.ts", "unstaged.ts",
		]) ;
		expect(changes.get("renamed next.ts")   ).toMatchObject({ status: "R100", previousPath: "renamed.ts" }) ;
		expect(changes.get("deleted.ts")?.status).toBe         ("D"                                           ) ;
		expect(changes.get("typed.ts")?.status  ).toBe         ("T"                                           ) ;
		expect(changes.has("ignored.ts")        ).toBe         (false                                         ) ;

		const firstId = selected.localChangesId                                 ;
		writeFileSync(join(root, "-odd\nfile.ts"), "const odd = 2;\n")         ;
		expect(selectChanges(root, { base }).localChangesId).not.toBe(firstId)   ;
	});

	test("hashes an untracked symlink without following its target", () => {
		const root    = repo()                                                            ;
		const base    = seed(root                                                       ) ;
		const outside = join(tmpdir(), `boxbox-link-target-${process.pid}-${Date.now()}`) ;
		writeFileSync(outside, "one")                 ;
		symlinkSync(outside, join(root, "link.ts"))    ;
		const first = selectChanges(root, { base }).localChangesId ;
		writeFileSync(outside, "two")                 ;
		expect(selectChanges(root, { base }).localChangesId).toBe(first) ;
		unlinkSync(join(root, "link.ts"))              ;
		symlinkSync(`${outside}-other`, join(root, "link.ts")) ;
		expect(selectChanges(root, { base }).localChangesId).not.toBe(first) ;
		rmSync(outside, { force: true })                ;
	});

	test("replaces superseded paths across committed, added and chained staged renames", () => {
		const root = repo()     ;
		const base = seed(root) ;
		writeFileSync(join(root, "committed.ts"), "const committed = 2;\n") ;
		writeFileSync(join(root, "added.ts"), "export {};\n")                 ;
		command(root, "mv", "--", "renamed.ts", "rename-middle.ts")         ;
		commitAll(root, "prepare renames")                                     ;
		command(root, "mv", "--", "committed.ts", "committed-final.ts")     ;
		command(root, "mv", "--", "added.ts", "added-final.ts")             ;
		command(root, "mv", "--", "rename-middle.ts", "rename-final.ts")    ;

		const changes = new Map(selectChanges(root, { base }).changes.map(change => [change.path, change])) ;
		expect([...changes.keys()]              ).toEqual      (["added-final.ts", "committed-final.ts", "rename-final.ts"]) ;
		expect(changes.get("committed-final.ts")).toMatchObject({ status: "R100", previousPath: "committed.ts" }           ) ;
		expect(changes.get("added-final.ts")    ).toMatchObject({ status: "R100", previousPath: "added.ts" }               ) ;
		expect(changes.get("rename-final.ts")   ).toMatchObject({ status: "R100", previousPath: "renamed.ts" }             ) ;
	});

	test("selects current content when a committed deletion is recreated as untracked", () => {
		const root = repo()     ;
		const base = seed(root) ;
		unlinkSync(join(root, "deleted.ts"))                       ;
		commitAll(root, "delete tracked file")                     ;
		writeFileSync(join(root, "deleted.ts"), "const current = 1;\n") ;
		expect(selectChanges(root, { base }).changes).toContainEqual({ path: "deleted.ts", status: "A" }) ;
	});

	test("rejects Git paths that are not valid UTF-8", () => {
		const root   = repo         ()                                                                                     ;
		const base   = seed         (root                                                                                ) ;
		const blob   = command      (root, "rev-parse", "HEAD:committed.ts"                                              ) ;
		const record = Buffer.concat([Buffer.from(`100644 ${blob}\tinvalid-`), Buffer.from([0xff]), Buffer.from(".ts\0")]) ;
		const update = spawnSync    ("git", ["update-index", "-z", "--index-info"], { cwd: root, input: record }         ) ;
		expect(update.status).toBe(0) ;
		expect(() => selectChanges(root, { base })).toThrow("not valid UTF-8") ;
	});

	test("commit mode resolves immutable endpoints and ignores local dirt", () => {
		const root = repo()     ;
		const base = seed(root) ;
		command(root, "mv", "--", "renamed.ts", "committed rename.ts") ;
		unlinkSync(join(root, "deleted.ts"))                             ;
		writeFileSync(join(root, "committed-add.ts"), "export {};\n")    ;
		const target = commitAll(root, "target")                          ;
		writeFileSync(join(root, "unstaged.ts"), "dirty\n")              ;
		writeFileSync(join(root, "untracked.ts"), "dirty\n")             ;

		const selected = selectChanges(root, { base, target })             ;
		expect(selected).toMatchObject({ mode: "commits", base, target, localChangesId: null }) ;
		expect(selected.changes).toEqual([
			{ path : "committed rename.ts" , status : "R100", previousPath: "renamed.ts" },
			{ path : "committed-add.ts"    , status : "A"                                },
			{ path : "deleted.ts"          , status : "D"                                },
		]) ;
	});

	test("uses the merge-base of origin/main and HEAD by default", () => {
		const root = repo()     ;
		const base = seed(root) ;
		command(root, "update-ref", "refs/remotes/origin/main", base) ;
		command(root, "checkout", "-qb", "feature")                 ;
		writeFileSync(join(root, "feature.ts"), "export {};\n")      ;
		const target   = commitAll    (root, "feature") ;
		const selected = selectChanges(root           ) ;
		expect(selected).toMatchObject({ mode: "local", base, target, localChangesId: null }) ;
		expect(selected.changes).toEqual([{ path: "feature.ts", status: "A" }]) ;
	});

	test("fails closed for missing revisions, missing default baseline and conflicts", () => {
		const root = repo()     ;
		const base = seed(root) ;
		expect(() => selectChanges(root, { base: "missing" })        ).toThrow("cannot resolve base"        ) ;
		expect(() => selectChanges(root, { base, target: "missing" })).toThrow("cannot resolve target"      ) ;
		expect(() => selectChanges(root, { target: "HEAD" })         ).toThrow("base is required"           ) ;
		expect(() => selectChanges(root)                             ).toThrow("cannot resolve default base") ;

		command(root, "checkout", "-qb", "side")                      ;
		writeFileSync(join(root, "committed.ts"), "const side = 1;\n") ;
		commitAll(root, "side")                                          ;
		command(root, "checkout", "main")                               ;
		writeFileSync(join(root, "committed.ts"), "const main = 1;\n") ;
		commitAll(root, "main")                                          ;
		const merge = spawnSync("git", ["merge", "side"], { cwd: root, encoding: "utf8" }) ;
		expect(merge.status).not.toBe(0)                                  ;
		expect(() => selectChanges(root, { base })).toThrow("unmerged change") ;
	});
});
