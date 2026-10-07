import      { createHash                                                    } from "node:crypto" ;
import      { existsSync, lstatSync, mkdirSync, readFileSync, writeFileSync } from "node:fs"     ;
import      { homedir                                                       } from "node:os"     ;
import      { dirname, isAbsolute, join, parse, relative, resolve, sep      } from "node:path"   ;

export const PROJECT_CONFIG_SCHEMA_VERSION = 2                                 ;
export const PUBLIC_LANGUAGES              = ["typescript", "python"] as const ;
export const USER_DATABASE_FILES           = [
	{ name : "conventions" , filename : "conventions.jsonl" },
	{ name : "examples"    , filename : "examples.jsonl"    },
	{ name : "decisions"   , filename : "decisions.jsonl"   },
] as const;

export type PublicLanguage = typeof PUBLIC_LANGUAGES[number];

export interface FormatterConfig {
	readonly command   : string            ;
	readonly args      : readonly string[] ;
	readonly timeoutMs : number            ;
}

export interface ProjectConfig {
	readonly schemaVersion : 2                                                          ;
	readonly languages?    : readonly PublicLanguage[]                                  ;
	readonly preset?       : "recommended"                                              ;
	readonly formatters?   : Readonly<Partial<Record<PublicLanguage, FormatterConfig>>> ;
}

export interface EffectiveConfig {
	readonly schemaVersion : 2                                                          ;
	readonly languages     : readonly PublicLanguage[]                                  ;
	readonly preset        : "recommended"                                              ;
	readonly formatters    : Readonly<Partial<Record<PublicLanguage, FormatterConfig>>> ;
}

export interface ConfigSource {
	readonly layer       : "base" | "preset" | "user" | "project" ;
	readonly path        : string                                 ;
	readonly present     : boolean                                ;
	readonly fingerprint : string                                 ;
	readonly migrated?   : 1                                      ;
}

export interface ResolvedConfig {
	readonly effective   : EffectiveConfig         ;
	readonly fingerprint : string                  ;
	readonly sources     : readonly ConfigSource[] ;
}

export interface ResolveConfigOptions {
	readonly userConfigPath? : string        ;
	readonly preset?         : ProjectConfig ;
}

export interface UserDatabaseFileStatus {
	readonly name   : typeof USER_DATABASE_FILES[number]["name"] ;
	readonly path   : string                                     ;
	readonly exists : boolean                                    ;
	readonly rows   : number                                     ;
	readonly bytes  : number                                     ;
}

export interface UserDatabaseStatus {
	readonly root   : string                            ;
	readonly exists : boolean                           ;
	readonly bytes  : number                            ;
	readonly files  : readonly UserDatabaseFileStatus[] ;
}

export interface UserDatabaseInitializationFile {
	readonly name    : typeof USER_DATABASE_FILES[number]["name"] ;
	readonly path    : string                                     ;
	readonly created : boolean                                    ;
}

export interface UserDatabaseInitialization {
	readonly root        : string                                    ;
	readonly createdRoot : boolean                                   ;
	readonly files       : readonly UserDatabaseInitializationFile[] ;
}

export const DEFAULT_PROJECT_CONFIG: ProjectConfig = { schemaVersion: PROJECT_CONFIG_SCHEMA_VERSION };

const BASE_CONFIG        : ProjectConfig = { schemaVersion: 2, languages: PUBLIC_LANGUAGES, preset: "recommended", formatters: {} } ;
const RECOMMENDED_CONFIG : ProjectConfig = { schemaVersion: 2 }                                                                     ;

function digest(value: string): string {
	return `sha256:${createHash("sha256").update(value).digest("hex")}`;
}

function assertPlainObject(value: unknown, where: string): asserts value is Record<string, unknown> {
	if (typeof value !== "object" || value === null || Array.isArray(value)) throw new Error(`${where}: JSON object expected`);
}

function unknownKeys(value: Record<string, unknown>, accepted: readonly string[], where: string): void {
	const unknown = Object.keys(value).filter(key => !accepted.includes(key));
	if (unknown.length > 0) throw new Error(`${where}: unsupported config option: ${unknown.join(", ")}`);
}

function languagesOf(value: unknown, where: string, required: boolean): readonly PublicLanguage[] | undefined {
	if (value === undefined && !required) return undefined;
	if (!Array.isArray(value) || value.length === 0) throw new Error(`${where}: languages must be a non-empty array`);
	const languages: PublicLanguage[] = [];
	for (const language of value) {
		if (language !== "typescript" && language !== "python") throw new Error(`${where}: unsupported language: ${String(language)}`);
		if (languages.includes(language)) throw new Error(`${where}: duplicate language: ${language}`);
		languages.push(language);
	}
	return languages;
}

function formatterOf(value: unknown, where: string): FormatterConfig {
	assertPlainObject(value, where);
	unknownKeys(value, ["command", "args", "timeoutMs"], where);
	if (typeof value.command !== "string" || value.command.trim() === "") throw new Error(`${where}: command must be a non-empty string`);
	if (!Array.isArray(value.args) || value.args.some(argument => typeof argument !== "string")) throw new Error(`${where}: args must be an array of strings`);
	if (value.args.filter(argument => argument === "{file}").length !== 1) throw new Error(`${where}: args must contain exactly one {file}`);
	const timeoutMs = value.timeoutMs === undefined ? 30_000 : value.timeoutMs;
	if (!Number.isInteger(timeoutMs) || !(Number(timeoutMs) >= 1 && Number(timeoutMs) <= 60_000)) throw new Error(`${where}: timeoutMs must be an integer from 1 to 60000`);
	return { command: value.command, args: [...value.args] as string[], timeoutMs: Number(timeoutMs) };
}

function formattersOf(value: unknown, where: string): ProjectConfig["formatters"] {
	if (value === undefined) return undefined;
	assertPlainObject(value, where);
	unknownKeys(value, PUBLIC_LANGUAGES, where);
	const result: Partial<Record<PublicLanguage, FormatterConfig>> = {};
	for (const language of PUBLIC_LANGUAGES) if (value[language] !== undefined) result[language] = formatterOf(value[language], `${where}.${language}`);
	return result;
}

/** Schema 1 is the old languages-only config; it is converted in memory to the schema 2 layers without writing the original. */
export function validateProjectConfig(value: unknown, where: string): ProjectConfig {
	assertPlainObject(value, where);
	if (value.schemaVersion === 1) {
		unknownKeys(value, ["schemaVersion", "languages"], where);
		return { schemaVersion: 2, languages: languagesOf(value.languages, where, true) };
	}
	if (value.schemaVersion !== PROJECT_CONFIG_SCHEMA_VERSION) throw new Error(`${where}: unsupported schemaVersion ${String(value.schemaVersion)}; expected 1 or 2`);
	unknownKeys(value, ["schemaVersion", "languages", "preset", "formatters"], where);
	if (value.preset !== undefined && value.preset !== "recommended") throw new Error(`${where}: preset must be recommended`);
	return {
		schemaVersion : 2,
		...(value.languages === undefined ? {} : { languages: languagesOf(value.languages, where, false) }),
		...(value.preset === undefined ? {} : { preset: value.preset }),
		...(value.formatters === undefined ? {} : { formatters: formattersOf(value.formatters, `${where}.formatters`) }),
	};
}

function readConfigFile(path: string, label: string): { readonly config: ProjectConfig; readonly raw: string; readonly migrated: boolean } | undefined {
	if (!existsSync(path)) return undefined;
	const parent = dirname(path);
	if (existsSync(parent)) {
		const parentStatus = lstatSync(parent);
		if (!parentStatus.isDirectory() || parentStatus.isSymbolicLink()) throw new Error(`${parent}: config directory must be a real directory, not a symlink`);
	}
	const status = lstatSync(path);
	if (!status.isFile() || status.isSymbolicLink()) throw new Error(`${path}: config must be a regular file, not a symlink`);
	const raw = readFileSync(path, "utf8");
	let value: unknown;
	try { value = JSON.parse(raw); }
	catch (error) { throw new Error(`${path}: malformed JSON: ${error instanceof Error ? error.message : String(error)}`); }
	const migrated = typeof value === "object" && value !== null && !Array.isArray(value) && (value as Record<string, unknown>).schemaVersion === 1;
	return { config: validateProjectConfig(value, label), raw, migrated };
}

function projectConfigPath(root: string): string {
	const directory = join(resolve(root), ".xxx");
	if (existsSync(directory)) {
		const status = lstatSync(directory);
		if (!status.isDirectory() || status.isSymbolicLink()) throw new Error(`${directory}: .xxx must be a real directory, not a symlink`);
	}
	return join(directory, "config.json");
}

/** Uses XDG_CONFIG_HOME only when it is an absolute path; otherwise uses the standard user config location. */
export function userDataRoot(): string {
	const xdg = process.env.XDG_CONFIG_HOME;
	return resolve(join(xdg && isAbsolute(xdg) ? xdg : join(homedir(), ".config"), "xxx"));
}

function defaultUserPath(): string {
	return join(userDataRoot(), "config.json");
}

function missingPath(error: unknown): boolean {
	return typeof error === "object" && error !== null && "code" in error && error.code === "ENOENT";
}

function lstatIfPresent(path: string): ReturnType<typeof lstatSync> | undefined {
	try { return lstatSync(path); }
	catch (error) {
		if (missingPath(error)) return undefined;
		throw error;
	}
}

function assertRealDirectory(path: string): void {
	const status = lstatSync(path);
	if (!status.isDirectory() || status.isSymbolicLink()) throw new Error(`${path}: user database path component must be a real directory, not a symlink`);
}

/** Checks every existing component of an absolute path and creates safe directories one level at a time only when needed. */
function prepareUserRoot(create: boolean): boolean {
	const root   = userDataRoot() ;
	const parsed = parse(root)    ;
	const components = relative(parsed.root, root)
		.split(sep)
		.filter(component => component !== "")          ;
	let current     = parsed.root ;
	let rootCreated = false       ;

	assertRealDirectory(current);
	for (const component of components) {
		current = join(current, component);
		const status = lstatIfPresent(current);
		if (status) {
			if (!status.isDirectory() || status.isSymbolicLink()) throw new Error(`${current}: user database path component must be a real directory, not a symlink`);
			continue;
		}
		if (!create) return false;
		try { mkdirSync(current, { mode: 0o700 }); }
		catch (error) {
			if (!missingPath(error) && !(typeof error === "object" && error !== null && "code" in error && error.code === "EEXIST")) throw error;
		}
		assertRealDirectory(current);
		if (current === root) rootCreated = true;
	}
	return create ? rootCreated : true;
}

function assertUserDatabaseFile(path: string): void {
	const status = lstatSync(path);
	if (!status.isFile() || status.isSymbolicLink()) throw new Error(`${path}: user database file must be a regular file, not a symlink`);
}

/** The user DB only creates empty JSONL files; it never reads or changes the bytes of existing files. */
export function initializeUserDatabase(): UserDatabaseInitialization {
	const root        = userDataRoot()        ;
	const createdRoot = prepareUserRoot(true) ;
	const files       = USER_DATABASE_FILES.map(entry => {
		const path     = join(root, entry.filename) ;
		let created    = false                      ;
		const existing = lstatIfPresent(path)       ;
		if (existing) assertUserDatabaseFile(path);
		else {
			try {
				writeFileSync(path, "", { encoding: "utf8", flag: "wx", mode: 0o600 });
				created = true;
			} catch (error) {
				if (!(typeof error === "object" && error !== null && "code" in error && error.code === "EEXIST")) throw error;
				assertUserDatabaseFile(path);
			}
		}
		return { name: entry.name, path, created };
	});
	return { root, createdRoot, files };
}

/** Reports only the number of non-empty JSONL lines, never the record bodies. */
export function userDatabaseStatus(): UserDatabaseStatus {
	const root   = userDataRoot()         ;
	const exists = prepareUserRoot(false) ;
	const files  = USER_DATABASE_FILES.map(entry => {
		const path = join(root, entry.filename);
		if (!exists) return { name: entry.name, path, exists: false, rows: 0, bytes: 0 };
		const status = lstatIfPresent(path);
		if (!status) return { name: entry.name, path, exists: false, rows: 0, bytes: 0 };
		assertUserDatabaseFile(path);
		const contents = readFileSync(path);
		return { name: entry.name, path, exists: true, rows: contents.toString("utf8").split("\n").filter(line => line.trim() !== "").length, bytes: contents.byteLength };
	});
	return { root, exists, bytes: files.reduce((total, file) => total + file.bytes, 0), files };
}

export function readProjectConfig(root: string): ProjectConfig | undefined {
	return readConfigFile(projectConfigPath(root), "project config")?.config;
}

function merge(base: EffectiveConfig, layer: ProjectConfig): EffectiveConfig {
	return {
		schemaVersion : 2,
		languages     : layer.languages ? [...layer.languages] : base.languages,
		preset        : layer.preset ?? base.preset,
		formatters    : layer.formatters ? { ...base.formatters, ...layer.formatters } : base.formatters,
	};
}

export function resolveConfig(root: string, options: ResolveConfigOptions = {}): ResolvedConfig {
	const baseRaw                  = JSON.stringify(BASE_CONFIG)                                                                       ;
	const presetConfig             = options.preset ? validateProjectConfig(options.preset, "recommended preset") : RECOMMENDED_CONFIG ;
	const presetRaw                = JSON.stringify(presetConfig)                                                                      ;
	const userPath                 = resolve(options.userConfigPath ?? defaultUserPath())                                              ;
	const projectPath              = projectConfigPath(root)                                                                           ;
	const user                     = readConfigFile(userPath, "user config")                                                           ;
	const project                  = readConfigFile(projectPath, "project config")                                                     ;
	let effective: EffectiveConfig = { schemaVersion: 2, languages: [...PUBLIC_LANGUAGES], preset: "recommended", formatters: {} }     ;
	for (const layer of [BASE_CONFIG, presetConfig, user?.config, project?.config]) if (layer) effective = merge(effective, layer);
	const sources: ConfigSource[] = [
		{ layer: "base", path: "embedded:base", present: true, fingerprint: digest(baseRaw) },
		{ layer: "preset", path: "embedded:preset/recommended", present: true, fingerprint: digest(presetRaw) },
		{ layer: "user", path: userPath, present: user !== undefined, fingerprint: digest(user?.raw ?? ""), ...(user?.migrated ? { migrated: 1 as const } : {}) },
		{ layer: "project", path: projectPath, present: project !== undefined, fingerprint: digest(project?.raw ?? ""), ...(project?.migrated ? { migrated: 1 as const } : {}) },
	];
	const fingerprint = digest(JSON.stringify({ sources: sources.map(source => [source.layer, source.present, source.fingerprint]), effective }));
	return { effective, fingerprint, sources };
}

/** Creates only a minimal schema 2 project config without touching existing config or user files. */
export function initializeProjectConfig(root: string): { readonly created: boolean; readonly path: string } {
	const absolute   = resolve(root)       ;
	const rootStatus = lstatSync(absolute) ;
	if (!rootStatus.isDirectory() || rootStatus.isSymbolicLink()) throw new Error(`${absolute}: project root must be a real directory, not a symlink`);
	const path      = projectConfigPath(absolute) ;
	const directory = dirname(path)               ;
	if (!existsSync(directory)) mkdirSync(directory);
	if (existsSync(path)) {
		readProjectConfig(absolute);
		return { created: false, path };
	}
	writeFileSync(path, `${JSON.stringify(DEFAULT_PROJECT_CONFIG, null, 2)}\n`, { encoding: "utf8", flag: "wx" });
	return { created: true, path };
}
