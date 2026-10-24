## Problem and behavior

Linked issue: Fixes #

Describe the concrete trigger, previous behavior, and resulting behavior.

## Validation

- [ ] Added or updated meaningful regression coverage for changed behavior.
- [ ] Ran `bun run check` and recorded the result below.
- [ ] Ran `bun run lint:changed` (or recorded an explicit `--base`) and checked the JSON report, including unsupported ranges and files with no recognized groups.
- [ ] Requested review for any change to `.github/boxbox-lint.json` or the lint workflow; the checker baseline is never automatically upgraded.
- [ ] Ran `bun run sync:plugin -- --check` when product/plugin templates or rule references changed.
- [ ] Checked preservation, failure behavior, and idempotence for changes that can write source files.
- [ ] Completed required independent review; recorded limitations and unexecuted checks accurately.

Commands, results, and evidence:

## Artifact impact

- [ ] Edited canonical files under `product/`; regenerated `plugin/` when needed.
- [ ] Kept development tools, private data, and machine paths out of shipped packages.
- [ ] Described user-visible changes, compatibility, and update instructions below.

Release notes and remaining limitations:

For a candidate, link the manual `release-candidate` run and the archive SHA-256.
Candidate artifacts do not constitute npm publication or native host-event acceptance.
