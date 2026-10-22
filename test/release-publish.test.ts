import { expect, test } from "bun:test";
import { readFileSync    } from "node:fs";
import { parse           } from "yaml";

import { releaseNotes } from "../development/tools/release-notes.ts";

const source    = readFileSync(new URL("../.github/workflows/release.yml", import.meta.url), "utf8"                        ) ;
const workflow  = parse       (source                                                                                      ) ;
const candidate = parse       (readFileSync(new URL("../.github/workflows/release-candidate.yml", import.meta.url), "utf8")) ;

const CHANGELOG = ["# Changelog", "", "## [Unreleased]", "", "- next", "", "## [0.2.5] - 2026-10-22", "", "### Fixed", "", "- a fix", "", "## [0.2.4]", "", "- older"].join("\n");

test("the release workflow runs only for pushed v* tags and holds write access in the draft job alone", () => {
	expect(workflow.on                   ).toEqual({ push: { tags: ["v*"] } }) ;
	expect(workflow.permissions          ).toEqual({ contents: "read" }       ) ;
	expect(workflow.jobs.guard.permissions).toBeUndefined()                    ;
	expect(workflow.jobs.candidate.permissions).toBeUndefined()                ;
	expect(workflow.jobs.draft.permissions).toEqual({ contents: "write" }     ) ;
});

test("the release reuses the candidate workflow and only ever creates a draft", () => {
	expect(workflow.jobs.candidate.uses                   ).toBe   ("./.github/workflows/release-candidate.yml") ;
	expect(workflow.jobs.draft.needs                      ).toEqual(["guard", "candidate"]                     ) ;
	expect(Object.keys(candidate.on.workflow_call.outputs)).toEqual(["sha256", "artifact-id"]                  ) ;
	const create = workflow.jobs.draft.steps.find((step: any) => step.name === "Create the draft release").run as string;
	expect(create)    .toContain("--draft"                               ) ;
	expect(create)    .toContain("--verify-tag"                          ) ;
	expect(source).not.toMatch  (/npm publish|--latest|prerelease=false/u) ;
	expect(source).not.toContain("NODE_AUTH_TOKEN"                       ) ;
});

test("release notes come from the matching CHANGELOG section and stop at the next one", () => {
	expect(releaseNotes(CHANGELOG, "0.2.5")).toBe("### Fixed\n\n- a fix\n");
	expect(releaseNotes(CHANGELOG, "0.2.4")).toBe("- older\n"              );
});

test("release notes refuse a missing, empty or look-alike version section", () => {
	expect(() => releaseNotes(CHANGELOG, "0.2.6")                        ).toThrow("no \"## [0.2.6]\" section") ;
	expect(() => releaseNotes(CHANGELOG, "0x2y5")                        ).toThrow("no \"## [0x2y5]\" section") ;
	expect(() => releaseNotes("## [1.0.0]\n\n## [0.9.0]\n- x\n", "1.0.0")).toThrow("is empty"                 ) ;
});
