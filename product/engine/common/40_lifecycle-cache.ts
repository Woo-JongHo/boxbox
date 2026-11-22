import      { AsyncLocalStorage      } from "node:async_hooks"           ;
import      { createHash, randomUUID } from "node:crypto"                ;
import      {
              lstatSync            ,
              opendirSync          ,
              readFileSync         ,
              realpathSync         ,
              renameSync           ,
              statSync             ,
              unlinkSync           ,
              writeFileSync
                                     } from "node:fs"                    ;
import      { isAbsolute, resolve    } from "node:path"                  ;

import type { FileResult             } from "@/common/24_result-json.ts" ;
import      { summarize              } from "@/common/24_result-json.ts" ;

/** Actual parser filesystem observations; contents are hashed and never stored in the cache. */
export interface InspectionDependency {
	readonly operation   : "readFile" | "fileExists" | "directoryExists" | "getAccessibleEntries" | "realpath" ;
	readonly path        : string                                                                              ;
	readonly fingerprint : string                                                                              ;
}

interface Observation {
	readonly dependencies : Map<string, InspectionDependency>;
	stable : boolean;
}

export interface ObservedInspection {
	readonly result       : FileResult                      ;
	readonly dependencies : readonly InspectionDependency[] ;
	readonly stable       : boolean                         ;
}

interface CachedInspection {
	readonly schemaVersion : 1                               ;
	readonly key           : string                          ;
	readonly result        : FileResult                      ;
	readonly dependencies  : readonly InspectionDependency[] ;
}

const observations          = new AsyncLocalStorage<Observation>()                                                       ;
const MAX_CACHE_BYTES       = 8 * 1024 * 1024                                                                            ;
const MAX_DIRECTORY_ENTRIES = 4096                                                                                       ;
const MAX_DEPENDENCIES      = 20_000                                                                                     ;
const OPERATIONS            = new Set(["readFile", "fileExists", "directoryExists", "getAccessibleEntries", "realpath"]) ;

const digest  = (value: string | Buffer): string => createHash("sha256").update(value).digest("hex")                                                                 ;
const missing = (error: unknown): boolean => typeof error === "object" && error !== null && "code" in error && (error.code === "ENOENT" || error.code === "ENOTDIR") ;

function directoryNames(path: string): readonly string[] {
	const directory       = opendirSync(path) ;
	const names: string[] = []                ;
	try {
		for (let entry = directory.readSync(); entry !== null; entry = directory.readSync()) {
			names.push(entry.name);
			if (names.length > MAX_DIRECTORY_ENTRIES) throw new Error("Inspection directory observation limit exceeded");
		}
	} finally { directory.closeSync(); }
	return names.sort();
}

function dependencyValue(operation: InspectionDependency["operation"], path: string): unknown {
	try {
		if (operation === "readFile") {
			const raw  = readFileSync(path  ) ;
			const text = raw.toString("utf8") ;
			if (!Buffer.from(text, "utf8").equals(raw)) throw new Error("Parser input is not UTF-8");
			// Native TypeScript decoding strips the BOM; delegate that path rather than changing AST offsets.
			if (text.startsWith("\uFEFF")) throw new Error("Parser BOM decoding requires the native filesystem");
			return text;
		}
		if (operation === "fileExists"     ) return statSync(path).isFile();
		if (operation === "directoryExists") return statSync(path).isDirectory();
		if (operation === "realpath"       ) return realpathSync(path);

		const files       : string[] = [] ;
		const directories : string[] = [] ;
		for (const name of directoryNames(path)) {
			const status = statSync(resolve(path, name));
			if (status.isFile()) files.push(name);
			if (status.isDirectory()) directories.push(name);
		}
		return { files, directories };
	} catch (error) {
		if (!missing(error)) throw error;
		if (operation === "readFile") return null;
		if (operation === "fileExists" || operation === "directoryExists") return false;
		// Delegating these cases back to the native FS would leave an unobserved dependency.
		throw error;
	}
}

function dependencyFingerprint(operation: InspectionDependency["operation"], path: string, value: unknown): string {
	return digest(JSON.stringify({ operation, path, value }));
}

/** Omitted outside a cache observation, so ordinary source/write API behavior is unchanged. */
export function inspectionFileSystem(root: string) {
	const observed = observations.getStore();
	if (!observed) return undefined;
	const read = (operation: InspectionDependency["operation"], input: string): string | null | boolean | { files: string[]; directories: string[] } | undefined => {
		try {
			const path        = resolve(root, input)                          ;
			const value       = dependencyValue(operation, path)              ;
			const fingerprint = dependencyFingerprint(operation, path, value) ;
			const key         = `${operation}\0${path}`                       ;
			const previous    = observed.dependencies.get(key)                ;
			if (previous && previous.fingerprint !== fingerprint) observed.stable = false;
			if (observed.dependencies.size >= MAX_DEPENDENCIES && !previous) observed.stable = false;
			else observed.dependencies.set(key, { operation, path, fingerprint });
			return value as string | null | boolean | { files: string[]; directories: string[] };
		} catch {
			observed.stable = false;
			return undefined;
		}
	};
	return {
		readFile             : (path: string) => read("readFile", path) as string | null | undefined                                          ,
		fileExists           : (path: string) => read("fileExists", path) as boolean | undefined                                              ,
		directoryExists      : (path: string) => read("directoryExists", path) as boolean | undefined                                         ,
		getAccessibleEntries : (path: string) => read("getAccessibleEntries", path) as { files: string[]; directories: string[] } | undefined ,
		realpath             : (path: string) => read("realpath", path) as string | undefined                                                 ,
	};
}

export function inspectionDependenciesCurrent(dependencies: readonly InspectionDependency[]): boolean {
	try {
		return dependencies.every(item => dependencyFingerprint(item.operation, item.path, dependencyValue(item.operation, item.path)) === item.fingerprint);
	} catch { return false; }
}

export async function observeInspection(inspect: () => Promise<FileResult>): Promise<ObservedInspection> {
	const observation: Observation = { dependencies: new Map(), stable: true }    ;
	const result                   = await observations.run(observation, inspect) ;
	const dependencies             = [...observation.dependencies.values()]       ;
	return { result, dependencies, stable: observation.stable && inspectionDependenciesCurrent(dependencies) };
}

export function inspectionCacheKey(root: string, file: string, mode: string, source: string, context: string): string {
	return digest(JSON.stringify({ root, file, mode, source, context }));
}

function cachePath(directory: string, file: string): string {
	return resolve(directory, `inspection-${digest(file)}.cache`);
}

function validResult(value: unknown, file: string): value is FileResult {
	if (typeof value !== "object" || value === null)                                                                                                         return false;
	const result = value as FileResult;
	if (result.file !== file || result.mode !== "check" || typeof result.language !== "string" || !Array.isArray(result.groups))                             return false;
	for (const group of result.groups) {
		if (typeof group !== "object" || group === null || typeof group.kind !== "string" || !["PASS", "FIXABLE", "SUGGEST", "REFUSE"].includes(group.state)                                     ) return false;
		// Tool availability is not stable source evidence; retry it on the next unchanged post.
		if (group.kind === "syntax-validation-error")                                                                                                                                              return false;

		if (![group.startLine, group.endLine, group.rows, group.edits].every(Number.isSafeInteger) || group.startLine < 1 || group.endLine < group.startLine || group.rows < 0 || group.edits < 0) return false;
		if (!Array.isArray(group.axes) || !group.axes.every((axis: unknown) => typeof axis === "string")                                                                                         ) return false;
	}
	if (!result.summary || !result.parse || !["ok", "changed", "skipped", "not-run"].includes(result.parse.status) || typeof result.parse.tool !== "string") return false;
	const expected = summarize(result.groups);
	return Object.entries(expected).every(([key, count]) => result.summary[key as keyof typeof expected] === count);
}

/** Corrupt, obsolete, unavailable or changed dependencies are a miss, never an inspection result. */
export function readInspectionCache(directory: string, file: string, key: string): ObservedInspection | null {
	try {
		const path   = cachePath(directory, file) ;
		const status = lstatSync(path           ) ;
		if (!status.isFile() || status.isSymbolicLink() || status.size > MAX_CACHE_BYTES)          return null;
		const parsed = JSON.parse(readFileSync(path, "utf8"));
		if (typeof parsed.payload !== "string" || parsed.digest !== digest(parsed.payload))        return null;
		const cached = JSON.parse(parsed.payload) as CachedInspection;
		if (cached.schemaVersion !== 1 || cached.key !== key || !validResult(cached.result, file)) return null;
		if (!Array.isArray(cached.dependencies) || cached.dependencies.length > MAX_DEPENDENCIES)  return null;
		for (const item of cached.dependencies) {
			if (!item || !OPERATIONS.has(item.operation) || typeof item.path !== "string" || !isAbsolute(item.path) || typeof item.fingerprint !== "string" || !/^[a-f0-9]{64}$/u.test(item.fingerprint)) return null;
		}
		if (!inspectionDependenciesCurrent(cached.dependencies))                                   return null;
		return { result: cached.result, dependencies: cached.dependencies, stable: true };
	} catch { return null; }
}

export function writeInspectionCache(directory: string, file: string, key: string, observed: ObservedInspection): void {
	if (!observed.stable || !validResult(observed.result, file) || !inspectionDependenciesCurrent(observed.dependencies)) return;
	const path      = cachePath(directory, file)    ;
	const temporary = `${path}-${randomUUID()}.tmp` ;
	try {
		const cached: CachedInspection = { schemaVersion: 1, key, result: observed.result, dependencies: observed.dependencies } ;
		const payload                  = JSON.stringify(cached)                                                                  ;
		const encoded                  = JSON.stringify({ payload, digest: digest(payload) })                                    ;
		if (Buffer.byteLength(encoded) > MAX_CACHE_BYTES) return;
		writeFileSync(temporary, encoded, { flag: "wx", mode: 0o600 });
		renameSync(temporary, path);
	} catch { /* Cache availability does not alter inspection or refusal behavior. */ }
	finally {
		try { unlinkSync(temporary); }
		catch { /* A successful rename already consumed the temporary file. */ }
	}
}
