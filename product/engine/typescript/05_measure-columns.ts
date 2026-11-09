#!/usr/bin/env bun
import      { readFileSync, statSync        } from "node:fs"                             ;
import      { resolve                       } from "node:path"                           ;
import      {
              measurement                 ,
              measurementArguments        ,
              reportMeasurement           ,
              UnsupportedMeasurementError
                                            } from "@/common/07_column-measurement.ts"   ;
import      { measureTypeScriptGroups       } from "@/typescript/12_align.ts"            ;
import      {
              loadSourceFile              ,
              repositoryFile              ,
              syntacticDiagnostics
                                            } from "@/typescript/15_load-source-file.ts" ;

let file   = ""                                       ;
const json = process.argv.slice(2).includes("--json") ;
try {
	({ file } = measurementArguments(process.argv.slice(2)));
	if (!/\.[cm]?[jt]sx?$/u.test(file)) throw new UnsupportedMeasurementError("unsupported TypeScript file extension");
	const root     = process.cwd()                       ;
	const absolute = repositoryFile(root, file).absolute ;
	const identity = statSync(absolute)                  ;
	const before   = readFileSync(absolute)              ;
	const text     = before.toString("utf8")             ;
	if (!Buffer.from(text, "utf8").equals(before)) throw new Error("source is not valid UTF-8");
	const { source, relative } = await loadSourceFile(root, file);
	if (source.text !== text || (await syntacticDiagnostics(root, absolute, text)).length) throw new Error("source is invalid or changed during parsing");
	const groups = measureTypeScriptGroups(source  ) ;
	const after  = statSync               (absolute) ;
	if (after.dev !== identity.dev || after.ino !== identity.ino || after.mtimeMs !== identity.mtimeMs || after.ctimeMs !== identity.ctimeMs || !readFileSync(resolve(root, file)).equals(before)) throw new Error("source changed during measurement");
	process.exitCode = reportMeasurement(measurement(relative, "typescript", groups), json);
} catch (error) {
	const result = measurement(file, "typescript", [], error instanceof Error ? error.message : String(error));
	process.exitCode = reportMeasurement(error instanceof UnsupportedMeasurementError ? { ...result, state: "UNMEASURABLE" } : result, json);
}
