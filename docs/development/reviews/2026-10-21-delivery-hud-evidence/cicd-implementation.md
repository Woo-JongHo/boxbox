# BoxBox candidate pipeline implementation

Date: 2026-10-21
Owner: `/root/candidate_pipeline`
Branch at start: `m1-safety-proof`, source HEAD `34581a76384e91317b3563e475f564a3fb55778c`.
The pre-existing dirty 0.2.1 first-use changes were preserved. No commit, push, merge, tag, publication, GitHub settings,
or active host installation was performed by this worker.

## Scope and files

The user confirmed issue forms -> PR verification -> candidate generation. No automatic issue-to-code execution or
registry publishing was added.

1. `.github/ISSUE_TEMPLATE/bug.yml`: BoxBox version/install command, OS/runtime/host versions, minimal reproduction,
   expected/actual result, explicit preservation/write-safety category, and sanitized output.
2. `.github/ISSUE_TEMPLATE/feature.yml`: problem, proposed behavior, acceptance criteria and counterexamples.
3. `.github/ISSUE_TEMPLATE/release.yml`: candidate commit/version, linked changes, evidence checklist, all three
   platform digest checks, independent review, host limitations and separate publication decisions.
4. `.github/ISSUE_TEMPLATE/config.yml`: permits free-form issues in addition to the forms.
5. `.github/pull_request_template.md`: originating issue, validation, generated source/artifact contract, user impact,
   review and candidate evidence.
6. `.github/workflows/verify.yml`: preserves Ubuntu parser setup and `BOXBOX_REQUIRE_PARSERS=1`, adds `workflow_call`,
   explicit read-only permissions, no persisted checkout credentials, concurrency and timeout, action SHA pins, and
   generated plugin drift checking before the existing full check.
7. `.github/workflows/release-candidate.yml`: manual only; calls the same verify workflow; builds the delivery archive
   once; requires clean tracked/untracked source state; stages archive/checksum/source metadata; uploads the candidate;
   all three native OS smoke jobs download that same artifact and receive the independently retained build digest.
8. `development/tools/release-candidate.ts`: stages an already built archive; reads its actual package identity via tar,
   checks package name/version against product identity, records source and runtime/run metadata and exact bytes/SHA-256.
   It never builds or publishes. The entry point writes the digest to `GITHUB_OUTPUT` when available.
9. `development/tools/release-smoke.mjs`: Node-only digest gate before extraction/execution, real `--engine-only`
   install under isolated temporary XDG/config/local-data/Codex/npm directories, permanent launcher invocation,
   doctor plus approved TS/Python LF/CRLF preview/write/recheck/idempotence journey. Writes native JSON evidence and
   removes temporary install/project directories. No native host registration or hook-event acceptance is claimed.
10. `test/release-candidate.test.ts`: four meaningful provenance/identity/integrity regressions, including changed bytes,
    replaced metadata digest, missing independent digest, and escaping filename refusal before candidate installation.
11. `docs/development/cicd.md`: concrete issue/branch/PR/manual candidate operation, archive promotion contract,
    CI versus local/native support limits, GitHub/self-hosted remote distinction, branch-protection follow-up and deferred publication.

No `package.json` edits are needed: the workflows invoke the tools directly. Optional convenience scripts, if desired,
are `candidate:stage = bun development/tools/release-candidate.ts` and
`candidate:smoke = node development/tools/release-smoke.mjs dist/release-candidate` (requires `CANDIDATE_SHA256`).

## Executed verification

- Applied the repository TypeScript aligner to both new TS files. Both parsed successfully with two passes.
- `bun test test/release-candidate.test.ts --timeout 60000`: **4 pass / 0 fail / 11 assertions**.
  Full output: `/tmp/boxbox-cicd-focused-tests-20261021.log`.
- `bunx tsc --noEmit`: exit 0.
- `node --check development/tools/release-smoke.mjs`: exit 0.
- `bun run sync:plugin -- --check`: exit 0.
- `bun run check:layout`: product dependencies PASS, exit 0.
- `actionlint` 1.7.12, official darwin/arm64 release binary:
  `/tmp/boxbox-actionlint-20261021/actionlint -color .github/workflows/verify.yml .github/workflows/release-candidate.yml`
  returned exit 0 with no findings. Output file: `/tmp/boxbox-cicd-actionlint-20261021.log` (empty because successful).
- Parsed all issue-form YAML with Bun's YAML parser, checked form shape and duplicate IDs:
  `/tmp/boxbox-cicd-issue-forms-20261021.log` (all four files parsed).
- Checked touched files directly for TODO/focused/skipped test placeholders: none.
- `git diff --check` for owned paths: exit 0.

## Exact archive local acceptance

The delivery archive was already built and verified by FIRSTUSE1; this worker staged that existing archive without
rebuilding it. The local provenance record truthfully reports a dirty source tree and is local evidence, not a GitHub run.

- Archive: `boxbox-plugin-0.2.1.tgz`, 126110 bytes.
- SHA-256: `6fc35d7c92f6eeb1b442d6d21901ed6f27c06e9654f412750b4530b638b89b8f`.
- Full local metadata: `/tmp/boxbox-cicd-local-candidate-20261021.json`.
- Full local native smoke result: `/tmp/boxbox-cicd-macos-smoke-20261021.json`.
- Native runtime: macOS arm64, Node.js 22.22.3, Python 3.14.2.
- Result: digest passed before extraction; real engine-only installation passed; doctor runtime and preset readiness
  passed with `releaseReady: false`; all four TS/Python LF/CRLF inputs passed unchanged preview, exact approved output,
  parser/approval verification, clean recheck and byte-identical repeated format.
- The isolated temporary workspace was cleaned by the smoke tool.

The matrix is configured but GitHub Actions has not been run or claimed green. Linux/Windows execution of this new smoke
script is unexecuted in this worker's pass. Parent owns combined full check, Sonnet review, final Opus audit and remote
delivery. The manual workflow must first exist on the default branch before GitHub offers workflow_dispatch.

## Primary documentation and measured external APIs

Read official GitHub documentation:

- https://docs.github.com/en/actions/reference/workflows-and-actions/workflow-syntax
- https://docs.github.com/en/actions/how-tos/reuse-automations/reuse-workflows
- https://docs.github.com/en/actions/tutorials/store-and-share-data
- https://docs.github.com/en/communities/using-templates-to-encourage-useful-issues-and-pull-requests/syntax-for-issue-forms

Verified these action refs through the official repositories' GitHub REST API:

| Action ref | Resolved commit |
| --- | --- |
| actions/checkout v4 | 11d5960a326750d5838078e36cf38b85af677262 |
| actions/setup-node v7 | 949feb2413d6458794dcd2491c4babbbce0c15c1 |
| oven-sh/setup-bun v2 | 0c5077e51419868618aeaa5fe8019c62421857d6 |
| actions/setup-go v5 | 40f1582b2485089dde7abd97c1529aa768e1baff |
| actions/setup-java v4 | cf277c60eb25467037889841efdb72551f06f6c3 |
| dtolnay/rust-toolchain stable | b725eda525362e7cf34af9a7243cac1e3f01a7ec |
| swift-actions/setup-swift v2 | 7ca6abe6b3b0e8b5421b88be48feee39cbf52c6a |
| actions/setup-python v6 | ece7cb06caefa5fff74198d8649806c4678c61a1 |
| actions/upload-artifact v4 | ea165f8d65b6e75b540449e92b4886f43607fa02 |
| actions/download-artifact v4 | d3f86a106a0bac45b974a628896c90dbdf5c8093 |

Verified the official `actions/python-versions/installers/win-setup-template.ps1` source creates the actual python3.exe
symlink to python.exe (lines 140-141 at inspection), so no speculative Windows parser shim was added. The workflow
explicitly executes `python3 --version` after setup-python and fails if it is unavailable.

## Integration notes

- Parent may add optional package script aliases, but workflows require none.
- Parent should keep the existing separate public license/registry ownership decision; this implementation introduces no publishing secrets.
- The root reported adding a separate `github` remote while leaving `origin` unchanged. That does not mean the workflows
  have been pushed or activated; docs retain the precise default-branch/first-run distinction.
- Candidate metadata is bound to the actual uploaded tarball digest and clean workflow checkout. Future publication
  must consume that same verified archive rather than rebuilding.
