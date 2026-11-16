import      { createHash                                         } from "node:crypto"       ;
import type { Hash                                               } from "node:crypto"       ;
import      { lstatSync, readFileSync, readdirSync, realpathSync } from "node:fs"           ;
import      { createRequire                                      } from "node:module"       ;
import      { dirname, extname, join, resolve                    } from "node:path"         ;
import      { fileURLToPath                                      } from "node:url"          ;

import      { ruleData                                           } from "@/05_rule-data.ts" ;

/** Explicit inputs also permit isolated identity tests without substituting the live runtime. */
export interface InspectionIdentityInputs {
	readonly engineModule      : string                                       ;
	readonly rules             : string                                       ;
	readonly typescript        : string                                       ;
	readonly parserExecutable  : string                                       ;
	readonly runtimeExecutable : string                                       ;
	readonly environment       : Readonly<Record<string, string | undefined>> ;
	readonly runtime           : Readonly<Record<string, string>>             ;
	/** Required for source execution; bundled YAML code is already part of the engine bundle. */
	readonly yaml?: string;
}

interface Budget {
	entries: number;
	bytes: number;
}

const MAX_ENTRIES = 10_000            ;
const MAX_BYTES   = 512 * 1024 * 1024 ;

function stableStamp(path: string): string {
	const status = lstatSync(path, { bigint: true });
	return [status.dev, status.ino, status.mode, status.size, status.mtimeNs, status.ctimeNs].join(":");
}

/** Root package links resolve intentionally; links within a tree make its dependency boundary unknown. */
function hashPath(hash: Hash, input: string, budget: Budget): void {
	const physical = realpathSync(input);
	hash.update(JSON.stringify([input, physical]));
	const visit = (path: string, depth: number): void => {
		budget.entries += 1;
		if (budget.entries > MAX_ENTRIES || depth > 32) throw new Error("inspection identity traversal limit");
		const before = stableStamp(path) ;
		const status = lstatSync  (path) ;
		if (status.isSymbolicLink()) throw new Error("inspection identity contains an internal link");
		hash.update(JSON.stringify([path, status.mode]));
		if (status.isDirectory()) {
			const names = readdirSync(path).sort();
			hash.update(JSON.stringify(names));
			for (const name of names) visit(join(path, name), depth + 1);
		} else if (status.isFile()) {
			budget.bytes += status.size;
			if (budget.bytes > MAX_BYTES) throw new Error("inspection identity byte limit");
			const bytes = readFileSync(path);
			if (bytes.length !== status.size) throw new Error("inspection identity changed while reading");
			hash.update(JSON.stringify([bytes.length]));
			hash.update(bytes);
		} else throw new Error("inspection identity requires regular files");
		if (stableStamp(path) !== before) throw new Error("inspection identity changed while reading");
	};
	visit(physical, 0);
	if (realpathSync(input) !== physical) throw new Error("inspection identity link changed");
}

function runtimeInputs(): InspectionIdentityInputs {
	const engineModule       = fileURLToPath(import.meta.url)                                                              ;
	const require            = createRequire(import.meta.url)                                                              ;
	const typescriptManifest = require.resolve("typescript/package.json")                                                  ;
	const packageRequire     = createRequire(typescriptManifest)                                                           ;
	const resolver           = packageRequire(packageRequire.resolve("#getExePath")) as { readonly default: () => string } ;
	return {
		engineModule      : engineModule                                                            ,
		rules             : ruleData("")                                                            ,
		typescript        : dirname(typescriptManifest)                                             ,
		parserExecutable  : resolver.default()                                                      ,
		runtimeExecutable : process.execPath                                                        ,
		environment       : process.env                                                             ,
		runtime           : { ...process.versions, platform: process.platform, arch: process.arch } ,
		...(extname(engineModule) === ".ts" ? { yaml: dirname(require.resolve("yaml/package.json")) } : {}),
	};
}

/** Fresh byte identity; unknown inputs disable reuse. No version or metadata-only hash cache is retained. */
export function inspectionRuntimeIdentity(given?: InspectionIdentityInputs): string | null {
	try {
		const inputs    = given ?? runtimeInputs()     ;
		if (!lstatSync(inputs.engineModule).isFile())               return null;
		const extension = extname(inputs.engineModule) ;
		const source    = extension === ".ts"          ;
		if (!source && extension !== ".js" && extension !== ".mjs") return null;
		if (source && !inputs.yaml)                                 return null;
		const hash           = createHash("sha256")     ;
		const budget: Budget = { entries: 0, bytes: 0 } ;
		hash.update("boxbox-inspection-runtime-v1\0");
		hash.update(JSON.stringify(Object.entries(inputs.environment).filter(([, value]) => value !== undefined).sort(([left], [right]) => left < right ? -1 : left > right ? 1 : 0)));
		hash.update(JSON.stringify(Object.entries(inputs.runtime).sort(([left], [right]) => left < right ? -1 : left > right ? 1 : 0)));
		const engine = source ? resolve(dirname(inputs.engineModule), "..") : inputs.engineModule;
		for (const path of [engine, inputs.rules, inputs.typescript, inputs.parserExecutable, inputs.runtimeExecutable]) hashPath(hash, path, budget);
		if (source) hashPath(hash, inputs.yaml!, budget);
		return `sha256:${hash.digest("hex")}`;
	} catch { return null; }
}
