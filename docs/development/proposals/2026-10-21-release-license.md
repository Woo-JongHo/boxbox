# Release package licensing proposal

Status: approved by the user on 2026-10-22 (MIT) and implemented; this does not authorize npm publication.

The repository already contains `LICENSE` with the MIT text and the author's attribution. The installer builder
currently emits `license: "UNLICENSED"`; engine package templates do not declare a release license. The release
contract records this mismatch as a decision required before publication.

Proposed bounded change after approval:

- Preserve the existing repository MIT text and attribution verbatim.
- Include that `LICENSE` in installer and engine archives and declare `license: "MIT"` in their generated metadata.
- Extend archive allowlist and exact-notice tests to verify the shipped license bytes.
- Keep bundled dependency notices, including the YAML parser's ISC notice, intact.
- Preserve the existing four synthetic preset examples' separately approved CC0-1.0 metadata. New example licensing
  remains the separate pending decision; no blanket CC0 applies to this repository.
- Keep the root development package private and do not publish a registry package or create a release tag.

This changes the release artifact's metadata and accompanying notice. It does not authorize npm publication,
repository visibility changes or approval of additional formatting rules.
