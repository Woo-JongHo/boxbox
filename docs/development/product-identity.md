# Product naming

`product.json` owns the display name `BoxBox` and public npm installer name `boxbox-plugin`. Core CLI, private engine, skill and plugin IDs are the lowercase display name; environment prefixes are its uppercase form; the repository directory is `98_` plus the display name. `npmName` is a separate registry identity so availability does not force a product rename.

For a core identity rename, edit `product.json` displayName, then run:

```bash
bun development/tools/sync-product.ts         # preview without writes
bun run sync:product                # materialize identity and sync plugin copies
bun run check
```

For a public installer package-name change, edit `product.json` npmName and rebuild with `bun run pack:installer`. The builder reads it directly; the private nested engine name stays the core ID.

`development/tools/product-identity.generated.json` is the generated previous-identity snapshot, not a second editable product setting. Synchronization updates maintained text, source/launcher paths, project state directory names and known local skill/adapter symlinks. Reopen the workspace at its new path after a directory rename. Historical evidence content is preserved. External copied configurations, public repository ownership and registry publication require separate migration.

Destination collisions are checked before writing. Filesystem failures after writing starts are not transactional; preserve Git changes and use the printed plan to recover. Rename without concurrent edits.

# Code length policy

The readability contract remains the source of truth.

- Cell widths are actual display widths, not fixed character allocations.
- Column 120 is a general review signal; specific import and condition rules have their own explicit 120-column handling.
- Existing TypeScript call/import outlier handling uses a 20-column difference in specific contexts, not every language or column.
- Different tables do not borrow widths; execution order and non-whitespace content are preserved.

Proposed next work: subdivide compatible rows at each syntax layer using extra-padding cost, repetition count and shape. General thresholds and examples are not yet approved or implemented. This naming change adds no new formatting threshold.
