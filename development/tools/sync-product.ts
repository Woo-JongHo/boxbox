import      {
              existsSync    ,
              lstatSync     ,
              readdirSync   ,
              readFileSync  ,
              readlinkSync  ,
              renameSync    ,
              symlinkSync   ,
              unlinkSync    ,
              writeFileSync ,
                              } from "node:fs"   ;
import      { homedir         } from "node:os"   ;
import      {
              basename      ,
              dirname       ,
              isAbsolute    ,
              join          ,
              relative      ,
              resolve       ,
              sep           ,
                              } from "node:path" ;

interface Identity {
	readonly displayName         : string ;
	readonly id                  : string ;
	readonly envPrefix           : string ;
	readonly repositoryDirectory : string ;
}

interface Change {
	readonly path: string;
	readonly content: string;
}

export interface ProductPlan {
	readonly root     : string                                                  ;
	readonly identity : Identity                                                ;
	readonly changes  : readonly Change[]                                       ;
	readonly moves    : readonly { from: string; to: string }[]                 ;
	readonly links    : readonly { from: string; to: string; target: string }[] ;
}

const SNAPSHOT = "development/tools/product-identity.generated.json"                                                                             ;
const OMIT     = new Set([".git", "node_modules", "dist", "stress", "eval", "TEST_COMPLETED", "scratchpad", "evidence", "__pycache__", ".venv"]) ;
const HISTORY  = ["2026-10-12-boxbox-rename.md", "2026-10-12-eggbox-rename.md"]                                                                  ;

function identityOf(displayName: unknown): Identity {
	if (typeof displayName !== "string" || !/^[A-Za-z][A-Za-z0-9]*$/u.test(displayName)) throw new Error("displayName must be an ASCII letter followed by letters or digits");

	return { displayName, id: displayName.toLowerCase(), envPrefix: displayName.toUpperCase(), repositoryDirectory: `98_${displayName}` };
}

function filesIn(root: string, directory = root): string[] {
	return readdirSync(directory, { withFileTypes: true }).flatMap(entry => {
		if (entry.isSymbolicLink() || OMIT.has(entry.name) || entry.name.endsWith("-evidence") || entry.name.endsWith(".log") || HISTORY.includes(entry.name)) return [];
		const path = join(directory, entry.name);
		if (entry.isDirectory()) return entry.name.startsWith(".") && ![".agents", ".claude", ".codex", ".github", ".claude-plugin", ".codex-plugin"].includes(entry.name) ? [] : filesIn(root, path);

		return entry.isFile() ? [path] : [];
	});
}

/** Materialize naming from one input. Historical records and installed user state are not rewritten. */
export function planProductIdentity(root: string): ProductPlan {
	root = resolve(root);
	const config   = JSON.parse(readFileSync(join(root, "product.json"), "utf8")) as { displayName?: unknown } ;
	const identity = identityOf(config.displayName)                                                            ;
	const previous = JSON.parse(readFileSync(join(root, SNAPSHOT), "utf8")) as Identity                        ;
	identityOf(previous.displayName);
	if (previous.id !== previous.displayName.toLowerCase() || previous.envPrefix !== previous.displayName.toUpperCase() || !/^98_[A-Za-z0-9_]+$/u.test(previous.repositoryDirectory)) throw new Error("Invalid generated identity snapshot");

	const replacements = new Map<string, string>([
		[previous.repositoryDirectory, identity.repositoryDirectory],
		[previous.displayName, identity.displayName],
		[previous.envPrefix, identity.envPrefix],
		[previous.id, identity.id],
	]);
	const changes: Change[] = [];
	for (const path of filesIn(root)) {
		if (path === join(root, "product.json") || path === join(root, SNAPSHOT)) continue;
		const before = readFileSync(path, "utf8");
		if (before.includes("\0")) continue;
		// Keep links to preserved naming records stable across subsequent product renames.
		let content = before;
		HISTORY.forEach((name, index) => { content = content.replaceAll(name, `\0history-${index}\0`); });
		const matches = [...replacements.keys()].sort((a, b) => b.length - a.length) ;
		const pattern = new RegExp(matches.join("|"), "gu")                          ;
		content = content.replace(pattern, match => replacements.get(match)!);
		HISTORY.forEach((name, index) => { content = content.replaceAll(`\0history-${index}\0`, name); });
		if (content !== before) changes.push({ path, content });
	}
	const snapshot = JSON.stringify(identity, null, "\t") + "\n";
	if (snapshot !== readFileSync(join(root, SNAPSHOT), "utf8")) changes.push({ path: join(root, SNAPSHOT), content: snapshot });

	const moves = ["development/skills", "product/plugin/skills", "product/plugin/scripts", "plugin/skills", "plugin/scripts"].map(parent => ({ from: join(root, parent, previous.id), to: join(root, parent, identity.id) }));
	moves.push({ from: join(root, `.${previous.id}`), to: join(root, `.${identity.id}`) });
	if (basename(root) === previous.repositoryDirectory) moves.push({ from: root, to: join(dirname(root), identity.repositoryDirectory) });
	const actualMoves = moves.filter(move => move.from !== move.to && existsSync(move.from));
	for (const move of actualMoves) {
		if (lstatSync(move.from).isSymbolicLink()) throw new Error(`Refusing symbolic source: ${move.from}`);
		if (existsSync(move.to)) throw new Error(`Rename destination already exists: ${move.to}`);
	}
	const nextRoot        = actualMoves.find(move => move.from === root)?.to ?? root                                 ;
	const linkDirectories = [".codex/skills", ".agents/skills", ".claude/skills"].map(path => join(homedir(), path)) ;
	for (const entry of readdirSync(dirname(root), { withFileTypes: true })) {
		if (!entry.isDirectory()) continue;
		for (const path of [".agents/skills", ".codex/skills", ".claude/skills", "plugins/code-style"]) linkDirectories.push(join(dirname(root), entry.name, path));
	}
	const links: Array<{ from: string; to: string; target: string }> = [];
	for (const directory of linkDirectories) {
		if (!existsSync(directory)) continue;
		for (const entry of readdirSync(directory, { withFileTypes: true })) {
			if (!entry.isSymbolicLink()) continue;
			const from     = join        (directory, entry.name) ;
			const target   = readlinkSync(from                 ) ;
			const absolute = resolve     (directory, target    ) ;
			if (absolute !== root && !absolute.startsWith(root + sep)) continue;
			const suffix        = relative(root, absolute).replaceAll(previous.id, identity.id)                            ;
			const nextAbsolute  = join(nextRoot, suffix)                                                                   ;
			const nextDirectory = directory.startsWith(root + sep) ? join(nextRoot, relative(root, directory)) : directory ;
			const relocatedFrom = join(nextDirectory, entry.name)                                                          ;
			const to            = entry.name === previous.id ? join(nextDirectory, identity.id) : relocatedFrom            ;
			const nextTarget    = isAbsolute(target) ? nextAbsolute : relative(nextDirectory, nextAbsolute)                ;
			if (basename(to) !== entry.name && readdirSync(directory).includes(basename(to))) throw new Error(`Link destination already exists: ${to}`);
			if (to !== relocatedFrom || nextTarget !== target) links.push({ from: relocatedFrom, to, target: nextTarget });
		}
	}

	return { root, identity, changes, moves: actualMoves, links };
}

export function applyProductIdentity(plan: ProductPlan): string {
	for (const change of plan.changes) writeFileSync(change.path, change.content);
	for (const move of plan.moves) renameSync(move.from, move.to);
	for (const link of plan.links) {
		unlinkSync(link.from);
		symlinkSync(link.target, link.to);
	}

	return plan.moves.find(move => move.from === plan.root)?.to ?? plan.root;
}

if (import.meta.main) {
	const args = process.argv.slice(2);
	if (args.some(arg => arg !== "--write" && arg !== "--check") || args.length > 1) throw new Error("usage: sync-product.ts [--write|--check]");
	const plan = planProductIdentity(resolve(import.meta.dir, "..", ".."));
	for (const change of plan.changes) console.log(`update: ${change.path}`);
	for (const move of plan.moves) console.log(`rename: ${move.from} -> ${move.to}`);
	for (const link of plan.links) console.log(`link: ${link.to} -> ${link.target}`);
	if (args.includes("--write")) console.log(`product root: ${applyProductIdentity(plan)}`);
	else if (args.includes("--check") && (plan.changes.length || plan.moves.length || plan.links.length)) process.exitCode = 1;
}
