# Issue, pull request, and candidate pipeline

The current pipeline builds a reviewable release candidate. It does not publish to npm, create a GitHub release,
push a tag, or install plugins into a contributor's active host.

```text
Issue with reproduction or acceptance criteria
  → implementation branch and linked pull request
  → verify / plugin-contract
  → maintainer review and merge
  → manual release-candidate run on the selected source ref
  → the same verification workflow
  → one installer archive + SHA256SUMS + candidate.json
  → Linux / macOS / Windows smoke of that exact archive
  → candidate evidence and remaining release decisions
```

## Issue and pull request entry points

The `.github/ISSUE_TEMPLATE/` forms collect bug reproduction, environment and host versions, preservation failures,
feature acceptance criteria, and candidate evidence. The pull request template links the originating issue, relevant
validation, generated artifact changes, compatibility, and release notes. These templates organize human work;
creating an issue does not execute its content, automatically authorize a formatting rule, or launch a coding agent.

Keep experimental work in an implementation branch. A branch in a visible repository has the repository's visibility;
private work needs a private repository or an unpushed local branch. Candidate artifacts contain the distribution package,
not the development tree. Repository visibility and artifact visibility still follow GitHub access settings.

## Pull request verification

`.github/workflows/verify.yml` runs for pull requests, pushes to `main`, and calls from the candidate workflow. It keeps
the existing Ubuntu/macOS parser/toolchain coverage, pins Node.js 22.22.3 and Bun 1.4.0, installs the frozen Bun lockfile,
primes the npm cache for real offline artifact installation tests, checks generated plugin drift, and runs `bun run check`
with `BOXBOX_REQUIRE_PARSERS=1`. Required parsers must be present; skipped local checks are not substituted for this CI gate.

Workflows use read-only repository permissions, checkout without persisted credentials, explicit timeouts, and
full commit pins for external actions. Superseded runs of the same PR/ref verification are canceled. Candidate runs
for the same ref keep the running job and at most the newest pending run; a newer dispatch replaces an older pending
run. No workflow runs with `pull_request_target` or publishing secrets.

## Creating and inspecting a candidate

After these files are available on GitHub's default branch, use **Actions → release-candidate → Run workflow** and
select the source branch/ref. GitHub must have the workflow on its default branch before manual dispatch is available.
The candidate run calls the same verification workflow before packaging. It builds the installer once for delivery,
requires the source checkout to stay clean, and stages three files from that completed build:

- `boxbox-plugin-<version>.tgz`: the exact outer installer archive.
- `SHA256SUMS`: the archive SHA-256 and filename.
- `candidate.json`: package identity, version, archive bytes/digest, source commit/ref/repository, dirty status,
  build runtime, workflow run identity, and explicit limitations.

The staging tool checks the archive's actual package name/version against `product.json` and `package.json`.
It does not rebuild the package. Local reproduction after a completed build is:

```bash
bun run pack:installer
bun development/tools/release-candidate.ts
```

Source metadata explicitly describes the staging checkout. Local staging records a dirty worktree truthfully, but
cannot establish which checkout built an existing same-version archive; its build provenance remains unverified.
Run packaging immediately before staging for local experiments. Only the CI job's clean checkout, preceding build,
and same-job staging establish the source/build relationship in this pipeline.
The existing verification suite separately builds disposable packages for its integration tests. Those test packages
are not the delivery archive.

The workflow stores the candidate artifact for 14 days. Download it from that workflow run, retain the source commit,
version, and digest in the release issue, and link the three smoke reports. A successful package upload alone does not
mean candidate acceptance: the entire workflow, including every smoke matrix entry, must pass.

## Native archive smoke

Each smoke job downloads the uploaded candidate from the same run. The expected SHA-256 comes independently from the
package job output; the smoke script checks the metadata, byte count, checksum receipt, and actual archive digest
before extraction or execution. A mismatch fails before installation. A manual reproduction is:

```bash
CANDIDATE_SHA256=<digest-from-the-build-record> node development/tools/release-smoke.mjs dist/release-candidate
```

The Node-only smoke uses temporary XDG data/config, Windows local data, Codex home, and npm cache directories. It calls
the real installer with `--engine-only`, then the permanent installed launcher. It checks `init` and `doctor`, followed
by the approved TypeScript declaration and Python assignment examples with both LF and CRLF endings. Each example
must be detected, previewed without changing the original, formatted to the exact approved output, rechecked clean,
and formatted again without byte changes. Parser and approval checks must report that they ran. Temporary installation
and project directories are removed afterward; a per-platform JSON report remains in the candidate directory and
is uploaded as a separate smoke artifact.

This matrix measures the installed engine journey on Linux, macOS, and native Windows. It does not claim that the full
development test suite runs on Windows. `--engine-only` skips host registration and actual Codex/Claude hook events;
host discovery, native hook-event delivery, UI/HUD acceptance, and the 0.2.0 marketplace-source migration require
separate real-host evidence. A green candidate is not a public release readiness decision.

## GitHub installation and later publication

At inspection time on 2026-10-21, the local `origin` points to the self-hosted repository and GitHub
`Woo-JongHo/rowgrid` is private with `main` as its default branch. Pushing to the self-hosted origin does not install
GitHub workflows. These files must be pushed or mirrored to the intended GitHub repository and merged into its default
branch before GitHub can show the forms and run the pipeline. The integration PR preserves GitHub main ancestry, its MIT LICENSE, and contribution/rule-proposal intake while migrating active code into the current layout. Adding these files does not itself publish a release.

After the first real GitHub run, configure the actual `verify / plugin-contract` check as required in the repository's
branch protection/ruleset, require the intended review policy, and disable direct pushes if desired. Check the exact
status name in the first run before making it required; a guessed required name can block every merge. These are
GitHub repository settings, separate from the checked-in workflow.

Publishing remains separate because the repository/product license, package ownership, public channel, and explicit
publication authorization are unresolved. A later publishing job should use a protected environment and consume the
same tested archive after verifying its recorded digest, without rebuilding. No npm token or publishing secret is
needed for the current candidate pipeline.

## Primary references

- [GitHub workflow syntax](https://docs.github.com/en/actions/reference/workflows-and-actions/workflow-syntax)
- [Reusable workflows](https://docs.github.com/en/actions/how-tos/reuse-automations/reuse-workflows)
- [Artifact upload, download, and integrity](https://docs.github.com/en/actions/tutorials/store-and-share-data)
- [Issue form syntax](https://docs.github.com/en/communities/using-templates-to-encourage-useful-issues-and-pull-requests/syntax-for-issue-forms)

External action commit references were resolved through the official repositories' GitHub API on 2026-10-21.
Local validation and native smoke evidence are recorded separately from an actual GitHub Actions run.
