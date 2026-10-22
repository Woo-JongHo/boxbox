import { readFileSync } from "node:fs";
import { resolve      } from "node:path";

export type Host = "claude" | "codex";

export interface Assignment {
	readonly model      : string ;
	readonly effort?    : string ;
	readonly selectedBy : string ;
}

export interface ModelConfig {
	readonly schemaVersion : 1                                                            ;
	readonly capabilities  : Readonly<Record<string, readonly string[]>>                  ;
	readonly roles         : Readonly<Record<string, Readonly<Record<Host, Assignment>>>> ;
}

export const HOSTS: readonly Host[] = ["claude", "codex"];

/** Roles the plugin owns. `author` is the user's session and is never assignable. */
export const ASSIGNABLE_ROLES: readonly string[] = ["inspector"];

const isText = (value: unknown): value is string => typeof value === "string" && value.trim() === value && value.length > 0;

/** Every problem found, so one run reports all of them. An empty list means the assignments are usable. */
export function modelConfigProblems(config: unknown): string[] {
	const problems: string[] = []                                    ;
	const root               = config as Partial<ModelConfig> | null ;
	if (!root || typeof root !== "object" || root.schemaVersion !== 1) return ["schemaVersion must be 1"];
	const capabilities = root.capabilities ?? {};
	for (const [model, efforts] of Object.entries(capabilities)) {
		if (!Array.isArray(efforts) || !efforts.every(isText)) problems.push(`capabilities.${model}: list the supported efforts (empty when the model has no effort control)`);
	}
	for (const [role, hosts] of Object.entries(root.roles ?? {})) {
		if (!ASSIGNABLE_ROLES.includes(role)) problems.push(`roles.${role}: not an assignable role (${ASSIGNABLE_ROLES.join(", ")})`);
		for (const host of HOSTS) {
			const assignment = (hosts as Partial<Record<Host, Assignment>>)[host] ;
			const where      = `roles.${role}.${host}`                            ;
			if (!assignment || !isText(assignment.model)) { problems.push(`${where}: model is required`); continue; }
			if (!isText(assignment.selectedBy)) problems.push(`${where}: selectedBy must be "unevaluated-default" or an evaluation record`);
			const supported = capabilities[assignment.model];
			if (!supported) { problems.push(`${where}: model ${assignment.model} has no capabilities entry`); continue; }
			if (assignment.effort === undefined && supported.length) problems.push(`${where}: ${assignment.model} supports effort (${supported.join(", ")}); set one`);
			if (assignment.effort !== undefined && !supported.includes(assignment.effort)) problems.push(`${where}: effort ${assignment.effort} is not supported by ${assignment.model}`);
		}
		for (const host of Object.keys(hosts)) if (!HOSTS.includes(host as Host)) problems.push(`roles.${role}.${host}: unknown host`);
	}
	return problems;
}

export function readModelConfig(root: string): ModelConfig {
	const config   = JSON.parse(readFileSync(resolve(root, "product/models.json"), "utf8")) as unknown ;
	const problems = modelConfigProblems(config)                                                       ;
	if (problems.length) throw new Error(`product/models.json is invalid:\n- ${problems.join("\n- ")}`);
	return config as ModelConfig;
}

/** Rewrite the Claude agent frontmatter `model:` and `effort:`; an assignment without effort removes the line. */
export function stampClaudeAgent(text: string, assignment: Assignment): string {
	const match = /^---\n([\s\S]*?)\n---\n/u.exec(text);
	if (!match) throw new Error("Agent definition has no frontmatter.");
	const kept  = match[1].split("\n").filter(line => !/^(model|effort):/u.test(line))                                         ;
	const added = [`model: ${assignment.model}`, ...(assignment.effort === undefined ? [] : [`effort: ${assignment.effort}`])] ;
	return `---\n${[...kept, ...added].join("\n")}\n---\n${text.slice(match[0].length)}`;
}

/** Rewrite the Codex agent `model` and `model_reasoning_effort`; an assignment without effort removes the line. */
export function stampCodexAgent(text: string, assignment: Assignment): string {
	const lines = text.split("\n").filter(line => !line.startsWith("model_reasoning_effort = ")) ;
	const index = lines.findIndex(line => line.startsWith("model = "))                           ;
	if (index < 0) throw new Error("Codex agent definition has no model line.");
	lines[index] = `model = "${assignment.model}"`;
	if (assignment.effort !== undefined) lines.splice(index + 1, 0, `model_reasoning_effort = "${assignment.effort}"`);
	return lines.join("\n");
}
