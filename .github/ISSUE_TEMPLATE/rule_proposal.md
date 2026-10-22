---
name: Rule proposal
about: Propose a table kind or alignment rule for the approved preset
title: ''
assignees: ''
---

**What table shape should be aligned**

Describe the repeated rows: the construct, the language(s), and which
syntax boundaries should line up.

**Frequency evidence**

Where does this shape appear in real code? Links to public repositories
or file counts are far stronger than taste arguments.

**Positive example**

```text
before:

after (what the engine should produce):
```

**Forbidden shape**

A shape the engine must never produce from this rule — usually an
over-reach, like aligning fewer rows than the rule allows.

**Boundaries**

What is explicitly out of scope (other containers, other initializer
shapes, minimum row counts, indentation rules)?
