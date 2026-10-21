import      { afterEach, expect, test } from "bun:test"                                  ;
import      { spawnSync               } from "node:child_process"                        ;
import      { createHash              } from "node:crypto"                               ;
import      {
              mkdirSync             ,
              mkdtempSync           ,
              readFileSync          ,
              rmSync                ,
              writeFileSync         ,
                                      } from "node:fs"                                   ;
import      { tmpdir                  } from "node:os"                                   ;
import      { join                    } from "node:path"                                 ;
import      { stageCandidate          } from "../development/tools/release-candidate.ts" ;

const roots: string[] = [];

function command(root: string, executable: string, args: string[]) {
	const child = spawnSync(executable, args, { cwd: root, encoding: "utf8" });
	if (child.error) throw child.error;
	if (child.status !== 0) throw new Error(`${executable} failed: ${child.stderr}`);

	return child.stdout.trim();
}

function fixture(archiveName = "boxbox-plugin") {
	const root        = mkdtempSync(join(tmpdir(), "boxbox-candidate-test-")) ;
	const installer   = join(root, "dist/installer")                          ;
	const packageRoot = join(root, "dist/source/package")                     ;
	const filename    = "boxbox-plugin-1.2.3.tgz"                             ;

	roots.push(root);
	mkdirSync(installer, { recursive: true });
	mkdirSync(packageRoot, { recursive: true });
	writeFileSync(join(root, ".gitignore"), "dist/\n");
	writeFileSync(join(root, "product.json"), JSON.stringify({ npmName: "boxbox-plugin" }));
	writeFileSync(join(root, "package.json"), JSON.stringify({ version: "1.2.3" }));
	writeFileSync(join(packageRoot, "package.json"), JSON.stringify({ name: archiveName, version: "1.2.3" }));
	writeFileSync(join(installer, "pack-result.json"), JSON.stringify([{ filename }]));
	command(root, "tar", ["-czf", join(installer, filename), "-C", join(packageRoot, ".."), "package"]);
	command(root, "git", ["init", "--quiet"]);
	command(root, "git", ["add", "."]);
	command(root, "git", ["-c", "user.name=Candidate test", "-c", "user.email=candidate@example.invalid", "-c", "commit.gpgsign=false", "commit", "--quiet", "-m", "Create candidate fixture"]);

	return { root, filename, directory: join(root, "dist/release-candidate") };
}

afterEach(() => {
	for (const root of roots.splice(0)) rmSync(root, { recursive: true, force: true });
});

test("candidate staging records the exact prebuilt bytes and commit without rebuilding", async () => {
	const { root, filename, directory } = fixture();
	const original = readFileSync(join(root, "dist/installer", filename))                                  ;
	const metadata = stageCandidate(root)                                                                  ;
	const smoke    = await import(join(import.meta.dir, "../development/tools/release-smoke.mjs"))         ;
	const verified = smoke.verifyCandidate(directory, createHash("sha256").update(original).digest("hex")) ;

	expect(readFileSync(verified.archive)).toEqual(original                                   ) ;
	expect(metadata.source.commit        ).toBe   (command(root, "git", ["rev-parse", "HEAD"])) ;
	expect(metadata.source.dirty         ).toBe   (false                                      ) ;
	expect(metadata.bytes                ).toBe   (original.byteLength                        ) ;
	expect(metadata.name                 ).toBe   ("boxbox-plugin"                            ) ;
	expect(metadata.version              ).toBe   ("1.2.3"                                    ) ;
});

test("candidate staging refuses an archive for another package", () => {
	const { root } = fixture("unrelated-package");

	expect(() => stageCandidate(root)).toThrow("Archive identity does not match");
});

test("smoke refuses altered archive bytes and a replaced metadata digest before installation", async () => {
	const { root, filename, directory } = fixture();
	const metadata = stageCandidate(root)                                                          ;
	const smoke    = await import(join(import.meta.dir, "../development/tools/release-smoke.mjs")) ;
	const archive  = join(directory, filename)                                                     ;
	const bytes    = readFileSync(archive)                                                         ;
	const altered  = Buffer.from(bytes)                                                            ;

	altered[0] = altered[0]! ^ 1;
	writeFileSync(archive, altered);

	expect(() => smoke.smokeCandidate(directory, metadata.sha256)).toThrow("Candidate archive SHA-256 differs");

	writeFileSync(archive, bytes);
	writeFileSync(join(directory, "candidate.json"), JSON.stringify({ ...metadata, sha256: "0".repeat(64) }));

	expect(() => smoke.smokeCandidate(directory, metadata.sha256)).toThrow("Metadata differs from the build job digest");
});

test("smoke requires a separate build digest and refuses an escaping archive filename", async () => {
	const { root, directory } = fixture();
	const metadata = stageCandidate(root)                                                          ;
	const smoke    = await import(join(import.meta.dir, "../development/tools/release-smoke.mjs")) ;

	expect(() => smoke.verifyCandidate(directory, "")).toThrow("An independently supplied SHA-256 is required");

	writeFileSync(join(directory, "candidate.json"), JSON.stringify({ ...metadata, filename: "../candidate.tgz" }));

	expect(() => smoke.verifyCandidate(directory, metadata.sha256)).toThrow("Unsafe archive filename");
});
