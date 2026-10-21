# BoxBox maintainer documentation

This is the entry point for understanding and changing BoxBox. Implementation facts in these documents were inspected against
source baseline `07f568ccec77e70dd57da9aba63f8dc7ef7fcc5a` on 2026-10-21. Proposed work is explicitly labeled.
Conversation is Korean; maintained repository documents are English.

## Read by question

| Question | Owning document |
| --- | --- |
| What does the product do, and where should a change go? | [Architecture](architecture.md) |
| How do Write, Refactor, Align and Check differ? | [Workflow contract](../user/modes.md) |
| What happens when a file is inspected or formatted? | [Inspection process](inspection-process.md) |
| How are diverse patterns, exceptions and rule authority managed? | [Pattern management](pattern-management.md) |
| What is stored, who can approve it, and would SQLite help? | [Storage and validation](storage.md) |
| How do I implement and verify a change consistently? | [Change patterns](change-patterns.md) |
| Have we seen this failure before, and why did it happen? | [Issue library: categories, JSON records and template](issue-library/README.md) |
| Where are authored and generated files? | [Repository layout](layout.md) |
| What rules and vocabulary do we enforce? | [Charter](../../product/rules/references/charter.md), [grammar](../../product/rules/references/grammar.md), [readability contract](../../product/rules/references/readability-contract.md) |
| How are Codex and Claude HUDs used? | [HUD](hud.md) |
| What is the current task and what was actually verified? | [Plan](plan.md), [status](status.md), [documentation audit](reviews/2026-10-21-maintainer-docs.md) |
| How do issues, PRs and candidate archives move? | [CI/CD](cicd.md), [release contract](release-contract.md) |
| What is the longer-term direction? | [Design draft](design.md) |

## Documentation pattern

The new architecture, inspection, storage and change-pattern documents use these sections in order. Older documents
can adopt the same structure when substantially revised:

1. **Purpose and scope** — the caller's problem, supported surface, current versus proposed behavior.
2. **Interface** — input, output, preconditions, failures and side effects.
3. **Process** — ordered stages, owner source files and language-specific variation.
4. **Data and invariants** — authority, schemas, consistency and preservation obligations.
5. **Change points** — the smallest places to edit, including generated output rules.
6. **Verification and limits** — runnable existing commands, evidence and unmeasured cases.

Use links to owning documents instead of copying policy. A module's interface includes its refusal behavior and
side effects, not just TypeScript types. Separate a proposed interface from callable commands that exist today.
Run counts belong in dated review records; stable documents link to those records.

When behavior changes, update the owning document and its regression test in the same PR. When a rule's meaning
changes, follow the human approval and document-hash contract; a documentation cleanup cannot silently approve it.
The old design draft remains valuable for intent, but its historical implementation table is not a current capability map.
