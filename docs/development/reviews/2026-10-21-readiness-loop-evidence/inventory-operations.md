# BoxBox operations readiness inventory

Date: 2026-10-21 Asia/Seoul
Mode: read-only discovery. No repository/profile/remote mutation, publication, message, commit, or push was performed.

## Executive verdict

The repository has strong historical operational evidence, but it is not ready to call the current 0.2.4 worktree a release candidate. The only completed GitHub same-archive Linux/macOS/Windows candidate run is 0.2.2. Current 0.2.4 evidence covers local checks, isolated Codex/Claude installation and installed Guide/Align/Check, plus Sonnet and user-authorized GLM static audits for AUTHOR1. It does not bind the dirty 0.2.4 worktree to a clean CI build, native cross-platform smoke, native hook/HUD acceptance, update/removal, or a published registry artifact.

The active task remains AUTHOR1. HUD2 is deferred; CODEX1 native acceptance and release work remain open. Do not treat the older REL table literally without reconciling it with the newer active sections: it still describes several already-implemented areas as pending and retains old versions.

## Version/evidence separation

| Version | What is actually evidenced | What it does not prove |
| --- | --- | --- |
| 0.2.2 | GitHub release-candidate run 39543872402; exact archive `611858...7137`; engine-only installed TS/Python smoke on Linux/macOS/Windows; native macOS Codex hook control flow; Windows SessionStart delivery; delivery hashes | Current source; Windows edit-dependent hooks; Claude event delivery; HUD; publication |
| 0.2.3 | Local unpublished installer; native macOS Codex tmux HUD and Claude statusLine ready/not-ready/recovery captures; both active local plugins are 0.2.3 | Independent HUD review (Sonnet/Opus attempts were session-limited); Windows/desktop HUD; current 0.2.4 behavior |
| 0.2.4 | Unpublished AUTHOR1 archive, 142346 bytes, evidence digest `d621cf...a0a`; isolated dual-host Guide/Align/Check; 571-test later matrix record; Sonnet and user-selected GLM 5.3 static audits passed | Clean-source provenance; GitHub CI/cross-OS candidate; active-profile install; broad native skill activation; authoring quality; HUD revalidation; registry install |

There are multiple generated 0.2.4 archives. The evidence candidate digest (`d621cf...`) differs from the current `dist/installer/boxbox-plugin-0.2.4.tgz` digest (`32eeff...`). Rebuild/freeze exactly once from the final clean source and record that single archive; do not reuse a stale local `dist/release-candidate`, which currently describes 0.2.1.

## Exact remaining gaps

### HUD and native hosts

- HUD2's 0.2.3 macOS terminal implementation is exercised, but its required independent review remains unexecuted. The user's current rule permits Sonnet independent review and selects GLM instead of Opus for the final audit; a fresh review should explicitly audit the HUD scope, since AUTHOR1's Sonnet/GLM reports say the prior HUD blocker remains separate.
- Codex HUD is explicitly macOS/Linux terminal-only and requires the `boxbox-codex` tmux launcher. Ordinary `codex` is unchanged. Tests deliberately reject `win32`; desktop and Windows need separate adapters/evidence or must be excluded from the support table.
- Claude statusLine is native and opt-in on macOS; native Claude hook-event delivery is still unmeasured.
- Codex 0.2.2 native evidence: macOS PostToolUse/Stop and recovery pass; Windows 0.157.1 editing was blocked by the host's effective read-only/approval-never policy. A writable native Windows run is required for PostToolUse FAIL, Stop continuation and recovery, unless Windows hooks are explicitly excluded.
- Persistent active-profile hook trust and active desktop behavior are unverified. Active macOS Codex and Claude plugins are both 0.2.3, not 0.2.4.
- AUTHOR1 isolated launchers prove CLI behavior, not real skill selection, native Write/Refactor conversations, error presentation, or authoring quality/performance.

### Windows and OS support

- The GitHub matrix exercises the exact archive with `--engine-only`; it intentionally skips registration, host discovery, hook delivery and HUD.
- Windows installer path/quoting/discovery tests exist and prior native explicit CLI formatting passed, but the current 0.2.4 archive has no native Windows run.
- Full Windows development-suite support is not claimed. The final support matrix still needs exact OS/architecture/Node/Python/host versions and explicit exclusions.
- Linux has CI engine smoke, but no native Codex/Claude host/HUD acceptance. macOS carries most native evidence.
- REL10 lifecycle remains incomplete: update, rollback and removal on supported combinations, including preservation of user config/approval data and residue checks.

### CI and candidate provenance

- GitHub private repository `Woo-JongHo/rowgrid` is reachable; default `main` is `07f568c`; latest verify run 39549363387 passed. No tag or GitHub release exists.
- Current source is a heavily dirty worktree based on `07f568c`. The latest hosted runs therefore do not cover current changes.
- The release-candidate workflow is ready to dispatch only after the final changes and workflow are committed/pushed to a ref, with the workflow present on default branch. It verifies, packages once, checks clean checkout, records digest, then smokes the downloaded exact archive on Ubuntu/macOS/Windows.
- Private-plan branch protection previously returned 403; checks can run, but required-check enforcement is unavailable unless the plan/visibility changes.
- Workflow smoke is intentionally narrow: TypeScript/Python engine-only, Node 22.22.3, Python 3.13. It is not host/HUD acceptance or a full Windows suite.
- A current clean 0.2.4 workflow dispatch and downloaded artifact/evidence set is required. Existing successful run 39543872402 is 0.2.2 only.

### Release and publishing

- `package.json` is 0.2.4; no git tags, GitHub releases or npm package exist.
- `boxbox-plugin` currently returns npm E404, so the name appears unoccupied but is not reserved.
- `npm whoami` now returns E401. The historical `woojongho` authentication evidence is stale; npm authentication/publication access must be re-established and verified immediately before publish.
- Publishing remains an external state change requiring explicit user approval. The existing workflow contains no publishing job or secrets, by design.
- License/channel/support/version freeze is inconsistent in the docs: GitHub main inherited MIT LICENSE, but release/status text still calls license/channel undecided. Resolve and make package/plugin/docs metadata agree before publication.
- REL11 still needs a final public allowlist, license check, secret/private-data scan, lockfile/digest evidence, install/update/removal documentation and final support matrix.
- REL12 needs release commit/tag/publish, digest comparison between approved archive and registry/marketplace, then fresh external `npx boxbox-plugin` install/host/update-removal smoke and rollback/halt procedure.

### Private data and public payload

- Existing tests establish that the installer has an exact host payload allowlist, user DB contents remain outside the artifact, `db status` reports only counts/bytes, and the research corpus/cache is not packaged.
- The CLI runtime bundle is public by design; it is not a way to keep implementation private.
- Before release, scan the exact packed archive rather than only the tree. Explicitly exclude `.gjc/`, `stress/`, local corpus configuration, scratch/evidence not intended for distribution, host profiles, credentials, and user JSONL data. Verify archive listing plus secret scan.
- Private GitHub Actions artifacts inherit repository visibility, but candidate artifacts still contain distributable code and should be handled according to the intended channel.

## Ready-to-run verification commands

Run locally after the worktree has reached the intended final source:

```bash
git status --short --branch
bun install --frozen-lockfile
bun run check
bun run sync:plugin
git diff --check
bun run pack:installer
bun test test/installer-artifact.test.ts test/release-candidate.test.ts test/product-hud.test.ts test/hud-installation.test.ts test/codex-hud-launcher.test.ts
claude plugin validate --strict ./plugin
claude plugin validate --strict .
```

Build/stage a local diagnostic candidate only after packaging:

```bash
bun development/tools/release-candidate.ts
CANDIDATE_SHA256=<digest-from-candidate-record> node development/tools/release-smoke.mjs dist/release-candidate
```

The local candidate is diagnostic unless built from a clean checkout. The authoritative cross-OS sequence is:

```bash
gh workflow run release-candidate.yml -R Woo-JongHo/rowgrid --ref <final-pushed-ref>
gh run watch -R Woo-JongHo/rowgrid <run-id> --exit-status
gh run download -R Woo-JongHo/rowgrid <run-id> --dir <fresh-evidence-dir>
```

Then verify the downloaded candidate metadata/SHA256 and all three smoke JSON files, and use that exact archive for native host/lifecycle testing. Do not rebuild between CI and native acceptance.

Useful read-only publication checks immediately before an approved release:

```bash
npm whoami
npm view boxbox-plugin name version dist-tags --json
npm pack --dry-run ./dist/installer-package
tar -tzf <approved-boxbox-plugin-archive>
gh release list -R Woo-JongHo/rowgrid
git ls-remote --tags github
```

## Real external prerequisites

1. Final intended source committed and pushed to a GitHub ref; default branch must contain the manual workflow definition.
2. GitHub Actions access on the private repository; required-check enforcement additionally needs GitHub Pro or public visibility, but is not required merely to run CI.
3. A native Windows machine/profile with a Codex configuration that actually permits the controlled workspace edit, or an explicit support exclusion. The existing read-only host policy cannot prove edit-dependent events.
4. Native host installations for each supported host/OS combination, including Claude if claimed; tmux is required for the Codex terminal HUD on macOS/Linux.
5. Fresh npm authentication and confirmed ownership/publication rights for `boxbox-plugin`; the current machine is E401.
6. User decisions freezing license, public channel, support matrix and publication. Actual tag/release/npm publish requires explicit approval.
7. Sonnet review plus user-selected GLM final audit for the still-open HUD/release scope. Existing AUTHOR1 audits do not close HUD2 or the full product release.

## Recommended operational order

1. Finish AUTHOR1 acceptance and reconcile active plan/status/release contract, including version, license/channel and support exclusions.
2. Run local full checks and targeted HUD/installer/release tests; remove placeholder/skipped-test blockers in changed files if any are found.
3. Commit/push final source, dispatch the current release-candidate workflow, download and freeze the exact archive/digest.
4. Run native macOS/Linux/Windows host scenarios against that archive, including declared HUD surfaces and update/removal preservation.
5. Run independent Sonnet review and GLM final audit over the exact final diff, artifacts and evidence.
6. Obtain explicit publication approval, refresh npm auth, publish without rebuilding, verify registry digest, tag/release, and perform external installation smoke.

## Sources inspected

- `docs/development/{plan,status,hud,cicd,release-contract}.md`
- HUD, native-hook, AUTHOR1 and GitHub delivery review/evidence records dated 2026-10-21
- `.github/workflows/{verify,release-candidate}.yml`
- `development/tools/{release-candidate.ts,release-smoke.mjs}`
- HUD, installer, public-artifact, platform and release-candidate tests
- Read-only local `git`, Codex/Claude plugin listing, GitHub CLI/API, npm registry/auth and archive metadata checks
