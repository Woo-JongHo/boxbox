# Release notes template

Use this structure for the versioned entry in `CHANGELOG.md`. Keep notes user-facing and specific: describe what changed, who can use it, and any meaningful limits. State explicitly when detection or guidance does not grant automatic write approval. Remove headings that have no entries, and never leave placeholders in a release.

The release workflow publishes only the body under the matching version heading by extracting it with `development/tools/release-notes.ts`. It does not publish the release; a maintainer reviews and publishes the GitHub draft separately.

```markdown
## [X.Y.Z] - YYYY-MM-DD

### Added

- **[Capability].** [What users can now do and the supported scope.]

### Changed

- **[Behavior].** [What changed and any compatibility or migration impact.]

### Fixed

- **[Issue].** [What users observed and what now happens.]

### Removed

- **[Removed capability].** [What is no longer available and the migration path.]

### Security

- **[Security change].** [User-relevant impact; do not expose sensitive details.]

### Development

- **[Release or contributor workflow change].** [Include only when useful to maintainers.]
```
