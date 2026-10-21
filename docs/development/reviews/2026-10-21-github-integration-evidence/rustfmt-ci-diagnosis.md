# Rustfmt CI diagnosis

Date: 2026-10-21

## Observed failure

The GitHub macOS run in `/tmp/boxbox-delivery-hud-20261021/github-macos-first.log` installed stable Rust `1.99.1`, commit `58cf8f9c3`, and then ran the Rust parser probe through `product/engine/common/parse-check.ts`.

The configured command was:

```text
rustfmt --edition 2021 --check <temporary Input.rs>
```

The process returned status `1`. The implementation only accepts that status when it finds a specific `Diff in ...Input.rs at line N:` payload plus diff markers. The run reached the fail-closed branch instead:

```text
error: parser exited with unrecognized status (rustfmt): 1
```

The same failure appears in the parser-check suite and the Rust alignment suite. The captured log does not contain a usable diff payload before the exception, so the version-specific `--check` output recognizer cannot be treated as portable.

A local standalone reproduction was attempted with an isolated Rust toolchain under this report's temporary directory. It could not finish because the filesystem returned `No space left on device`; no global Rust toolchain or cache was modified.

## Primary Rustfmt semantics

The official Rustfmt README states that `--check` returns `0` when no formatting changes are needed and `1` when formatting changes would be made. It also states that in non-check modes, exit `1` represents an actual formatting, parsing, or internal error, while exit `0` means formatting completed successfully regardless of whether the formatted output differs.

The same README documents that Rustfmt can write formatted output to stdout and documents the stable `--emit stdout` mode.

Primary sources:

- https://github.com/rust-lang/rustfmt#verifying-code-is-formatted
- https://github.com/rust-lang/rustfmt#running-rustfmt-directly
- https://github.com/rust-lang/rustfmt#configuring-rustfmt
- https://github.com/rust-lang/rustfmt/blob/main/src/config/options.rs

## Recommended parser probe

Use:

```text
rustfmt --edition 2021 --emit stdout <temporary Input.rs>
```

The caller should discard stdout. A zero exit status means Rustfmt parsed and formatted the file successfully. Any nonzero exit status remains an execution/parser fault and must stay fail-closed. This removes dependence on the unstable shape of `--check`'s human-readable diff while preserving the parser safety invariant.

This recommendation is an inference from the documented exit semantics and stdout emission behavior; the local reproduction was blocked by disk exhaustion.

## Cleanup performed

Only the failed isolated install created for this diagnosis was removed:

- `/tmp/boxbox-rustfmt-ci-diagnosis-20261021/cargo` — 11 MiB before cleanup
- `/tmp/boxbox-rustfmt-ci-diagnosis-20261021/rustup` — 88 MiB before cleanup
- `/tmp/boxbox-rustfmt-ci-diagnosis-20261021/rustup-init` — 11 MiB before cleanup

The small installer log was preserved at:

`/tmp/boxbox-rustfmt-ci-diagnosis-20261021/rustup-install.log`

The failed install occupied 112,640 KiB according to `du -sk` before cleanup. The report directory now contains only the preserved 4 KiB installer log.

## Additional Ubuntu failure

The combined Actions log `/tmp/boxbox-delivery-hud-20261021/github-first-failures.log` shows a separate Ubuntu failure in `test/surface.test.ts`:

```text
error: ENOENT: no such file or directory, scandir '/home/runner/work/rowgrid/rowgrid/test/fixtures/python/corpus'
```

The failing test is `surface forms — Python > every table in the fixture maps to a pattern` at lines 53–65. It unconditionally scans both `test/fixtures/python` and `test/fixtures/python/corpus`. The checked-out GitHub tree has the first directory and its four fixture files, but no `test/fixtures/python/corpus` directory; the directory is also absent from the local integration worktree and from the tracked tree. Therefore this is a deterministic missing-directory test defect, independent of the Python surface mapping implementation.

Minimal fixes, in descending preference:

1. Make the test enumerate the optional corpus directory only when `existsSync`/`statSync` confirms it exists, while continuing to scan the required fixture directory.
2. Add a tracked placeholder file under `test/fixtures/python/corpus/` if the corpus directory is intended to be a permanent contract.

The current repository structure documents corpus inputs under `development/corpus/`, not under `test/fixtures/python/corpus/`, so option 1 is the smaller contract-preserving fix unless a separate decision moves promoted corpus fixtures into the test tree.

The temporary Rust install attempt also added two exact environment-source lines pointing at `/tmp/boxbox-rustfmt-ci-diagnosis-20261021/cargo/env` in `~/.zshenv` and `~/.profile`; the parent agent removed only those exact lines. This report records the caveat; no other shell-profile content was changed by this investigation.
