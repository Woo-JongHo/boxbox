import { createHash, randomUUID } from "node:crypto";
import { lstatSync, mkdirSync, renameSync, rmSync, writeFileSync } from "node:fs";
import { isAbsolute, join, resolve } from "node:path";

/** A locator is observation metadata, never proof that a host accepted hook output. */
export function recordHookLocation(runtime, input, data) {
	try {
		const root = input.cwd;
		if (typeof root !== "string" || !isAbsolute(root) || root !== resolve(root) || !input.session_id) return;
		if (typeof runtime.hudData !== "string" || !isAbsolute(runtime.hudData) || !isAbsolute(data)) return;
		const project = createHash("sha256").update(root).digest("hex").slice(0, 16);
		const sessionHash = createHash("sha256").update(String(input.session_id)).digest("hex");
		const directory = join(data, "hooks", project, sessionHash);
		if (!lstatSync(directory).isDirectory() || !lstatSync(join(directory, "baseline.json")).isFile()) return;
		mkdirSync(runtime.hudData, { recursive: true, mode: 0o700 });
		if (!lstatSync(runtime.hudData).isDirectory() || lstatSync(runtime.hudData).isSymbolicLink()) return;
		const temporary = join(runtime.hudData, `.${randomUUID()}.tmp`);
		try {
			writeFileSync(temporary, JSON.stringify({ schemaVersion: 1, root, sessionHash, directory, observedAt: new Date().toISOString() }) + "\n", { flag: "wx", mode: 0o600 });
			renameSync(temporary, join(runtime.hudData, `${project}.json`));
		} finally {
			rmSync(temporary, { force: true });
		}
	} catch {
		// An unavailable HUD must not change the host hook protocol or block a session.
	}
}
