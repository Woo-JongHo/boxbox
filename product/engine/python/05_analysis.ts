import      { spawnSync               } from "node:child_process"             ;
import      { PYTHON_ANALYSIS_SCRIPT  } from "@/python/06_analysis-script.ts" ;
import      { PythonSourceSyntaxError } from "@/python/07_string-ranges.ts"   ;

/** Existing row categories recognized from actual Python containers. */
export type PythonRowKind = "statement" | "parameter" | "keyword" | "dictionary" | "bundle";
/** Physical source row tied to an internal owner. */
export interface PythonRow {
	/** Zero-based physical line. */
	readonly line: number;
	/** Internal AST container identity. */
	readonly owner: number;
	/** Row's existing grammar category. */
	readonly kind: PythonRowKind;
	/** Start offset in original UTF-16 source. */
	readonly start: number;
	/** Exclusive end offset in original UTF-16 source. */
	readonly end: number;
}
/** Original-source UTF-16 token interval. */
export interface PythonToken {
	/** CPython token type. */
	readonly type: number;
	/** Start offset in original UTF-16 source. */
	readonly start: number;
	/** Exclusive end offset in original UTF-16 source. */
	readonly end: number;
}
/** Document-local AST, token and preservation evidence. */
export interface PythonAnalysis {
	/** Source-confirmed candidate row owners. */
	readonly rows: PythonRow[];
	/** Token ranges sliced from the unmodified source. */
	readonly tokens: PythonToken[];
	/** Whole formatted strings, including nested replacement fields. */
	readonly formatted: { start: number; end: number }[];
	/** Return line indexes whose proposed edits fail original-token preservation. */
	unsafeEditLines(edits: readonly { index: number; after: string }[]): number[];
}
const KINDS   = new Set(["statement", "parameter", "keyword", "dictionary", "bundle"])                     ;
const integer = (value: unknown): value is number => Number.isSafeInteger(value) && (value as number) >= 0 ;
function range(a: unknown, b: unknown, length: number): a is number { return integer(a) && integer(b) && a < b && b <= length; }
function fail(): never { throw new Error("Python source analysis returned an invalid response"); }

/** Parse and tokenize one source; syntax and tool faults are distinct. */
export function analyzePython(source: string, timeoutMs = 60_000): PythonAnalysis {
	if (source.startsWith("\uFEFF") || /\r(?!\n)/u.test(source) || /[\uD800-\uDBFF](?![\uDC00-\uDFFF])|(?<![\uD800-\uDBFF])[\uDC00-\uDFFF]/u.test(source)) throw new Error("Unsupported Python source encoding or line endings");
	if (!Number.isInteger(timeoutMs) || timeoutMs < 1 || timeoutMs > 60_000) throw new Error("Invalid Python analysis timeout");
	const child = spawnSync("python3", ["-I", "-c", PYTHON_ANALYSIS_SCRIPT], { input: source, encoding: "utf8", timeout: timeoutMs, maxBuffer: 16 * 1024 * 1024 });
	if (child.error || child.signal || child.status !== 0 || child.stderr) throw new Error(`Python source analysis failed: ${child.error?.message ?? child.stderr ?? child.signal ?? child.status}`);
	let value: any;
	try { value = JSON.parse(child.stdout); } catch { fail(); }
	if (!value || typeof value !== "object" || value.version !== 1) fail();
	if (value.status === "syntax-invalid") throw new PythonSourceSyntaxError("Python source is invalid");
	if (value.status !== "ok" || value.sourceLength !== source.length || !Array.isArray(value.pythonVersion) || value.pythonVersion.length !== 3 || !value.pythonVersion.every(integer) || value.pythonVersion[0] !== 3 || !Array.isArray(value.owners) || !Array.isArray(value.rows) || !Array.isArray(value.tokens) || !Array.isArray(value.formatted)) fail();
	const owners = value.owners.map((o: unknown, index: number) => {
		if (!Array.isArray(o) || o.length !== 4 || o[0] !== index || typeof o[1] !== "string" || typeof o[2] !== "string" || !KINDS.has(o[3])) fail();
		const allowed = o[3] === "statement" ? ["Module", "FunctionDef", "AsyncFunctionDef", "ClassDef", "If", "For", "AsyncFor", "While", "With", "AsyncWith", "Try", "TryStar", "ExceptHandler", "match_case"].includes(o[1]) && ["body", "orelse", "finalbody"].includes(o[2])
			: o[3] === "bundle" ? ["List", "Tuple"].includes(o[1]) && o[2] === "elts"
			: o[3] === "keyword" ? o[1] === "Call" && o[2] === "keywords"
			: o[3] === "parameter" ? o[1] === "arguments" && o[2] === "parameters"
			: o[1] === "Dict" && o[2] === "entries";
		if (!allowed) fail();
		return o;
	});
	const lines             = source.split("\n") ;
	const offsets: number[] = []                 ;
	let off                 = 0                  ;
	for (const line of lines) { offsets.push(off); off += line.length + 1; }
	const rows: PythonRow[] = value.rows.map((r: unknown) => {
		if (!Array.isArray(r) || r.length !== 5 || !integer(r[0]) || r[0] >= lines.length || !integer(r[1]) || r[1] >= owners.length || !KINDS.has(r[2]) || owners[r[1]]![3] !== r[2] || !range(r[3], r[4], source.length)) fail();
		if (r[3] < offsets[r[0]]! || r[4] > offsets[r[0]]! + lines[r[0]]!.replace(/\r$/u, "").length) fail();
		return { line: r[0], owner: r[1], kind: r[2], start: r[3], end: r[4] };
	});
	let prev = 0;
	const tokens: PythonToken[] = value.tokens.map((t: unknown) => {
		if (!Array.isArray(t) || t.length !== 3 || !integer(t[0]) || !range(t[1], t[2], source.length) || t[1] < prev) fail();
		prev = t[2]; return { type: t[0], start: t[1], end: t[2] };
	});
	prev = 0;
	const formatted: { start: number; end: number }[] = value.formatted.map((r: unknown) => {
		if (!Array.isArray(r) || r.length !== 2 || !range(r[0], r[1], source.length) || r[0] < prev) fail();
		prev = r[1]; return { start: r[0], end: r[1] };
	});
	// Both validated sequences are sorted and non-overlapping. Coalesce each outer formatted
	// range into one original-source slice and reject any token crossing its boundary.
	const segments: PythonToken[] = [] ;
	let formatIndex               = 0  ;
	for (const token of tokens) {
		while (formatIndex < formatted.length && formatted[formatIndex]!.end <= token.start) {
			segments.push({ ...formatted[formatIndex++]!, type: -1 });
		}
		const outer = formatted[formatIndex];
		if (outer && token.start < outer.end && token.end > outer.start) {
			if (token.start < outer.start || token.end > outer.end) fail();
		} else segments.push(token);
	}
	while (formatIndex < formatted.length) segments.push({ ...formatted[formatIndex++]!, type: -1 });
	return { rows, tokens, formatted, unsafeEditLines: edits => edits.filter(e => !safeEdit(source, lines, offsets, segments, e.index, e.after)).map(e => e.index) };
}

/** Conservative whitespace gap test; all spelling comes from original source slices. */
function safeEdit(source: string, lines: string[], offsets: number[], segments: readonly PythonToken[], index: number, after: string): boolean {
	if (!integer(index) || index >= lines.length || /\r(?!$)|\n/u.test(after)) return false;
	const before = lines[index]!, start = offsets[index]!, end = start + before.length;
	if ((before.endsWith("\r")) !== after.endsWith("\r")                                    ) return false;
	if ((before.match(/^[ \t]*/u)?.[0] ?? "") !== (after.match(/^[ \t]*/u)?.[0] ?? "")      ) return false;
	if ((before.match(/[ \t]*\r?$/u)?.[0] ?? "") !== (after.match(/[ \t]*\r?$/u)?.[0] ?? "")) return false;
	// Find the first segment whose end is after this physical line's start.
	let low = 0, high = segments.length;
	while (low < high) {
		const middle = Math.floor((low + high) / 2);
		if (segments[middle]!.end <= start) low = middle + 1;
		else high = middle;
	}
	const intersect: PythonToken[] = [];
	for (let i = low; i < segments.length && segments[i]!.start < end; i += 1) intersect.push(segments[i]!);
	if (intersect.some(t => t.start < start || t.end > end) || intersect.length === 0) return false;
	let cursor = 0, old = 0, previous = "";
	for (const t of intersect) {
		const a = t.start - start, b = t.end - start, gap = before.slice(old, a), text = source.slice(t.start, t.end);
		if (!/^[ \t]*$/u.test(gap)) return false;
		const match = /^[ \t]*/u.exec(after.slice(cursor))!;
		const nextGap = match[0]; cursor += nextGap.length;
		if (old === 0 && gap !== nextGap                                                             ) return false;
		if (gap.length && !nextGap.length && !/^[,:\]\)}]$/u.test(text) && !/^[([{]$/u.test(previous)) return false;
		if (!after.startsWith(text, cursor)                                                          ) return false;
		cursor += text.length; old = b; previous = text;
	}
	return before.slice(old) === after.slice(cursor);
}
