# Chacada plugin delivery — 2026-10-20

The user authorized transferring the plugin to SSH alias `chacada` after the comparison work. This record covers a local test candidate delivery, not public publication or remote installation.

## Delivered files

- `boxbox-plugin-0.2.0.tgz`: npm installer with its included engine and both host adapters.
- `README.md`: Windows PowerShell and Linux installation instructions and verification limits.
- `DELIVERY.json`: source, archive, verification and destination metadata.
- `SHA256SUMS`: checksums for the three files above.

Windows destination: `C:\Users\woo\Downloads\BoxBox\0.2.0\20261020T181927-KST`.

SSH/Linux destination: `/mnt/c/Users/woo/Downloads/BoxBox/0.2.0/20261020T181927-KST`.

Archive: 117515 bytes, 32 files.
SHA-256: `2836ac6f3c930e12c6009a79850849c7f7144d8c4aef0ff7ef53ad4867b6faa0`.
Source base: `884f06a34752e148409bcffcd1d8d804f5d59aa6` on `m1-safety-proof`, including the existing uncommitted product/layout changes.

## Verification

The installer suite passed: 7 tests, 0 failures, 219 assertions. The plugin guard passed drift checks, strict Claude plugin/marketplace validation, 14 contract/hook tests, and isolated Claude Code 2.1.286 / Codex 0.163.0 registration. The artifact has no development/test/corpus/harness/research payload paths.

The default SFTP transfer did not respond and was terminated. Transfer then succeeded using a tar stream over ordinary SSH. Remote checksum verification returned:

```text
DELIVERY.json: OK
README.md: OK
boxbox-plugin-0.2.0.tgz: OK
117515 boxbox-plugin-0.2.0.tgz
```

A read-only Windows runtime check reported Node.js 24.12.0 and npm 11.6.2. The WSL runtime reported Node.js 18.19.1; installation requires Node.js >=22.22.3, so the supplied Windows instructions use `npm.cmd`. No installer or host registration was run on the destination.

The final layout Opus follow-up remains pending after a provider quota error. Native Windows/interactive host acceptance, licensing and public publication remain separate unfinished checks. The accompanying README and metadata preserve these limits.

Full local logs: `/tmp/boxbox-claude-research.frGJeu/boxbox-installer-check.log`, `plugin-guard.log`, and `transfer-verification.log` in that same directory. The architecture findings are in the [OMC comparison](../research/2026-10-20-omc-plugin-architecture.md).
