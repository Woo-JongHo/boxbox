import      { randomUUID      } from "node:crypto"        ;
import      { spawnSync       } from "node:child_process" ;
import      {
              existsSync    ,
              lstatSync     ,
              mkdirSync     ,
              readFileSync  ,
              renameSync    ,
              rmSync        ,
              writeFileSync ,
                              } from "node:fs"            ;
import      { join            } from "node:path"          ;

type LockOwner = { pid: number; processStartedAt: string; token: string };

const initializationGraceMs = 2_000                                    ;
const waitCell              = new Int32Array(new SharedArrayBuffer(4)) ;

export function processStartedAt(pid: number): string | null {
	if (!Number.isSafeInteger(pid) || pid <= 0) return null;
	const windows = `(Get-Process -Id ${pid} -ErrorAction Stop).StartTime.ToUniversalTime().Ticks`;
	const result = process.platform === "win32"
		? spawnSync("powershell.exe", ["-NoProfile", "-NonInteractive", "-Command", windows], { encoding: "utf8", timeout: 1_000 })
		: spawnSync("ps", ["-o", "lstart=", "-p", String(pid)], { encoding: "utf8", timeout: 1_000 });
	if (result.error || result.status !== 0) return null;
	return result.stdout.trim() || null;
}

function ownerOf(path: string): LockOwner | null {
	try {
		const owner = JSON.parse(readFileSync(join(path, "owner.json"), "utf8"));
		if (
			!Number.isSafeInteger(owner.pid)
			|| owner.pid <= 0
			|| typeof owner.processStartedAt !== "string"
			|| typeof owner.token !== "string"
		)
			return null;
		return owner;
	} catch { return null; }
}

function ownerIsAlive(owner: LockOwner | null): boolean {
	return !!owner && processStartedAt(owner.pid) === owner.processStartedAt;
}

function pause(milliseconds: number): void {
	Atomics.wait(waitCell, 0, 0, milliseconds);
}

export function acquireProcessLock(directory: string, name: string, waitMilliseconds = 0): (() => void) | null {
	if (existsSync(directory) && (!lstatSync(directory).isDirectory() || lstatSync(directory).isSymbolicLink())) throw new Error("Unsafe lock directory");
	mkdirSync(directory, { recursive: true, mode: 0o700 });
	const path     = join(directory, `${name}.lock`) ;
	const deadline = Date.now() + waitMilliseconds   ;
	for (;;) {
		const token = randomUUID();
		try {
			mkdirSync(path, { mode: 0o700 });
			const processStart = processStartedAt(process.pid);
			if (!processStart) { rmSync(path, { recursive: true, force: true }); throw new Error("Cannot identify lock owner process"); }
			const owner: LockOwner = { pid: process.pid, processStartedAt: processStart, token } ;
			const temporary        = join(path, `owner.${token}.tmp`)                            ;
			writeFileSync(temporary, JSON.stringify(owner), { flag: "wx", mode: 0o600 });
			renameSync(temporary, join(path, "owner.json"));
			let held = true;
			return () => {
				if (!held) return;
				held = false;
				if (ownerOf(path)?.token === token) rmSync(path, { recursive: true, force: true });
			};
		} catch (error: any) {
			if (error?.code !== "EEXIST") throw error;
			const entry = lstatSync(path);
			if (!entry.isDirectory() || entry.isSymbolicLink()) throw new Error("Unsafe process lock");
			const owner        = ownerOf(path)                                      ;
			const initializing = Date.now() - entry.mtimeMs < initializationGraceMs ;
			if (!ownerIsAlive(owner) && !initializing) {
				const quarantine = `${path}.stale.${process.pid}.${token}`;
				try {
					renameSync(path, quarantine);
					if (ownerIsAlive(ownerOf(quarantine))) {
						if (!existsSync(path)) renameSync(quarantine, path);
					} else rmSync(quarantine, { recursive: true, force: true });
					continue;
				} catch (staleError: any) {
					if (staleError?.code !== "ENOENT") throw staleError;
					continue;
				}
			}
			if (Date.now() >= deadline) return null;
			pause(Math.min(50, Math.max(1, deadline - Date.now())));
		}
	}
}
