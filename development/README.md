# Developing BoxBox

Product implementation and shipping templates live in `../product/`. This directory contains the tools and evidence used
to develop them. Start with the [maintainer guide](../docs/development/README.md) and
[the layout contract](../docs/development/layout.md). The current request or issue defines the task;
historical milestone records do not assign work.

From the repository root:

```sh
bun install
bun run check
bun run sync:plugin
bun run pack:installer
./development/install.sh codex
```

`tools/` owns builds, synchronization, evaluation and corpus processing. `corpus/` owns pinned research inputs and verdicts.
`harness/` owns release-stage execution and recorded evidence. `skills/`, `agents/`, `codex/` and `hooks/` are development
host adapters. The development skill links to the product engine and rules; copy installs dereference those links.

The user-facing npm installer is built from `product/installer/`. No files under this development directory are shipped.
