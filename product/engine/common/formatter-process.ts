import      { spawn                                         } from "node:child_process"         ;
import      { createHash                                    } from "node:crypto"                ;
import      { constants, realpathSync, statSync             } from "node:fs"                    ;
import      { delimiter, extname, isAbsolute, join, resolve } from "node:path"                  ;

import type { FormatterConfig                               } from "@/common/project-config.ts" ;

const OUTPUT_LIMIT = 64 * 1024;

export interface PipelineProcessResult {
	readonly exitCode  : number | null ;
	readonly signal    : string | null ;
	readonly timedOut  : boolean       ;
	readonly stdout    : string        ;
	readonly stderr    : string        ;
	readonly truncated : boolean       ;
}

export interface ExecutableIdentity {
	readonly path        : string ;
	readonly fingerprint : string ;
}

function identityOf(file: string): readonly unknown[] {
	const physical = realpathSync(file    ) ;
	const status   = statSync    (physical) ;
	if (!status.isFile() || (process.platform !== "win32" && (status.mode & constants.S_IXUSR) === 0)) throw new Error("not an executable file");

	return [physical, status.dev, status.ino, status.mode, status.size, status.mtimeMs, status.ctimeMs];
}

function nodeScript(file: string): boolean {
	return process.platform === "win32" && /\.(?:cjs|mjs|js)$/iu.test(file);
}

function candidatesOf(command: string, root: string): readonly string[] {
	const locations = command.includes("/") || command.includes("\\")
		? [resolve(root, command)]
		: (process.env.PATH ?? "").split(delimiter).filter(Boolean).map(directory => resolve(root, directory, command));
	if (process.platform !== "win32" || extname(command) !== "") return locations;

	const extensions = (process.env.PATHEXT ?? ".COM;.EXE;.BAT;.CMD").split(";").filter(extension => /^\.[a-z0-9]+$/iu.test(extension));

	return locations.flatMap(location => extensions.map(extension => location + extension));
}

/** Resolve once before spawning, then resolve again after the formatter to detect command replacement. */
export function resolveFormatterExecutable(command: string, root: string): ExecutableIdentity {
	for (const candidate of candidatesOf(command, root)) {
		let identity: readonly unknown[];
		try { identity = identityOf(candidate); } catch { continue; }

		const physical = identity[0] as string;
		if (process.platform === "win32" && /\.(?:cmd|bat)$/iu.test(physical)) throw new Error("Windows batch formatter commands are unsupported; configure node.exe with the formatter's JavaScript entry and {file} as separate args, or use a native .exe formatter");
		if (process.platform === "win32" && !/\.(?:exe|com|cjs|mjs|js)$/iu.test(physical)) throw new Error("Windows formatter commands must be native .exe/.com files or Node .js/.mjs/.cjs entries");

		const runtime     = nodeScript(physical) ? identityOf(process.execPath) : []                       ;
		const fingerprint = createHash("sha256").update(JSON.stringify([identity, runtime])).digest("hex") ;

		return { path: physical, fingerprint };
	}

	throw new Error(`formatter executable not found: ${command}`);
}

function appendBounded(current: Buffer[], size: number, chunk: Buffer): { readonly size: number; readonly truncated: boolean } {
	const remaining = Math.max(0, OUTPUT_LIMIT - size);
	if (remaining > 0) current.push(chunk.subarray(0, remaining));

	return { size: size + Math.min(chunk.length, remaining), truncated: chunk.length > remaining };
}

function taskkillExecutable(): string {
	const systemRoot = process.env.SystemRoot;
	if (!systemRoot || !isAbsolute(systemRoot)) throw new Error("Windows formatter timeout protection requires an absolute SystemRoot");

	const executable = realpathSync(join(systemRoot, "System32", "taskkill.exe"));
	if (!statSync(executable).isFile()) throw new Error("Windows formatter timeout protection requires System32/taskkill.exe");

	return executable;
}

/** Await taskkill itself as well as the formatter's close event before reporting timeout completion. */
async function terminateWindowsTree(executable: string, pid: number): Promise<void> {
	await new Promise<void>((accept, reject) => {
		const killer = spawn(executable, ["/PID", String(pid), "/T", "/F"], { shell: false, windowsHide: true, stdio: "ignore" }) ;
		let expired  = false                                                                                                      ;

		const timeout = setTimeout(() => { expired = true; killer.kill(); }, 5_000);

		killer.once("error", error => { clearTimeout(timeout); reject(error); });
		killer.once("close", code => {
			clearTimeout(timeout);
			if (expired || code !== 0) reject(new Error(`Windows formatter process tree cleanup failed${expired ? ": taskkill timed out" : `: taskkill exited ${String(code)}`}`));
			else accept();
		});
	});
}

export async function runFormatterProcess(executable: string, config: FormatterConfig, file: string, root: string): Promise<PipelineProcessResult> {
	const windows = process.platform === "win32"                                         ;
	const killer  = windows ? taskkillExecutable() : undefined                           ;
	const args    = config.args.map(argument => argument === "{file}" ? file : argument) ;
	const script  = nodeScript(executable)                                               ;

	return new Promise((accept, reject) => {
		const child = spawn(script ? process.execPath : executable, script ? [executable, ...args] : args, {
			cwd: root, detached: !windows, shell: false, windowsHide: true, stdio: ["ignore", "pipe", "pipe"],
		});
		const stdout     : Buffer[] = []             ;
		const stderr     : Buffer[] = []             ;
		let stdoutSize              = 0              ;
		let stderrSize              = 0              ;
		let truncated               = false          ;
		let timedOut                = false          ;
		let cleanup      : Promise<void> | undefined ;
		let cleanupError : unknown                   ;

		const timeout = setTimeout(() => {
			timedOut = true;
			if (child.pid === undefined) return;

			if (killer) {
				cleanup = terminateWindowsTree(killer, child.pid).catch(error => {
					cleanupError = error;
					child.kill();
					child.stdout.destroy();
					child.stderr.destroy();
				});
			} else {
				// One immediate group kill avoids a delayed signal against a subsequently reused PID.
				try { process.kill(-child.pid, "SIGKILL"); } catch (error) {
					if ((error as NodeJS.ErrnoException).code !== "ESRCH") {
						cleanupError = error;
						child.kill();
						child.stdout.destroy();
						child.stderr.destroy();
					}
				}
			}
		}, config.timeoutMs);

		child.stdout.on("data", (value: Buffer) => {
			const next = appendBounded(stdout, stdoutSize, value);
			stdoutSize = next.size;
			truncated ||= next.truncated;
		});
		child.stderr.on("data", (value: Buffer) => {
			const next = appendBounded(stderr, stderrSize, value);
			stderrSize = next.size;
			truncated ||= next.truncated;
		});
		child.once("error", error => { clearTimeout(timeout); reject(error); });
		child.once("close", async (exitCode, signal) => {
			clearTimeout(timeout);
			await cleanup;
			if (cleanupError) reject(cleanupError);
			else accept({ exitCode, signal, timedOut, stdout: Buffer.concat(stdout).toString("utf8"), stderr: Buffer.concat(stderr).toString("utf8"), truncated });
		});
	});
}
