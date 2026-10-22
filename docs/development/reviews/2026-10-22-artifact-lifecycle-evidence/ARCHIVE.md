# Archived lifecycle evidence

This directory keeps only the 33 files that other documents or issue-library records cite by path.
The other 3,649 files (per-step `core/` and `hud/` outputs of the REL10 lifecycle runs) were removed from the tree
to keep the repository small and to stop publishing machine-local paths; the recorded content is unchanged.

- Archive: `lifecycle-evidence-unreferenced.tar.gz` (3,649 files, paths relative to the repository root)
- SHA-256: `8e009265c1047bd53e186e979d4bdf15197dbf0ca06d33273aa0ad704db16c64`
- Git history: every file is still present at commit `8e6e49d` (`main` before this removal; it was `01f7617` before the [history rewrite](../../history-rewrite-2026-10-22.md)).

Restore a file from history:

```bash
git checkout 8e6e49d -- docs/development/reviews/2026-10-22-artifact-lifecycle-evidence/<path>
```
