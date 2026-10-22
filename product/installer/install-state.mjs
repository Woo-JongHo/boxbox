import      {
              lstatSync     ,
              readFileSync  ,
              realpathSync  ,
              renameSync    ,
              unlinkSync    ,
              writeFileSync ,
                              } from "node:fs"   ;
import      { join            } from "node:path" ;

const FILE   = ".boxbox-install-state.json"                          ;
const PHASES = ["prepared", "host-registration-started", "verified"] ;

/** A receipt authorizes cleanup only before any host command can change registration. */
export function installationState(root, metadata) {
	const path     = join(root, FILE)                                                                                                                                ;
	const identity = { schema: 1, root: realpathSync(root), name: metadata.name, version: metadata.version, host: metadata.host, marketplace: metadata.marketplace } ;
	function read() {
		let stat;
		try { stat = lstatSync(path); } catch (error) {
			if (error.code === "ENOENT") return undefined;
			throw error;
		}
		if (!stat.isFile() || stat.isSymbolicLink()) throw new Error(`Reserved installation receipt is not a regular file: ${path}`);
		const value = JSON.parse(readFileSync(path, "utf8"));
		if (!value || Object.entries(identity).some(([key, expected]) => value[key] !== expected) || !PHASES.includes(value.phase)) throw new Error(`Invalid installation receipt: ${path}`);
		return value;
	}
	function create() {
		writeFileSync(path, JSON.stringify({ ...identity, phase: "prepared" }) + "\n", { flag: "wx", mode: 0o600 });
	}
	function advance(phase) {
		const previous = read();
		if (!previous || !["host-registration-started", "verified"].includes(phase) || previous.phase !== "prepared" && !(previous.phase === "host-registration-started" && phase === "verified")) throw new Error(`Invalid installation phase transition at ${path}`);
		const temporary = `${path}.${process.pid}.tmp`;
		writeFileSync(temporary, JSON.stringify({ ...identity, phase }) + "\n", { flag: "wx", mode: 0o600 });
		try { renameSync(temporary, path); } finally {
			try { unlinkSync(temporary); } catch (error) { if (error.code !== "ENOENT") throw error; }
		}
	}
	function remove() {
		if (!read()) throw new Error(`Missing installation receipt: ${path}`);
		unlinkSync(path);
	}
	return { path, read, create, advance, remove };
}
