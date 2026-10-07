import      { fileURLToPath      } from "node:url"              ;

import      { runAlignCli        } from "./common/align-cli.ts" ;
import      { PYTHON_ALIGNER     } from "./python/profile.ts"   ;
import      { runTypeScriptAlign } from "./typescript/align.ts" ;

export async function runInternal(args: readonly string[]): Promise<number> {
	const [language, ...alignArgs] = args;
	if (language === "python") {
		const result = runAlignCli(PYTHON_ALIGNER, alignArgs);
		console.log(result.report);
		return result.code;
	}
	if (language === "typescript") return runTypeScriptAlign(alignArgs);
	console.error("usage: internal-runner.js <typescript|python> --file <target file> [--write] [--min-rows 3] [--explain <line>] [--json]");
	return 2;
}

function isMain(moduleUrl: string): boolean {
	const entry = process.argv[1];
	return entry !== undefined && fileURLToPath(moduleUrl) === entry;
}

if (isMain(import.meta.url)) process.exitCode = await runInternal(process.argv.slice(2));
