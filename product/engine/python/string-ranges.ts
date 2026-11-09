/** Python formatted-string ranges share the source analyzer's tokenizer. */
import      { analyzePython  } from "@/python/analysis.ts"  ;
import type { ProtectedRange } from "@/common/code-text.ts" ;

export { PythonSourceSyntaxError } from "@/python/analysis.ts";

/** Ordinary files retain the low-level masking fast path. */
export function pythonStringRanges(source: string, timeoutMs = 60_000): readonly ProtectedRange[] {
	if (!/(?<![\p{ID_Continue}])(?:[ft]r?|r[ft])["']/iu.test(source)) return [];
	return analyzePython(source, timeoutMs).formatted;
}
