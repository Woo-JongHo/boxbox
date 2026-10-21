import      { spawnSync               } from "node:child_process" ;
import      { createHash              } from "node:crypto"        ;
import      {
              appendFileSync        ,
              copyFileSync          ,
              mkdirSync             ,
              readFileSync          ,
              rmSync                ,
              writeFileSync         ,
                                      } from "node:fs"            ;
import      { basename, join, resolve } from "node:path"          ;

const ROOT = resolve(import.meta.dir, "../..");

function command(root: string, executable: string, args: readonly string[]): string {
	const child = spawnSync(executable, args, { cwd: root, encoding: "utf8", timeout: 30_000, maxBuffer: 1024 * 1024 });
	if (child.error) throw child.error;
	if (child.status !== 0) throw new Error(`${executable} failed: ${child.stderr}`);

	return child.stdout.trim();
}

/** Stage an already built archive; this never builds, publishes, or registers a plugin. */
export function stageCandidate(root = ROOT) {
	const product  = JSON.parse(readFileSync(join(root, "product.json"), "utf8")) as { npmName: string }                            ;
	const release  = JSON.parse(readFileSync(join(root, "package.json"), "utf8")) as { version: string }                            ;
	const packed   = JSON.parse(readFileSync(join(root, "dist/installer/pack-result.json"), "utf8")) as Array<{ filename: string }> ;
	const filename = packed[0]?.filename                                                                                            ;
	if (packed.length !== 1 || !filename || basename(filename) !== filename || !/^[a-z0-9][a-z0-9._-]*\.tgz$/u.test(filename)) throw new Error("Expected one installer archive with a safe filename.");
	const archive  = join(root, "dist/installer", filename)                                                                           ;
	const manifest = JSON.parse(command(root, "tar", ["-xOf", archive, "package/package.json"])) as { name: string; version: string } ;
	if (manifest.name !== product.npmName || manifest.version !== release.version) throw new Error("Archive identity does not match product.json and package.json.");
	const bytes  = readFileSync(archive)                            ;
	const sha256 = createHash("sha256").update(bytes).digest("hex") ;
	const metadata = {
		schemaVersion : 1,
		name          : manifest.name,
		version       : manifest.version,
		filename,
		sha256,
		bytes: bytes.byteLength,
		source: {
			scope      : "staging-checkout",
			commit     : command(root, "git", ["rev-parse", "HEAD"]),
			ref        : process.env.GITHUB_REF ?? command(root, "git", ["rev-parse", "--abbrev-ref", "HEAD"]),
			repository : process.env.GITHUB_REPOSITORY ?? null,
			dirty      : command(root, "git", ["status", "--porcelain"]).length > 0,
		},
		build: {
			createdAt  : new Date().toISOString(),
			node       : command(root, "node", ["--version"]),
			bun        : Bun.version,
			runId      : process.env.GITHUB_RUN_ID ?? null,
			runAttempt : process.env.GITHUB_RUN_ATTEMPT ?? null,
		},
		limitations: ["Candidate only; no registry publication.", "Source identity describes the staging checkout. Only the clean CI workflow binds its preceding build to that checkout; local archive build provenance is unverified.", "Engine-only smoke does not verify native host hook-event delivery."],
	};
	const destination = join(root, "dist/release-candidate");

	rmSync(destination, { recursive: true, force: true });
	mkdirSync(destination, { recursive: true });
	copyFileSync(archive, join(destination, filename));
	writeFileSync(join(destination, "candidate.json"), JSON.stringify(metadata, null, "\t") + "\n");
	writeFileSync(join(destination, "SHA256SUMS"), `${sha256}  ${filename}\n`);

	return metadata;
}

if (import.meta.main) {
	const metadata = stageCandidate();
	if (process.env.GITHUB_OUTPUT) appendFileSync(process.env.GITHUB_OUTPUT, `sha256=${metadata.sha256}\n`);

	console.log(JSON.stringify(metadata, null, "\t"));
}
