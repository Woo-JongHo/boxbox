# Final CI candidate evidence

Date: 2026-10-22 KST

This directory contains the small, sanitized records for the final source-frozen CI pass. It does not contain the candidate archive, private reasoning, credentials or native session identifiers.

## Identity and runs

- Frozen candidate source: `35b61780ae122744f39d9cb0b935db5f8bccd14b`.
- PR verification: run `39635921495`, Ubuntu and macOS success, 653 tests and zero failures on each.
- Candidate workflow: run `39637622755`, Ubuntu/macOS verification success, package success and engine-only smoke success on Ubuntu, macOS and Windows.
- Candidate archive SHA-256: `bec626435e525c2d7324d156f85d2c114427d875725abcecb42fed561b2b92be`.

`candidate.json` and `SHA256SUMS` bind the archive to the frozen source. The three smoke JSON files bind every OS journey to the same archive digest and record their engine-only limits.

## Local/CI comparison boundary

The local native archive has SHA-256 `2b43d24eabfdde00ae8019b204aabd2cc8d04f1604a8ffd540ec3170606649f0`; it is not the CI archive. The entry comparison identifies two byte-different embedded host-package gzip streams. The container and inner comparisons show equal decompressed tar bytes, no tar metadata differences and no differing inner file entries. This establishes payload-content equality within the measured comparison. It does not transfer local native host or hook evidence to the CI archive.

## Native-hook prerequisites

The Windows probe is a read-only prerequisite result for the retained isolated local-candidate context. Its CLI and plugin wiring are present, but the isolated Codex context is unauthenticated. No model or hook journey ran. Claude and current Windows native-hook acceptance remain open; CI smoke explicitly skipped host registration and hook-event delivery.

## Delivery boundary

The CI archive and the listed safe records were delivered to a new Windows directory. WSL and native PowerShell verified the exact archive digest. The delivery did not install the archive or alter live profiles, trust or credentials. `ssh-delivery-transport.json` preserves the successful method and the two failed transport/early-verification attempts; `ssh-delivery-proof.json` binds the final remote path, source, run and digest.

The documentation-only commit that records these results is subsequent to source `35b6178` and is not the candidate source identity.

## Staged whitespace verification scope

The original author and independent reports predate staging of new evidence. The staged full whitespace check found 31 CRLF lines in the recorded Windows excerpt in `candidate-package-smoke-summary.txt`. These raw bytes are preserved under the repository evidence policy. The staged check excluding only that raw file passed. The [independent addendum](independent-review-addendum.md) qualifies the earlier check claim; no product or authored-document whitespace violation was found.
