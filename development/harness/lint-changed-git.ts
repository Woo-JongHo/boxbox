import      { spawnSync                         } from "node:child_process" ;
import      { createHash                        } from "node:crypto"        ;
import      { lstatSync, readFileSync, readlinkSync } from "node:fs"            ;
import      { isAbsolute, relative, resolve     } from "node:path"          ;

const GIT_TIMEOUT_MS = 30_000           ;
const GIT_MAX_BUFFER = 64 * 1024 * 1024 ;

export interface Change {
	path          : string ;
	status        : string ;
	previousPath? : string ;
}

export interface Selection {
	mode           : "local" | "commits" ;
	base           : string              ;
	target         : string              ;
	changes        : Change[]            ;
	localChangesId : string | null       ;
}

export function git(root: string, args: readonly string[]): Buffer {
	const result = spawnSync("git", [...args], {
		cwd       : root                                        ,
		encoding  : null                                        ,
		timeout   : GIT_TIMEOUT_MS                              ,
		maxBuffer : GIT_MAX_BUFFER                              ,
		env       : { ...process.env, GIT_OPTIONAL_LOCKS: "0" } ,
	});
	const stderr = Buffer.from(result.stderr ?? "").toString("utf8").trim() ;
	if (result.error !== undefined) throw new Error(`git ${args[0] ?? ""} failed: ${result.error.message}`) ;
	if (result.status !== 0) throw new Error(`git ${args[0] ?? ""} failed${stderr.length === 0 ? "" : `: ${stderr}`}`) ;
	return Buffer.from(result.stdout ?? "") ;
}

function resolveCommit(root: string, revision: string, label: string): string {
	if (revision.length === 0) throw new Error(`${label} must not be empty`) ;
	try {
		return git(root, ["rev-parse", "--verify", "--end-of-options", `${revision}^{commit}`]).toString("utf8").trim() ;
	} catch (error) {
		throw new Error(`cannot resolve ${label} ${JSON.stringify(revision)}: ${error instanceof Error ? error.message : String(error)}`) ;
	}
}

function nulFields(output: Buffer): string[] {
	const fields: string[] = [] ;
	let start              = 0  ;
	for (let index = 0; index < output.length; index += 1) {
		if (output[index] !== 0) continue ;
		try {
			fields.push(new TextDecoder("utf-8", { fatal: true }).decode(output.subarray(start, index))) ;
		} catch {
			throw new Error("git returned a path that is not valid UTF-8") ;
		}
		start = index + 1 ;
	}
	if (start !== output.length) throw new Error("git returned a non-NUL-terminated path record") ;
	return fields ;
}

function parseNameStatus(output: Buffer): Change[] {
	const fields             = nulFields(output) ;
	const changes : Change[] = []                ;
	for (let index = 0; index < fields.length;) {
		const status = fields[index++]! ;
		if (status.length === 0) continue ;
		if (/^[RC][0-9]+$/u.test(status)) {
			const previousPath = fields[index++] ;
			const path         = fields[index++] ;
			if (previousPath === undefined || path === undefined) throw new Error(`incomplete git ${status} record`) ;
			changes.push({ path, status, previousPath }) ;
			continue ;
		}
		const path = fields[index++] ;
		if (path === undefined) throw new Error(`incomplete git ${status} record`) ;
		changes.push({ path, status }) ;
	}
	return changes ;
}

interface StatusSnapshot {
	readonly output    : Buffer   ;
	readonly untracked : string[] ;
}

function statusSnapshot(root: string): StatusSnapshot {
	const output               = git(root, ["status", "--porcelain=v1", "-z", "--untracked-files=all", "--ignored=no"]) ;
	const fields               = nulFields(output)                                                                      ;
	const untracked : string[] = []                                                                                     ;
	for (let index = 0; index < fields.length;) {
		const record = fields[index++]!                                      ;
		if (record.length < 3) throw new Error("malformed git status record") ;
		const code = record.slice(0, 2) ;
		const path = record.slice(3   ) ;
		if (code.includes("U") || ["AA", "DD", "AU", "UA", "DU", "UD"].includes(code)) {
			throw new Error(`unmerged change is not supported: ${JSON.stringify(path)}`) ;
		}
		if (code === "??") untracked.push(path) ;
		if (code.includes("R") || code.includes("C")) {
			if (fields[index++] === undefined) throw new Error(`incomplete git status ${code} record`) ;
		}
	}
	return { output, untracked } ;
}

function mergeChanges(groups: readonly Change[][]): Change[] {
	const selected = new Map<string, Change>() ;
	for (const changes of groups) {
		for (const change of changes) {
			let next = change ;
			if (/^R[0-9]+$/u.test(change.status) && change.previousPath !== undefined) {
				const superseded = selected.get(change.previousPath) ;
				selected.delete(change.previousPath) ;
				if (superseded !== undefined && /^R[0-9]+$/u.test(superseded.status)) {
					next = { ...change, previousPath: superseded.previousPath ?? change.previousPath } ;
				}
			}
			const prior = selected.get(next.path) ;
			if (prior === undefined) {
				selected.set(next.path, { ...next }) ;
				continue ;
			}
			if (next.status === "D") {
				selected.set(next.path, { ...next, previousPath: next.previousPath ?? prior.previousPath }) ;
				continue ;
			}
			if (/^[RC][0-9]+$/u.test(next.status) || !/^[RC][0-9]+$/u.test(prior.status)) {
				selected.set(next.path, { ...next, previousPath: next.previousPath ?? prior.previousPath }) ;
			}
		}
	}
	return [...selected.values()].sort((left, right) => left.path < right.path ? -1 : left.path > right.path ? 1 : 0) ;
}

function hashPart(hash: ReturnType<typeof createHash>, label: string, bytes: Buffer): void {
	hash.update(label).update("\0").update(String(bytes.length)).update("\0").update(bytes) ;
}

function untrackedBytes(root: string, path: string): { readonly kind: string; readonly bytes: Buffer } {
	if (isAbsolute(path)) throw new Error(`git returned an absolute path: ${JSON.stringify(path)}`) ;
	const absolute = resolve (root, path             ) ;
	const back     = relative(resolve(root), absolute) ;
	if (back === ".." || back.startsWith(`..${process.platform === "win32" ? "\\" : "/"}`)) {
		throw new Error(`git returned a path outside the repository: ${JSON.stringify(path)}`) ;
	}
	const stat = lstatSync(absolute) ;
	if (stat.isSymbolicLink()) return { kind: "symlink", bytes: Buffer.from(readlinkSync(absolute, { encoding: "buffer" })) } ;
	if (stat.isFile()) return { kind: "file", bytes: readFileSync(absolute) } ;
	return { kind: `mode:${stat.mode}`, bytes: Buffer.alloc(0) } ;
}

function localId(root: string, snapshot: StatusSnapshot, indexDiff: Buffer, worktreeDiff: Buffer): string | null {
	if (snapshot.output.length === 0) return null ;
	const hash = createHash("sha256") ;
	hashPart(hash, "status", snapshot.output) ;
	hashPart(hash, "index", indexDiff) ;
	hashPart(hash, "worktree", worktreeDiff) ;
	for (const path of [...snapshot.untracked].sort()) {
		const content = untrackedBytes(root, path) ;
		hashPart(hash, `untracked-path:${path}`, Buffer.from(content.kind)) ;
		hashPart(hash, `untracked-bytes:${path}`, content.bytes) ;
	}
	return hash.digest("hex") ;
}

function diffChanges(root: string, left: string, right?: string, cached = false): Change[] {
	const args = ["diff", "--name-status", "-z", "--find-renames", "--no-ext-diff", "--no-textconv"] ;
	if (cached) args.push("--cached") ;
	args.push(left) ;
	if (right !== undefined) args.push(right) ;
	return parseNameStatus(git(root, args)) ;
}

export function selectChanges(root: string, options: { base?: string; target?: string } = {}): Selection {
	if (options.target !== undefined) {
		if (options.base === undefined) throw new Error("base is required when target is provided") ;
		const base    = resolveCommit(root, options.base, "base"    ) ;
		const target  = resolveCommit(root, options.target, "target") ;
		const changes = diffChanges  (root, base, target            ) ;
		return { mode: "commits", base, target, changes, localChangesId: null } ;
	}

	const head = resolveCommit(root, "HEAD", "target") ;
	let base: string ;
	if (options.base !== undefined) {
		base = resolveCommit(root, options.base, "base") ;
	} else {
		const main = resolveCommit(root, "origin/main", "default base") ;
		base = git(root, ["merge-base", main, head]).toString("utf8").trim() ;
		if (base.length === 0) throw new Error("cannot determine merge-base for origin/main and HEAD") ;
	}

	const snapshot     = statusSnapshot        (root                                                                                          ) ;
	const committed    = diffChanges           (root, base, head                                                                              ) ;
	const staged       = diffChanges           (root, head, undefined, true                                                                   ) ;
	const unstaged     = diffChanges           (root, "--"                                                                                    ) ;
	const untracked    = snapshot.untracked.map(path => ({ path, status: "A" })                                                               ) ;
	const indexDiff    = git                   (root, ["diff", "--cached", "--binary", "--full-index", "--no-ext-diff", "--no-textconv", head]) ;
	const worktreeDiff = git                   (root, ["diff", "--binary", "--full-index", "--no-ext-diff", "--no-textconv"]                  ) ;
	return {
		mode           : "local",
		base,
		target         : head                                                   ,
		changes        : mergeChanges([committed, staged, unstaged, untracked]) ,
		localChangesId : localId(root, snapshot, indexDiff, worktreeDiff)       ,
	};
}
