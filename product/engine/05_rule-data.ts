import { fileURLToPath } from "node:url";

/** Source and bundled engines keep their rule data next to the engine directory. */
export function ruleData(path: string): string {
	return fileURLToPath(new URL(`../rules/${path}`, import.meta.url));
}
