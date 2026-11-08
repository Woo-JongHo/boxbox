#!/usr/bin/env bun
import      { readFileSync, realpathSync, statSync                } from "node:fs"                           ;
import      { relative, resolve                                   } from "node:path"                         ;
import      {
              measurement                                       ,
              measurementArguments                              ,
              reportMeasurement                                 ,
              UnsupportedMeasurementError
                                                                  } from "@/common/07_column-measurement.ts" ;
import type { MeasurementAxis, MeasurementGroup, MeasurementPoint } from "@/common/07_column-measurement.ts" ;
import      { alignSource                                         } from "@/common/06_table-engine.ts"       ;
import      { displayWidth                                        } from "@/common/01_display-width.ts"      ;
import      { PYTHON_ALIGNER                                      } from "@/python/03_profile.ts"            ;

let file   = ""                                       ;
const json = process.argv.slice(2).includes("--json") ;
try {
	({ file } = measurementArguments(process.argv.slice(2)));
	if (!file.endsWith(".py")) throw new UnsupportedMeasurementError("unsupported Python file extension");
	const root     = process.cwd()                                           ;
	const absolute = resolve    (root, file                                ) ;
	const path     = relative   (root, absolute                            ) ;
	const physical = relative   (realpathSync(root), realpathSync(absolute)) ;
	if (
	       !path
	    ||  path     === ".."
	    ||  path.startsWith("../")
	    || !physical
	    ||  physical === ".."
	    ||  physical.startsWith("../")
	    || !statSync(absolute).isFile()
	    || !path.endsWith(".py")
	) throw new Error("target must be a Python file inside the repository");
	const identity = statSync       (absolute) ;
	const before   = readFileSync   (absolute) ;
	const source   = before.toString("utf8"  ) ;
	if (!Buffer.from(source, "utf8").equals(before)) throw new Error("source is not valid UTF-8");
	const groups: MeasurementGroup[] = [];
	alignSource(source, PYTHON_ALIGNER, {
		minRows : 3     ,
		apply   : false ,
		observe : plans => {
			for (const plan of plans) {
				const axes = new Map<string, MeasurementPoint[]>() ;
				let reason = plan.reason                           ;
				for (const [index, row] of plan.rows.entries()) {
					let original  = row.profile.indent         ;
					let offset    = 0                          ;
					const aligned = plan.alignedCodes?.[index] ;
					for (const slot of row.profile.slots) {
						original += slot.gapBefore;
						const at = aligned?.indexOf(slot.text, offset) ?? -1;
						if (aligned !== undefined && at < 0) reason = "planner cell could not be located";
						const point: MeasurementPoint = {
							rowLine       : row.line                                            ,
							currentColumn : displayWidth(original)                              ,
							targetColumn  : at < 0 ? null : displayWidth(aligned!.slice(0, at)) ,
							anchor        : "physical"                                          ,
							editable      : true
						};

						const points = axes.get(slot.axis) ?? [];

						points.push(point);
						axes.set(slot.axis, points);
						original += slot.text;
						if (at >= 0) offset = at + slot.text.length;
					}
				}
				const axisList: MeasurementAxis[] = [...axes].map(([axis, points]) => ({ axis, points }));
				groups.push({
					kind     : "table"                                                            ,
					rowLines : plan.rows.map(row => row.line)                                     ,
					axes     : axisList                                                           ,
					state    : reason ? "UNMEASURABLE" : plan.edits.length ? "MISMATCH" : "MATCH" ,
					...(reason ? { reason } : {})
				});
			}
		}
	});
	const after = statSync(absolute);
	if (
	        after.dev     !== identity.dev
	    ||  after.ino     !== identity.ino
	    ||  after.mtimeMs !== identity.mtimeMs
	    ||  after.ctimeMs !== identity.ctimeMs
	    || !readFileSync(absolute).equals(before)
	) throw new Error("source changed during measurement");
	process.exitCode = reportMeasurement(measurement(path, "python", groups), json);
} catch (error) {
	const result = measurement(file, "python", [], error instanceof Error ? error.message : String(error));
	process.exitCode = reportMeasurement(error instanceof UnsupportedMeasurementError ? { ...result, state: "UNMEASURABLE" } : result, json);
}
