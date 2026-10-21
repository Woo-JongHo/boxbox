#!/usr/bin/env bun
import { errorMessage, runTypeScriptAlign } from "@/typescript/align.ts";

export * from "@/typescript/align.ts";

if (import.meta.main) try {
	process.exit(await runTypeScriptAlign(process.argv.slice(2)));
} catch (error) {
	console.error(errorMessage(error));
	process.exit(1);
}
