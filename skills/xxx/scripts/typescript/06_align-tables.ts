#!/usr/bin/env bun
import { errorMessage, runTypeScriptAlign } from "./align.ts";

export * from "./align.ts";

if (import.meta.main) try {
	process.exit(await runTypeScriptAlign(process.argv.slice(2)));
} catch (error) {
	console.error(errorMessage(error));
	process.exit(1);
}
