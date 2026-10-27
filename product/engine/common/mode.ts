import      { createHash                                       } from "node:crypto"                ;
import      { existsSync, mkdirSync, readFileSync, renameSync } from "node:fs"                    ;
import      { writeFileSync                                    } from "node:fs"                    ;
import      { dirname, join, resolve                           } from "node:path"                  ;
import      { userDataRoot                                     } from "@/common/project-config.ts" ;

/**
 * What the plugin hooks do in a project. Only `align` lets a hook write, and only engine-approved horizontal whitespace;
 * `refactor` is an agent workflow, so the hooks still only guide and report.
 */
export const MODES = ["off", "check", "align", "refactor"] as const;
export type  Mode  = typeof MODES[number];

export const DEFAULT_MODE: Mode = "check";

interface ModeState {
	readonly default  : Mode                   ;
	readonly projects : Record<string, Mode>   ;
}

export const isMode = (value: unknown): value is Mode => typeof value === "string" && (MODES as readonly string[]).includes(value);

/** State lives in the user config folder, not plugin data: the status line runs without the host's plugin environment. */
export function stateDirectory(): string {
	return join(userDataRoot(), "state");
}

export function projectKey(root: string): string {
	return createHash("sha256").update(resolve(root)).digest("hex").slice(0, 16);
}

const modePath = (): string => join(stateDirectory(), "mode.json");

function readState(): ModeState {
	const path = modePath();
	if (!existsSync(path)) return { default: DEFAULT_MODE, projects: {} };
	try {
		const value    = JSON.parse(readFileSync(path, "utf8"))                                                       ;
		const projects = Object.fromEntries(Object.entries(value.projects ?? {}).filter(([, mode]) => isMode(mode))) ;
		return { default: isMode(value.default) ? value.default : DEFAULT_MODE, projects: projects as Record<string, Mode> };
	} catch {
		return { default: DEFAULT_MODE, projects: {} };
	}
}

/** Writes through a temporary file so a concurrent reader never sees half a document. */
export function writeTextAtomically(path: string, text: string): void {
	mkdirSync(dirname(path), { recursive: true });
	const temporary = `${path}.${process.pid}.tmp`;
	writeFileSync(temporary, text);
	renameSync(temporary, path);
}

export const writeJsonAtomically = (path: string, value: unknown): void => writeTextAtomically(path, `${JSON.stringify(value, null, "\t")}\n`);

/** The project setting wins over the global default; `BOXBOX_MODE` overrides both for one process. */
export function resolveMode(root: string | undefined): Mode {
	const forced = process.env.BOXBOX_MODE;
	if (isMode(forced)) return forced;
	const state = readState();
	return (root ? state.projects[projectKey(root)] : undefined) ?? state.default;
}

export function setMode(mode: Mode, root: string | undefined): void {
	const state = readState();
	const next  = root
		? { ...state, projects: { ...state.projects, [projectKey(root)]: mode } }
		: { ...state, default: mode };
	writeJsonAtomically(modePath(), next);
}

/** `boxbox mode [off|check|align|refactor] [--global] [--json]`: prints or changes the mode of the current project. */
export function runMode(args: readonly string[], root: string): number {
	const json   = args.includes("--json")                                ;
	const global = args.includes("--global")                              ;
	const rest   = args.filter(value => value !== "--json" && value !== "--global") ;
	if (rest.length > 1 || (rest[0] !== undefined && !isMode(rest[0]))) throw new Error(`Expected mode ${MODES.join("|")} [--global] [--json]`);
	const before = resolveMode(root);
	if (rest[0] !== undefined) setMode(rest[0] as Mode, global ? undefined : root);
	const after  = resolveMode(root);
	if (json) console.log(JSON.stringify({ schemaVersion: 1, tool: "boxbox", command: "mode", ok: true, mode: after, previous: before, scope: global ? "global" : "project" }));
	else console.log(rest[0] === undefined ? `boxbox mode: ${after}` : `boxbox mode: ${before} -> ${after}${global ? " (global default)" : ""}`);
	return 0;
}
