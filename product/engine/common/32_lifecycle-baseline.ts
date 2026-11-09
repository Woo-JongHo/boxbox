import      { createHash                                             } from "node:crypto"                           ;
import      { closeSync, lstatSync, openSync, readFileSync, readSync } from "node:fs"                               ;
import      { extname, isAbsolute, join, relative, resolve, sep      } from "node:path"                             ;
import      { CST, Lexer, parseDocument                              } from "yaml"                                  ;
import      { supported                                              } from "@/common/25_guarded-run.ts"            ;
import type { Snapshot                                               } from "@/common/25_guarded-run.ts"            ;
import      { tokenStream                                            } from "@/typescript/16_token-preservation.ts" ;
import      { spawnSync                                              } from "node:child_process"                    ;

export interface FileFootprint {
	readonly h : string       ;
	readonly b : number       ;
	readonly l : number       ;
	/** Protected tokens, comments, line breaks and indentation; null when unavailable. */
	readonly s : string | null;
}

export interface LifecycleBaseline {
	readonly schemaVersion : 1 | 2                                   ;
	readonly hashes        : Snapshot                                ;
	readonly footprints    : Readonly<Record<string, FileFootprint>> ;
}

export interface LifecycleBaselineV2 extends LifecycleBaseline {
	readonly schemaVersion : 2;
}

export interface FileChangeFootprint {
	readonly file   : string                                                                              ;
	readonly change : "unchanged" | "horizontal-whitespace" | "content" | "added" | "deleted" | "unknown" ;
	readonly before : { readonly bytes: number; readonly lines: number } | null                           ;
	readonly after  : { readonly bytes: number; readonly lines: number } | null                           ;
	/** Observed byte delta only; it does not attribute a change to BoxBox. */
	readonly whitespaceBytes : number | null;
}

export interface FootprintComparison {
	readonly available: boolean;
	readonly files: readonly FileChangeFootprint[];
	readonly totals: {
		readonly beforeBytes               : number | null ;
		readonly afterBytes                : number | null ;
		readonly beforeLines               : number | null ;
		readonly afterLines                : number | null ;
		readonly whitespaceBytes           : number        ;
		readonly whitespaceTokensEstimated : number        ;
		readonly contentChangedFiles       : number        ;
		readonly unknownFiles              : number        ;
	} | null;
}

const MAX_SOURCE_BYTES = 8 * 1024 * 1024                                                                                                            ;
const HEX              = /^[a-f0-9]{64}$/u                                                                                                          ;
const digest           = (value: string | Buffer): string => createHash("sha256").update(value).digest("hex")                                       ;
const object           = (value: unknown): value is Record<string, unknown> => typeof value === "object" && value !== null && !Array.isArray(value) ;
const count            = (value: unknown): value is number => Number.isSafeInteger(value) && (value as number) >= 0                                 ;

const sourceParts = (file: string): string[] => sep === "\\" ? file.split(/[\\/]/u) : file.split("/");

/** Validate a relative source name before using it as a path. */
function sourceName(file: string): void {
	if (!file || isAbsolute(file) || sep === "\\" && /^[A-Za-z]:/u.test(file) || sourceParts(file).some(part => part === ".." || part === "." || part === "")) {
		throw new Error("Invalid baseline source name");
	}
}

/** Inspect each component, so a linked parent cannot redirect a source read. */
function regularSource(root: string, file: string): string | null {
	sourceName(file);
	const absolute = resolve (root, file    ) ;
	const local    = relative(root, absolute) ;
	if (local === ".." || local.startsWith(`..${sep}`) || isAbsolute(local)) throw new Error("Source leaves the project");
	let current = root;
	try {
		if (!lstatSync(current).isDirectory() || lstatSync(current).isSymbolicLink()) return null;
		const components = sourceParts(file);
		for (let index = 0; index < components.length; index += 1) {
			current = join(current, components[index]!);
			const status = lstatSync(current);
			if (status.isSymbolicLink() || (index + 1 < components.length ? !status.isDirectory() : !status.isFile())) return null;
		}
		return absolute;
	} catch {
		return null;
	}
}

/** A volume fingerprint, not a syntax/semantic approval or proof that BoxBox performed a write. */
function protectedFingerprint(text: string, file: string): string | null {
	try {
		const extension   = extname(file).toLowerCase()                             ;
		if (extension === ".tsx") return null;
		const indentation = text.split("\n").map(line => /^[ \t]*/u.exec(line)![0]) ;
		let tokens: unknown                                                         ;
		if (extension === ".py") return null;
		if (extension === ".yaml" || extension === ".yml") {
			if (parseDocument(text).errors.length) return null;
			const values: string[] = []    ;
			let scalar             = false ;
			for (const token of new Lexer().lex(text)) {
				if (scalar || CST.tokenType(token) !== "space") values.push(token);
				scalar = token === "\x1f";
			}
			tokens = values;
		} else {
			if (extension === ".json") JSON.parse(text);
			tokens = tokenStream(text);
		}
		return digest(JSON.stringify([indentation, tokens]));
	} catch {
		return null;
	}
}

const PYTHON_FINGERPRINT_SCRIPT = String.raw`
import ast, hashlib, io, json, re, sys, token, tokenize


def fingerprint(source):
    try:
        ast.parse(source)
        lines = source.splitlines(keepends=True)
        starts = [0]
        for line in lines:
            starts.append(starts[-1] + len(line))
        values = []
        depth = 0
        opening = 0
        for item in tokenize.generate_tokens(io.StringIO(source).readline):
            name = token.tok_name.get(item.type, str(item.type))
            if name in ("FSTRING_START", "TSTRING_START"):
                if depth == 0:
                    opening = starts[item.start[0] - 1] + item.start[1]
                depth += 1
            elif name in ("FSTRING_END", "TSTRING_END") and depth:
                depth -= 1
                if depth == 0:
                    closing = starts[item.end[0] - 1] + item.end[1]
                    values.append(["FORMATTED", source[opening:closing]])
            elif depth == 0:
                values.append([name, item.string])
        if depth:
            return None
        indentation = [re.match(r"[ \t]*", line).group(0) for line in source.split("\n")]
        payload = json.dumps([indentation, values], ensure_ascii=False, separators=(",", ":"))
        return hashlib.sha256(payload.encode("utf-8")).hexdigest()
    except Exception:
        return None


sources = json.load(sys.stdin)
print(json.dumps([fingerprint(source) for source in sources]))
`;

const MAX_PYTHON_BATCH_BYTES = 8 * 1024 * 1024 ;
const MAX_PYTHON_BATCH_FILES = 256             ;

/** One bounded parser process amortizes Python startup; failures only make fingerprints unavailable. */
function flushPythonFingerprints(footprints: Record<string, FileFootprint>, pending: Map<string, string>): void {
	let files   : string[] = [] ;
	let sources : string[] = [] ;
	let bytes              = 2  ;
	const flush = (): void => {
		if (!sources.length) return;
		try {
			const child = spawnSync("python3", ["-I", "-c", PYTHON_FINGERPRINT_SCRIPT], {
				input     : JSON.stringify(sources) ,
				encoding  : "utf8"                  ,
				timeout   : 5000                    ,
				maxBuffer : 256 * 1024              ,
			});
			if (!child.error && !child.signal && child.status === 0 && !child.stderr) {
				const values: unknown = JSON.parse(child.stdout);
				if (Array.isArray(values) && values.length === files.length) {
					files.forEach((file, index) => {
						const value = values[index];
						if (typeof value === "string" && HEX.test(value)) footprints[file] = { ...footprints[file]!, s: value };
					});
				}
			}
		} catch {
			// Optional volume metadata must not change SessionStart success or expose parser diagnostics.
		}
		files   = [] ;
		sources = [] ;
		bytes   = 2  ;
	};
	for (const [file, source] of pending) {
		const size = Buffer.byteLength(JSON.stringify(source)) + 1;
		if (size > MAX_PYTHON_BATCH_BYTES - 2) continue;
		if (bytes + size > MAX_PYTHON_BATCH_BYTES || files.length >= MAX_PYTHON_BATCH_FILES) flush();
		files.push(file);
		sources.push(source);
		bytes += size;
	}
	flush();
	pending.clear();
}

function footprint(root: string, file: string, expectedHash: string, pending: Map<string, string>): FileFootprint | null {
	const path = regularSource(root, file);
	if (!path) return null;
	if (lstatSync(path).size > MAX_SOURCE_BYTES) {
		const descriptor = openSync(path, "r")     ;
		const hasher     = createHash("sha256")    ;
		const buffer     = Buffer.alloc(64 * 1024) ;
		let size         = 0                       ;
		let lines        = 0                       ;
		let last         = -1                      ;
		try {
			for (;;) {
				const bytes = readSync(descriptor, buffer, 0, buffer.length, null);
				if (!bytes) break;
				hasher.update(buffer.subarray(0, bytes));
				for (let index = 0; index < bytes; index += 1) if (buffer[index] === 10) lines += 1;
				size += bytes;
				last = buffer[bytes - 1]!;
			}
		} finally {
			closeSync(descriptor);
		}
		if (hasher.digest("hex") !== expectedHash) throw new Error("Source changed during footprint capture");
		return { h: expectedHash, b: size, l: lines + (last === 10 ? 0 : 1), s: null };
	}
	const bytes = readFileSync(path);
	if (digest(bytes) !== expectedHash) throw new Error("Source changed during footprint capture");
	const text      = bytes.toString("utf8")                                                                     ;
	const validUtf8 = Buffer.from(text).equals(bytes)                                                            ;
	const lines     = bytes.length === 0 ? 0 : (text.match(/\n/gu)?.length ?? 0) + (text.endsWith("\n") ? 0 : 1) ;
	if (validUtf8 && extname(file).toLowerCase() === ".py") pending.set(file, text);
	return { h: expectedHash, b: bytes.length, l: lines, s: validUtf8 ? protectedFingerprint(text, file) : null };
}

/** Extend a supplied hash snapshot without changing the shared Snapshot contract. */
export function captureLifecycleBaseline(root: string, hashes: Snapshot): LifecycleBaselineV2 {
	const footprints: Record<string, FileFootprint> = {}                        ;
	const pending                                   = new Map<string, string>() ;
	let pendingBytes                                = 0                         ;
	for (const [file, hash] of Object.entries(hashes)) {
		sourceName(file);
		if (!supported.has(extname(file).toLowerCase()) || !HEX.test(hash)) continue;
		let value: FileFootprint | null;
		try { value = footprint(root, file, hash, pending); }
		catch { continue; }
		if (value) footprints[file] = value;
		if (pending.has(file)) pendingBytes += Buffer.byteLength(JSON.stringify(pending.get(file)!));
		if (pending.size >= MAX_PYTHON_BATCH_FILES || pendingBytes >= MAX_PYTHON_BATCH_BYTES) {
			flushPythonFingerprints(footprints, pending);
			pendingBytes = 0;
		}
	}
	flushPythonFingerprints(footprints, pending);
	return { schemaVersion: 2, hashes: { ...hashes }, footprints };
}

/** Read old path/hash baselines and the versioned footprint form. Errors do not include input data. */
export function decodeLifecycleBaseline(value: unknown): LifecycleBaseline {
	if (!object(value)) throw new Error("Invalid lifecycle baseline");
	const versioned = Object.hasOwn(value, "schemaVersion");
	if (versioned && (value.schemaVersion !== 2 || !object(value.hashes) || !object(value.footprints))) throw new Error("Unsupported lifecycle baseline version or shape");
	const source           = versioned ? value.hashes as Record<string, unknown> : value ;
	const hashes: Snapshot = {}                                                          ;
	for (const [file, hash] of Object.entries(source)) {
		sourceName(file);
		if (typeof hash !== "string" || !/^(?:symlink:)?[a-f0-9]{64}$/u.test(hash)) throw new Error("Invalid lifecycle baseline hash");
		hashes[file] = hash;
	}
	const footprints: Record<string, FileFootprint> = {};
	for (const [file, entry] of Object.entries(versioned ? value.footprints as Record<string, unknown> : {})) {
		sourceName(file);
		if (!object(entry) || typeof entry.h !== "string" || !HEX.test(entry.h) || entry.h !== hashes[file] || !count(entry.b) || !count(entry.l) || !(entry.s === null || typeof entry.s === "string" && HEX.test(entry.s))) {
			throw new Error("Invalid lifecycle baseline footprint");
		}
		footprints[file] = { h: entry.h as string, b: entry.b, l: entry.l, s: entry.s as string | null };
	}
	return { schemaVersion: versioned ? 2 : 1, hashes, footprints };
}

export const baselineHashes = (value: unknown): Snapshot => decodeLifecycleBaseline(value).hashes;

/** Compare observable footprints. Legacy baselines have no reconstructable before sizes. */
export function compareBaselineFootprints(root: string, baseline: LifecycleBaseline, hashes: Snapshot, captured?: LifecycleBaselineV2): FootprintComparison {
	if (baseline.schemaVersion === 1) return { available: false, files: [], totals: null };
	const current = captured ?? captureLifecycleBaseline(root, hashes)                                                                                        ;
	const files   = [...new Set([...Object.keys(baseline.hashes), ...Object.keys(hashes)])].filter(file => supported.has(extname(file).toLowerCase())).sort() ;
	const changes = files.map(file => {
			const old  = baseline.footprints[file]        ;
			const hash = hashes[file]                     ;
			const now  = current.footprints[file] ?? null ;
			const change: FileChangeFootprint["change"] =
				!baseline.hashes[file] ? "added" : !hash ? "deleted" : baseline.hashes[file] === hash ? "unchanged"
				: !old || !now || old.s === null || now.s === null ? "unknown" : old.s === now.s ? "horizontal-whitespace" : "content";
			return {
				file   ,
				change ,
				before          : old ? { bytes: old.b, lines: old.l } : null                             ,
				after           : now ? { bytes: now.b, lines: now.l } : null                             ,
				whitespaceBytes : change === "horizontal-whitespace" && old && now ? now.b - old.b : null ,
			};
	});
	const sum = (side: "before" | "after", field: "bytes" | "lines"): number | null => {
		if (changes.some(file => file[side] === null && !(side === "before" && file.change === "added") && !(side === "after" && file.change === "deleted"))) return null;
		return changes.reduce((total, file) => total + (file[side]?.[field] ?? 0), 0);
	};
	const whitespaceBytes = changes.reduce((total, file) => total + (file.whitespaceBytes ?? 0), 0);
	return {
		available : true    ,
		files     : changes ,
		totals    : {
			beforeBytes : sum("before", "bytes") ,
			afterBytes  : sum("after", "bytes")  ,
			beforeLines : sum("before", "lines") ,
			afterLines  : sum("after", "lines")  ,
			whitespaceBytes,
			whitespaceTokensEstimated : Math.ceil(Math.max(0, whitespaceBytes) / 4)              ,
			contentChangedFiles       : changes.filter(file => file.change === "content").length ,
			unknownFiles              : changes.filter(file => file.change === "unknown").length ,
		},
	};
}
