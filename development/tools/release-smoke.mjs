import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import { lstatSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { basename, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

/** Digest checks run before extraction, dependency installation, or any candidate execution. */
export function verifyCandidate(directory, expectedSha256) {
	const metadata = JSON.parse(readFileSync(join(directory, "candidate.json"), "utf8"));
	assert.equal(metadata.schemaVersion, 1, "Unsupported candidate metadata schema");
	assert.match(metadata.filename, /^[a-z0-9][a-z0-9._-]*\.tgz$/u, "Unsafe archive filename");
	assert.equal(basename(metadata.filename), metadata.filename, "Archive must be a direct child of the candidate directory");
	assert.match(expectedSha256, /^[a-f0-9]{64}$/u, "An independently supplied SHA-256 is required");
	assert.equal(metadata.sha256, expectedSha256, "Metadata differs from the build job digest");
	const archive = join(directory, metadata.filename);
	const stat = lstatSync(archive);

	assert.ok(stat.isFile() && !stat.isSymbolicLink(), "Candidate archive must be a regular file");
	assert.equal(stat.size, metadata.bytes, "Candidate archive byte count differs");
	assert.equal(createHash("sha256").update(readFileSync(archive)).digest("hex"), expectedSha256, "Candidate archive SHA-256 differs");
	assert.equal(readFileSync(join(directory, "SHA256SUMS"), "utf8"), `${expectedSha256}  ${metadata.filename}\n`, "Checksum receipt differs");

	return { archive, metadata };
}

function run(executable, args, options, statuses = [0]) {
	const child = spawnSync(executable, args, { encoding: "utf8", timeout: 180_000, maxBuffer: 2 * 1024 * 1024, windowsHide: true, ...options });
	if (child.error) throw child.error;
	assert.ok(statuses.includes(child.status), `${executable} ${args.join(" ")} failed (${child.status ?? child.signal})\n${child.stdout}\n${child.stderr}`);

	return child.stdout.trim();
}

/** Exercise the permanent Node launcher without a host CLI or the author's checkout dependencies. */
export function smokeCandidate(directory, expectedSha256) {
	const { archive, metadata } = verifyCandidate(directory, expectedSha256);
	const workspace = mkdtempSync(join(tmpdir(), "boxbox-release-smoke-"));
	const report = { schemaVersion: 1, ok: false, sha256: expectedSha256, version: metadata.version, platform: process.platform, arch: process.arch, node: process.versions.node, checks: [], limitations: ["Host checks and plugin registration were skipped (--engine-only).", "Native host hook-event delivery was not exercised."] };
	const reportFile = join(directory, `smoke-${process.env.RUNNER_OS ?? process.platform}.json`);

	try {
		const unpacked = join(workspace, "unpacked");
		const profile = join(workspace, "isolated profile");
		const project = join(workspace, "project");
		const environment = {
			...process.env,
			XDG_DATA_HOME: join(profile, "data"),
			XDG_CONFIG_HOME: join(profile, "config"),
			LOCALAPPDATA: join(profile, "local"),
			CODEX_HOME: join(profile, "codex"),
			npm_config_cache: join(profile, "npm-cache"),
		};
		const options = { cwd: project, env: environment };

		for (const path of [unpacked, project, environment.CODEX_HOME]) mkdirSync(path, { recursive: true });
		run("tar", ["-xzf", archive, "-C", unpacked], options);
		const manifest = JSON.parse(readFileSync(join(unpacked, "package/package.json"), "utf8"));

		assert.equal(manifest.name, metadata.name, "Extracted package name differs");
		assert.equal(manifest.version, metadata.version, "Extracted package version differs");
		run(process.execPath, [join(unpacked, "package/bin/boxbox.mjs"), "--engine-only"], options);
		const installation = process.platform === "win32"
			? join(environment.LOCALAPPDATA, "BoxBox", "Codex", metadata.version)
			: join(environment.XDG_DATA_HOME, "boxbox", "codex", metadata.version);
		const launcher = join(installation, "plugin/scripts/boxbox.mjs");
		const cli = (args, statuses = [0]) => JSON.parse(run(process.execPath, [launcher, ...args, "--json"], options, statuses));
		const python = run("python3", ["--version"], options);

		cli(["init"]);
		const doctor = cli(["doctor"]);

		assert.equal(doctor.runtimeUsable, true, "Installed runtime is unusable");
		assert.equal(doctor.formatConfigured, true, "Shipped preset is not ready for standalone formatting");
		assert.equal(doctor.releaseReady, false, "Doctor must not claim public release readiness");
		report.checks.push({ command: "doctor", ok: true, python });

		const examples = [
			{ file: "calls.ts", before: "const short = make(1);\nconst muchLonger = make(22);\nconst middle = make(333);\n", after: "const short      = make(1  ) ;\nconst muchLonger = make(22 ) ;\nconst middle     = make(333) ;\n" },
			{ file: "assignments.py", before: "if enabled:\n  alpha = 1\n  much_longer = 22\n  mid = 333\n", after: "if enabled:\n  alpha       = 1\n  much_longer = 22\n  mid         = 333\n" },
		];

		for (const example of examples) {
			for (const ending of ["LF", "CRLF"]) {
				const filename = `${ending}-${example.file}`;
				const path = join(project, filename);
				const source = ending === "LF" ? example.before : example.before.replaceAll("\n", "\r\n");
				const expected = ending === "LF" ? example.after : example.after.replaceAll("\n", "\r\n");

				writeFileSync(path, source);
				const before = cli(["check", "--file", filename], [1]);

				assert.equal(before.formatReadiness.approvalEligible, true, "Shipped approval did not match");
				assert.ok(before.results[0].summary.misaligned > 0, "The input must exercise real alignment");
				const preview = cli(["format", "--file", filename, "--dry-run"]);

				assert.equal(preview.written, false, "Preview reported a write");
				assert.equal(preview.fixedPoint, true, "Preview did not verify the full fixed point");
				assert.equal(preview.formatMode, "standalone", "An external formatter unexpectedly ran");
				assert.equal(readFileSync(path, "utf8"), source, "Preview changed the input");
				const applied = cli(["format", "--file", filename]);

				assert.equal(applied.written, true, "The approved input was not written");
				assert.equal(applied.safety.parserChecked, true, "The parser gate was not exercised");
				assert.equal(applied.safety.approvalChecked, true, "Approval proof was not exercised");
				assert.equal(readFileSync(path, "utf8"), expected, "Installed output differs from the approved example");
				assert.equal(expected.replaceAll(/\s/gu, ""), source.replaceAll(/\s/gu, ""), "Fixture tokens changed");
				const after = cli(["check", "--file", filename]);
				const repeated = cli(["format", "--file", filename]);

				assert.equal(after.results[0].summary.misaligned, 0, "Recheck still detects misalignment");
				assert.equal(repeated.written, false, "Idempotent format unexpectedly wrote the file");
				assert.equal(readFileSync(path, "utf8"), expected, "Repeated format changed the bytes");
				report.checks.push({ file: filename, previewPreserved: true, approvedOutput: true, recheck: true, idempotent: true });
			}
		}

		report.ok = true;
		return report;
	} catch (error) {
		report.error = error instanceof Error ? error.message : String(error);
		throw error;
	} finally {
		writeFileSync(reportFile, JSON.stringify(report, null, "\t") + "\n");
		rmSync(workspace, { recursive: true, force: true });
	}
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
	if (process.argv.length !== 3) throw new Error("Usage: CANDIDATE_SHA256=<build-job-digest> node development/tools/release-smoke.mjs <candidate-directory>");

	console.log(JSON.stringify(smokeCandidate(resolve(process.argv[2]), process.env.CANDIDATE_SHA256), null, "\t"));
}
