#!/usr/bin/env bun
/**
 * Example check (M1.8 S5b). For each approved example, writes the before/after code to temporary files, runs the check report and verifies the meaning of its verdict.
 *   after-better / before-better / preferred-variant : has/lacks alarms in asserts.before·after; with fixedPoint, no pending alignment
 *   bad   : the engine's fix of before never becomes after
 *   taste : not checked (recorded only)
 * For decision records, checks that the hash of the referenced document section matches the current document (re-approval is needed if not).
 *
 * Usage: bun scripts/examples-check.ts
 */
import      { spawnSync          } from "node:child_process"   ;
import      {
              existsSync       ,
              mkdtempSync      ,
              readFileSync     ,
              writeFileSync    ,
                                 } from "node:fs"              ;
import      { tmpdir             } from "node:os"              ;
import      { join               } from "node:path"            ;
import      {
              parseRecords     ,
              sectionHash      ,
              validateDecision ,
              validateExample  ,
              type AlarmAssert ,
              type Decision    ,
              type Example     ,
                                 } from "@/common/examples.ts" ;

const ROOT      = join(import.meta.dir, "..")                                  ;
const PRESET    = join(ROOT, "skills", "xxx", "presets", "recommended")        ;
const EXTENSION = { typescript: "ts", python: "py" } as Record<string, string> ;

interface ReportJson {
	readonly alarms : readonly { readonly id: string }[] ;
	readonly states : Readonly<Record<string, number>>   ;
}

function reportOf(dir: string, file: string): ReportJson {
	const run = spawnSync(process.execPath, [join(ROOT, "skills/xxx/scripts/report.ts"), "--file", file, "--json"], { cwd: dir, encoding: "utf8" });

	return JSON.parse(run.stdout) as ReportJson;
}

function assertAlarms(report: ReportJson, expect: AlarmAssert | undefined, side: string): readonly string[] {
	if (!expect) return [];

	const ids      = new Set(report.alarms.map(alarm => alarm.id))                                   ;
	const failures = [
		...(expect.has   ?? []).filter(id => !ids.has(id)).map(id => `${side}: ${id} expected`),
		...(expect.lacks ?? []).filter(id => ids.has(id)).map(id => `${side}: ${id} must be absent`),
	];
	if (expect.fixedPoint && (report.states["FIXABLE"] ?? 0) > 0) failures.push(`${side}: not a fixed point (${report.states["FIXABLE"]} tables pending)`);

	return failures;
}

/** Checks one example and returns the list of failure reasons. Empty means pass. */
export function checkExample(example: Example): readonly string[] {
	if (example.verdict === "taste" || example.status !== "approved") return [];

	const extension = EXTENSION[example.language];
	if (!extension) return [`unsupported language ${example.language}`];

	const dir = mkdtempSync(join(tmpdir(), "xxx-example-"));
	writeFileSync(join(dir, `before.${extension}`), example.before);
	writeFileSync(join(dir, `after.${extension}` ), example.after );

	if (example.verdict === "bad") {
		spawnSync(process.execPath, [join(ROOT, `skills/xxx/scripts/${example.language}/06_align-tables.ts`), "--file", `before.${extension}`, "--write"], { cwd: dir, encoding: "utf8" });

		return readFileSync(join(dir, `before.${extension}`), "utf8") === example.after ? ["bad: the engine produced the forbidden shape"] : [];
	}

	return [
		...assertAlarms(reportOf(dir, `before.${extension}`), example.asserts.before, "before"),
		...assertAlarms(reportOf(dir, `after.${extension}` ), example.asserts.after , "after" ),
	];
}

/** Checks the document hash of one decision. */
export function checkDecision(decision: Decision): readonly string[] {
	const [path, heading] = decision.ref.split("#") as [string, string];
	const file            = join(ROOT, path);
	if (!existsSync(file)) return [`${decision.id}: missing document ${path}`];

	return sectionHash(readFileSync(file, "utf8"), heading) === decision.docHash ? [] : [`${decision.id}: ${decision.ref} changed — re-approve`];
}

export function loadPreset(): { readonly examples: readonly Example[]; readonly decisions: readonly Decision[] } {
	const read = (name: string): string => existsSync(join(PRESET, name)) ? readFileSync(join(PRESET, name), "utf8") : "";

	return {
		examples  : parseRecords(read("examples.jsonl" ), "examples.jsonl" , validateExample ),
		decisions : parseRecords(read("decisions.jsonl"), "decisions.jsonl", validateDecision),
	};
}

function main(): void {
	const { examples, decisions } = loadPreset();
	const failures = [...examples.flatMap(example => checkExample(example).map(reason => `${example.id} ${reason}`)), ...decisions.flatMap(checkDecision)];

	console.log(`examples-check examples=${examples.length} decisions=${decisions.length} failures=${failures.length}`);
	for (const failure of failures) console.log(`  ${failure}`);
	process.exit(failures.length === 0 ? 0 : 1);
}

if (import.meta.main) main();
