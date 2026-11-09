import      { readFileSync   } from "node:fs"                      ;
import      {
              sessionUsage ,
              sessionLines ,
              formatUsage
                             } from "@/common/30_session-usage.ts" ;

export * from "@/common/30_session-usage.ts";

if (import.meta.main) {
	const path = process.argv.slice(2).find(argument => argument === "-" || !argument.startsWith("--"));
	if (!path) { console.error("Usage: bun development/tools/session-usage.ts <transcript.jsonl | -> [--json]"); process.exit(1); }
	const usage = sessionUsage(path === "-" ? readFileSync(0, "utf8").split("\n") : sessionLines(path));
	console.log(process.argv.includes("--json") ? JSON.stringify(usage, null, "\t") : formatUsage(usage));
}
