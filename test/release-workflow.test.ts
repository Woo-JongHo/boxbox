import      { expect, test } from "bun:test"           ;
import      { spawnSync    } from "node:child_process" ;
import      { readFileSync } from "node:fs"            ;
import      { parse        } from "yaml"               ;

const workflow = parse(readFileSync(new URL("../.github/workflows/release-candidate.yml", import.meta.url), "utf8")) ;
const producer = workflow.jobs.package                                                                               ;
const consumer = workflow.jobs.smoke                                                                                 ;
const upload   = producer.steps.find((step: any) => step.uses?.startsWith("actions/upload-artifact@"))               ;
const download = consumer.steps.find((step: any) => step.uses?.startsWith("actions/download-artifact@"))             ;
const guard    = consumer.steps.find((step: any) => step.name === "Require one immutable candidate artifact")        ;

test("partial smoke reruns consume the producer artifact ID without guessing the current attempt", () => {
	expect(upload.id                      ).toBe("upload"                                  ) ;
	expect(producer.outputs["artifact-id"]).toBe("${{ steps.upload.outputs.artifact-id }}" ) ;
	expect(consumer.needs                 ).toBe("package"                                 ) ;
	expect(download.with["artifact-ids"]  ).toBe("${{ needs.package.outputs.artifact-id }}") ;
	expect(download.with.name).toBeUndefined();
	expect(download.with["merge-multiple"]                                                                                           ).toBe   (true                                               ) ;
	expect(download.with.path                                                                                                        ).toBe   ("dist/release-candidate/"                          ) ;
	expect(consumer.strategy.matrix.os                                                                                               ).toEqual(["ubuntu-latest", "macos-latest", "windows-latest"]) ;
	expect(consumer.steps.find((step: any) => step.run?.startsWith("node development/tools/release-smoke.mjs"))?.env.CANDIDATE_SHA256).toBe   ("${{ needs.package.outputs.sha256 }}"              ) ;
});

test("the actual pre-download guard rejects missing or ambiguous identity before the action can download all artifacts", () => {
	expect(guard).toBeDefined();
	expect(consumer.steps.indexOf(guard)  ).toBeLessThan(consumer.steps.indexOf(download)          ) ;
	expect(guard.env.CANDIDATE_ARTIFACT_ID).toBe        ("${{ needs.package.outputs.artifact-id }}") ;
	expect(guard.env.CANDIDATE_SHA256     ).toBe        ("${{ needs.package.outputs.sha256 }}"     ) ;

	const match = /^node -e '([\s\S]+)'\s*$/.exec(guard.run);

	expect(match).not.toBeNull();

	function execute(id: string, sha256 = "e".repeat(64)) {
		return spawnSync("node", ["-e", match![1]!], {
			encoding: "utf8",
			env: { ...process.env, CANDIDATE_ARTIFACT_ID: id, CANDIDATE_SHA256: sha256 },
		});
	}

	for (const id of ["", " ", "0", "01", "-1", "1,2", "123junk", "1\n", "9007199254740992"]) {
		const result = execute(id);

		expect(result.status).toBe(1);
		expect(result.stderr).toContain("One valid candidate artifact ID is required");
	}
	for (const sha256 of ["", "A".repeat(64), "e".repeat(63), "e".repeat(64) + "\n"]) {
		const result = execute("12366659186", sha256);

		expect(result.status).toBe(1);
		expect(result.stderr).toContain("An independent candidate SHA-256 is required");
	}

	expect(execute("12366659186").status).toBe(0);
});
