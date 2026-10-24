# BoxBox maintainer documentation

This is the entry point for understanding and changing BoxBox. Implementation facts in these documents were inspected against
source baseline `07f568ccec77e70dd57da9aba63f8dc7ef7fcc5a` on 2026-10-21. Proposed work is explicitly labeled.
Conversation is Korean; maintained repository documents are English.

Keep current product and contributor contracts here. Personal task tracking and session handoffs belong outside the
public checkout; their absence must not prevent a contributor from building or checking a change. This document owns
public documentation lifecycle and evidence-retention policy; [repository layout](layout.md) owns physical placement.

## Read by question

| Question | Owning document |
| --- | --- |
| What does the product do, and where should a change go? | [Architecture](architecture.md) |
| How do I install the plugin? | [Installer README](../../product/installer/README.md) |
| How do Write, Refactor, Align and Check differ? | [Workflow contract](../user/modes.md) |
| What happens when a file is inspected or formatted? | [Inspection process](inspection-process.md) |
| How are diverse patterns, exceptions and rule authority managed? | [Pattern management](pattern-management.md) |
| What is stored, who can approve it, and would SQLite help? | [Storage and validation](storage.md) |
| How do I implement and verify a change consistently? | [Change patterns](change-patterns.md) |
| Have we seen this failure before, and why did it happen? | [Issue library: categories, JSON records and template](issue-library/README.md) |
| Where are authored and generated files? | [Repository layout](layout.md) |
| What rules and vocabulary do we enforce? | [Charter](../../product/rules/references/charter.md), [grammar](../../product/rules/references/grammar.md), [readability contract](../../product/rules/references/readability-contract.md) |
| Where are historical milestone verdicts and their evidence? | [Plan and harness REL table](plan.md), [status snapshots](status.md), [documentation audit](reviews/2026-10-21-maintainer-docs.md); use the current request or issue to select work |
| How do issues, PRs and candidate archives move? | [CI/CD](cicd.md), [release contract](release-contract.md) |
| What is the longer-term direction? | [Design draft](design.md) |

## Documentation and evidence lifecycle

Public documentation focuses on the contracts contributors and users need: installation and use, architecture, safety
invariants, contribution, verification and release. Each fact has one canonical owner; other documents summarize and
link to it. Document contracts and decisions rather than mirroring per-function or per-file inventories that code
already owns. Update an existing document by default. Split one only when audience, purpose and update lifetime are
independent. When behavior, commands or support change, update the owning document with them.

Describe current behavior separately from historical results. Public evidence records the conclusion, reproduction
steps when needed, source revision, artifact identity and approval or release proof required by the public contract.
Intermediate and repeated raw logs belong in private storage when the public contract does not require them. Before
moving evidence, preserve any proof still required publicly. Archive irreplaceable records with their original path,
source revision when known, content hash and destination; disposable caches may be removed when they can be recreated.
Do not bulk-migrate historical plans, status records or reviews as part of routine documentation cleanup.

A documentation cleanup does not approve a rule or change its meaning. Changes to an approved rule still require the
existing human approval and document-hash contract. When product behavior changes, update its owning document and
regression test in the same change. Historical review counts and raw execution output stay in dated evidence records;
stable contracts link to the relevant record.
