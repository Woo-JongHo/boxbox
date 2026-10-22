import { readFileSync } from "node:fs";

/** Return the body of the `## [version]` section of a Keep a Changelog file; never invents notes. */
export function releaseNotes(changelog: string, version: string): string {
	const lines   = changelog.split(/\r?\n/u)                                                                ;
	const heading = new RegExp(`^## \\[${version.replace(/[.*+?^${}()|[\]\\]/gu, "\\$&")}\\](?:\\s|$)`, "u") ;
	const start   = lines.findIndex(line => heading.test(line))                                              ;
	if (start === -1) throw new Error(`CHANGELOG.md has no "## [${version}]" section; rename [Unreleased] when cutting the release.`);
	const length = lines.slice(start + 1).findIndex(line => line.startsWith("## ["))                        ;
	const body   = lines.slice(start + 1, length === -1 ? undefined : start + 1 + length).join("\n").trim() ;
	if (body === "") throw new Error(`The "## [${version}]" section of CHANGELOG.md is empty.`);

	return body + "\n";
}

if (import.meta.main) {
	const [version, path = "CHANGELOG.md"] = process.argv.slice(2);
	if (!version) throw new Error("Usage: bun development/tools/release-notes.ts <version> [CHANGELOG.md]");
	process.stdout.write(releaseNotes(readFileSync(path, "utf8"), version));
}
