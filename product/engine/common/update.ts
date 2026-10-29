import      { spawnSync                                            } from "node:child_process" ;
import      { existsSync, readFileSync                             } from "node:fs"            ;
import      { homedir                                              } from "node:os"            ;
import      { isAbsolute, join, resolve                            } from "node:path"          ;
import      { stateDirectory, writeJsonAtomically                  } from "@/common/mode.ts"   ;
import      { installShim                                          } from "@/common/statusline.ts" ;

/**
 * Update check in the style of oh-my-zsh's check_for_upgrade: at most one network probe per period, a cached answer
 * otherwise, a snooze after "no", and a single switch to turn it off. The prompt names the command the way oh-my-pi's
 * notice does; the user runs `! update boxbox` themselves, and the agent never asks or installs.
 */
export const REPOSITORY      = "https://github.com/Woo-JongHo/boxbox" ;
export const CHECK_PERIOD_MS = 24 * 60 * 60 * 1000                    ;
export const PROBE_TIMEOUT   = 3_000                                  ;
const        SNOOZE_DAYS     = 7                                      ;
/** What the user types in Claude Code; the `!` prefix runs it in the session, so its output lands in the chat. */
export const UPDATE_COMMAND  = "! update boxbox"                      ;

/** ANSI styles for the update notice and progress; `NO_COLOR` or `BOXBOX_COLOR=0` turns them off. */
const STYLES = {
	bold   : "\x1b[1m"  ,
	dim    : "\x1b[2m"  ,
	red    : "\x1b[31m" ,
	green  : "\x1b[32m" ,
	yellow : "\x1b[33m" ,
	cyan   : "\x1b[36m" ,
} as const;

const colored = (): boolean => !process.env.NO_COLOR && !["0", "off", "false"].includes((process.env.BOXBOX_COLOR ?? "").toLowerCase())                         ;
const paint   = (text: string, ...styles: (keyof typeof STYLES)[]): string => colored() ? `${styles.map(style => STYLES[style]).join("")}${text}\x1b[0m` : text ;

export interface UpdateCache {
	readonly checkedAt?    : string ;
	readonly latest?       : string ;
	readonly snoozedUntil? : string ;
	readonly source?       : string ;
}

export interface UpdateStatus {
	readonly current   : string             ;
	readonly latest    : string | undefined ;
	readonly available : boolean            ;
	readonly snoozed   : boolean            ;
	readonly probed    : boolean            ;
}

const cachePath = (): string => join(stateDirectory(), "update.json");

export function readUpdateCache(): UpdateCache {
	try { return existsSync(cachePath()) ? JSON.parse(readFileSync(cachePath(), "utf8")) : {}; }
	catch { return {}; }
}

function writeUpdateCache(patch: UpdateCache): void {
	writeJsonAtomically(cachePath(), { ...readUpdateCache(), ...patch });
}

const parts = (version: string): readonly number[] => version.replace(/^v/u, "").split("-")[0]!.split(".").map(Number);

/** Release order of plain `x.y.z` versions; a pre-release suffix sorts before its release. */
export function compareVersions(left: string, right: string): number {
	const [a, b] = [parts(left), parts(right)];
	for (let index = 0; index < 3; index++) if ((a[index] ?? 0) !== (b[index] ?? 0)) return (a[index] ?? 0) - (b[index] ?? 0);
	return Number(!left.includes("-")) - Number(!right.includes("-"));
}

/** Highest `vX.Y.Z` tag in `git ls-remote --tags` output; peeled `^{}` entries and other tags are ignored. */
export function latestTag(listing: string): string | undefined {
	const versions = [...listing.matchAll(/refs\/tags\/v(\d+\.\d+\.\d+)$/gmu)].map(match => match[1]!);
	return versions.sort(compareVersions).at(-1);
}

export function probeLatest(): string | undefined {
	const result = spawnSync("git", ["ls-remote", "--tags", REPOSITORY], { encoding: "utf8", timeout: PROBE_TIMEOUT, windowsHide: true });
	return result.status === 0 ? latestTag(result.stdout) : undefined;
}

export const updateCheckEnabled = (): boolean => !["0", "off", "false"].includes((process.env.BOXBOX_UPDATE_CHECK ?? "").toLowerCase());

/** Uses the cached answer inside the check period; probes only when it is stale or `force` is set. */
export function checkForUpdate(current: string, options: { readonly now?: number; readonly force?: boolean; readonly probe?: () => string | undefined } = {}): UpdateStatus {
	const now    = options.now   ?? Date.now()                                                               ;
	const probe  = options.probe ?? probeLatest                                                              ;
	const cache  = readUpdateCache()                                                                         ;
	const stale  = options.force || !cache.checkedAt || now - Date.parse(cache.checkedAt) >= CHECK_PERIOD_MS ;
	let   latest = cache.latest                                                                              ;
	if (stale) {
		const found = probe();
		// A failed probe is silent and still counts as a check, so an offline machine does not retry every session.
		writeUpdateCache({ checkedAt: new Date(now).toISOString(), ...(found ? { latest: found } : {}) });
		latest = found ?? latest;
	}
	const snoozed = cache.snoozedUntil !== undefined && now < Date.parse(cache.snoozedUntil);
	return { current, latest, available: latest !== undefined && compareVersions(latest, current) > 0, snoozed, probed: stale };
}

export interface UpdateNotice {
	readonly user    : string ;
	readonly context : string ;
}

/**
 * The SessionStart update prompt, or nothing when there is no unsnoozed newer version. `user` is shown in the chat before
 * the first message; `context` tells the agent not to ask about it. The user runs the update with the `!`
 * prefix so its output lands in the conversation and the agent never installs on its own.
 */
export function updateNotice(current: string, options: Parameters<typeof checkForUpdate>[1] = {}): UpdateNotice | undefined {
	if (!updateCheckEnabled()) return undefined;
	const status = checkForUpdate(current, options);
	if (!status.available || status.snoozed) return undefined;
	const rule = "━".repeat(52);
	return {
		user    : `\n${paint(rule, "yellow")}\n  ${paint("⬆  BoxBox update available", "bold", "yellow")}    ${paint(`v${current}`, "dim")}  →  ${paint(`v${status.latest}`, "bold", "green")}\n     Run:  ${paint(UPDATE_COMMAND, "bold", "cyan")}\n${paint(rule, "yellow")}`,
		context : `[boxbox] The user was shown that BoxBox v${status.latest} is available (installed ${current}) and that \`${UPDATE_COMMAND}\` installs it. `
			+ `Do not ask about it and do not run the update yourself. If the user asks about updating, point them to \`${UPDATE_COMMAND}\` and a restart afterwards; `
			+ `if they want the notice hidden for ${SNOOZE_DAYS} days, run \`boxbox update --snooze\`.`,
	};
}

interface Step {
	readonly label   : string            ;
	readonly command : string            ;
	readonly args    : readonly string[] ;
	readonly cwd     : string            ;
}

function run(step: Step): string {
	// npm and npx are .cmd shims on Windows and need a shell; every argument here is a path or a fixed flag. The shell
	// gets one command string, because Node deprecates passing an argument list together with `shell`.
	const shell   = process.platform === "win32" && /^(npm|npx)$/u.test(step.command)                                                                ;
	const quoted  = step.args.map(value => /[\s"]/u.test(value) ? `"${value}"` : value)                                                              ;
	const options = { cwd: step.cwd, encoding: "utf8" as const, windowsHide: true, maxBuffer: 64 * 1024 * 1024 }                                     ;
	const result  = shell ? spawnSync([step.command, ...quoted].join(" "), { ...options, shell }) : spawnSync(step.command, [...step.args], options) ;
	if (result.status !== 0) throw new Error(`${step.label} failed: ${(result.stderr || result.stdout || result.error?.message || "").trim().split("\n").slice(-5).join(" | ")}`);
	return result.stdout;
}

/**
 * Step-by-step progress for `boxbox update`. Each step prints one finished line with a bar, so the output reads the
 * same whether it streams to a terminal or arrives at once through Claude Code's `!` prompt.
 */
class Progress {
	private done    = 0          ;
	private started = Date.now() ;
	constructor(private readonly total: number) {}

	header(current: string): void {
		console.log(`${paint("UPDATING BoxBox", "bold", "yellow")}  ·  current version ${paint(`v${current}`, "dim")}`);
	}

	run<T>(phase: string, label: string, action: () => T): T {
		const start = Date.now()                                                                                                                                              ;
		const row   = (mark: string, count: number): string => `${this.bar()}  ${count}/${this.total}  ${paint(phase.padEnd(PHASE_WIDTH), "bold", "cyan")}  ${mark} ${label}` ;
		try {
			const result = action();
			this.done += 1;
			console.log(`${row(paint("✓", "green"), this.done)}  ${paint(seconds(Date.now() - start), "dim")}`);
			return result;
		} catch (error) {
			console.log(row(paint("✗", "bold", "red"), this.done + 1));
			throw error;
		}
	}

	footer(version: string, host: string, notes: readonly string[]): void {
		console.log(`${paint(`✓ UPDATED to v${version}`, "bold", "green")} in ${seconds(Date.now() - this.started)}. ${paint(`Restart ${host} to load it.`, "bold")}`);
		if (notes.length > 0) console.log(["", paint(`Patch notes v${version}`, "bold", "yellow"), ...notes].join("\n"));
	}

	private bar(): string {
		const width  = 20                                         ;
		const filled = Math.round(width * this.done / this.total) ;
		return `[${paint("█".repeat(filled), "green")}${paint("░".repeat(width - filled), "dim")}]`;
	}
}

const seconds     = (ms: number): string => `${(ms / 1000).toFixed(1)}s` ;
const PHASE_WIDTH = "DOWNLOADING".length                                 ;
const NOTE_WIDTH  = 76                                                   ;

/**
 * A short form of the CHANGELOG section for `version`, or of `[Unreleased]` before that section is cut: each `###`
 * heading and the first `limit` bullets, one line each. Wrapped bullet lines are joined before shortening.
 */
export function patchNotes(changelog: string, version: string, limit = 3): string[] {
	const lines = changelog.split(/\r?\n/u)                                                          ;
	const find  = (name: string): number => lines.findIndex(line => line.startsWith(`## [${name}]`)) ;
	const start = find(version) >= 0 ? find(version) : find("Unreleased")                            ;
	if (start < 0) return [];
	const length                                           = lines.slice(start + 1).findIndex(line => line.startsWith("## [")) ;
	const groups: { heading: string; bullets: string[] }[] = []                                                                ;
	for (const line of lines.slice(start + 1, length === -1 ? undefined : start + 1 + length)) {
		const group = groups.at(-1);
		if (line.startsWith("### ")) groups.push({ heading: line.slice(4).trim(), bullets: [] });
		else if (line.startsWith("- ") && group) group.bullets.push(line.slice(2).trim());
		else if (/^\s+\S/u.test(line) && group && group.bullets.length > 0) group.bullets[group.bullets.length - 1] += ` ${line.trim()}`;
	}
	// The first sentence carries the point; a longer one is cut at a word boundary.
	const short = (text: string): string => {
		const first = text.split(/(?<=[.:;])\s/u)[0]!;
		return first.length <= NOTE_WIDTH ? first : `${first.slice(0, first.lastIndexOf(" ", NOTE_WIDTH - 1))} …`;
	};
	return groups.filter(group => group.bullets.length > 0).flatMap(group => [
		`  ${group.heading}`,
		...group.bullets.slice(0, limit).map(bullet => `    • ${short(bullet)}`),
		...(group.bullets.length > limit ? [`    … ${group.bullets.length - limit} more in CHANGELOG.md`] : []),
	]);
}

/** The version Claude Code's plugin registry points at, asked from that install's own launcher. */
function installedClaudeVersion(): string | undefined {
	const registry = join(process.env.CLAUDE_CONFIG_DIR || join(homedir(), ".claude"), "plugins", "installed_plugins.json") ;
	let   root: string | undefined;
	try { root = JSON.parse(readFileSync(registry, "utf8")).plugins?.["boxbox@boxbox-plugins"]?.[0]?.installPath; } catch { return undefined; }
	if (!root) return undefined;
	const result = spawnSync(process.execPath, [join(root, "scripts", "boxbox.mjs"), "--version"], { encoding: "utf8", windowsHide: true, timeout: 30_000 });
	return result.status === 0 ? result.stdout.trim() : undefined;
}

/** A source checkout is accepted only when its product manifest names BoxBox. */
function assertSource(source: string): string {
	const root = resolve(source);
	if (!isAbsolute(source) || !existsSync(join(root, ".git"))) throw new Error(`update source must be an absolute git checkout: ${source}`);
	const product = JSON.parse(readFileSync(join(root, "product.json"), "utf8"));
	if (String(product.displayName).toLowerCase() !== "boxbox") throw new Error(`update source is not a BoxBox checkout: ${root}`);
	return root;
}

/** `boxbox update [--check] [--snooze [days]] [--source <checkout>] [--host claude|codex] [--json]` */
export function runUpdate(args: readonly string[], current: string): number {
	const json  = args.includes("--json")                                                                                                                                                ;
	const value = (flag: string): string | undefined => { const at = args.indexOf(flag); return at >= 0 ? args[at + 1] : undefined; }                                                    ;
	const emit  = (output: Record<string, unknown>, text: string): void => console.log(json ? JSON.stringify({ schemaVersion: 1, tool: "boxbox", command: "update", ...output }) : text) ;
	if (args.includes("--snooze")) {
		const days  = Number(value("--snooze") ?? SNOOZE_DAYS)                                                                   ;
		const until = new Date(Date.now() + (Number.isFinite(days) && days > 0 ? days : SNOOZE_DAYS) * 86_400_000).toISOString() ;
		writeUpdateCache({ snoozedUntil: until });
		emit({ ok: true, snoozedUntil: until }, `boxbox update: snoozed until ${until}`);
		return 0;
	}
	if (value("--source")) writeUpdateCache({ source: assertSource(value("--source")!) });
	const status = checkForUpdate(current, { force: true });
	if (args.includes("--check")) {
		emit({ ok: true, ...status }, status.available ? `boxbox update: v${status.latest} available (installed ${current})` : `boxbox update: up to date (${current}${status.latest ? `, latest v${status.latest}` : ", latest unknown"})`);
		return 0;
	}
	const source = readUpdateCache().source;
	if (!source) throw new Error("No update source. The npm package is not published yet; run `boxbox update --source <absolute boxbox checkout>` once.");
	const root = assertSource(source)        ;
	const host = value("--host") ?? "claude" ;
	if (!["claude", "codex"].includes(host)) throw new Error("--host must be claude or codex");
	// A checkout on a local branch without upstream (development) is installed as it is; otherwise fast-forward first.
	const upstream = spawnSync("git", ["rev-parse", "--abbrev-ref", "@{upstream}"], { cwd: root, encoding: "utf8", windowsHide: true }).status === 0;
	const steps: (Step & { readonly phase: string })[] = [
		...(upstream ? [{ phase: "DOWNLOADING", label: "git pull"      , command: "git", args: ["pull", "--ff-only"]            , cwd: root }] : []),
		{                 phase: "PREPARING"  , label: "bun install"   , command: "bun", args: ["install", "--frozen-lockfile"] , cwd: root },
		{                 phase: "BUILDING"   , label: "pack installer", command: "bun", args: ["run", "pack:installer"]        , cwd: root },
	];
	const verifies = host === "claude"                                                                                                 ;
	const progress = json ? undefined : new Progress(steps.length + 2 + Number(verifies))                                              ;
	const stage    = <T>(phase: string, label: string, action: () => T): T => progress ? progress.run(phase, label, action) : action() ;
	progress?.header(current);
	let packed = "";
	for (const step of steps) packed = stage(step.phase, step.label, () => run(step));
	const archive = packed.trim().split(/\r?\n/u).map(line => line.trim()).filter(line => line.endsWith(".tgz")).at(-1) ;
	if (!archive || !existsSync(archive)) throw new Error("pack installer did not report an archive");
	const install = { label: `install for ${host}`, command: "npm", args: ["exec", "--yes", "--package", archive, "--", "boxbox", `--${host}`], cwd: root } ;
	stage("INSTALLING", install.label, () => run(install));
	const target = String(JSON.parse(readFileSync(join(root, "package.json"), "utf8")).version);
	// As in oh-my-pi's updater, an update counts only after the installed copy reports the expected version.
	const verify = (): void => {
		const found = installedClaudeVersion();
		if (found !== target) throw new Error(`installed version is ${found ?? "unknown"}, expected ${target}; rerun ${UPDATE_COMMAND}`);
	};
	if (verifies) stage("VERIFYING", `v${target}`, verify);
	writeUpdateCache({ snoozedUntil: new Date(0).toISOString() });
	const shim  = stage("FINISHING", "status line shim", installShim)                                                                ;
	const notes = existsSync(join(root, "CHANGELOG.md")) ? patchNotes(readFileSync(join(root, "CHANGELOG.md"), "utf8"), target) : [] ;
	progress?.footer(target, host === "claude" ? "Claude Code" : "Codex", notes);
	if (json) emit({ ok: true, archive, host, statuslineShim: shim, restartRequired: true }, "");
	return 0;
}
