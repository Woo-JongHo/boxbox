# BoxBox Grammar

Status: confirmed (M1.8 S2) · Date: 2026-09-30 · First scope: TypeScript, Python (Java is on hold; the Java column in the tables is for reference)
Review: Codex cross-review applied (`docs/development/reviews/2026-09-30-codex-grammar-review.md`)

This document is **layer 1** of the five normative layers. It sits below the charter (`charter.md`) and **defines every ID** used by surface forms (layer 2), conventions (layer 3) and the example book (layer 4). Lower layers cannot create IDs that are not in this document. This document defines **roles**, not the grammar of a particular language. Layer 2 decides which symbols and word order express each role in each language.

IDs are written in English capitals and are never translated.

## 0. Scope and premises

- This grammar is for **sentences that become alignment targets** and for **the sentence shapes GUIDE recommends**. It does not claim to classify every sentence in code. Sentences that fit no pattern are left unclassified and untouched.
- **The parser classifies first.** A pattern is a name attached to a structure the parser (AST, masked tokens) has confirmed. The "code is language" metaphor must never decide classification ahead of the parser and semantic analysis. Even with the same symbol shape, scope, control flow and side effects can differ.
- If it cannot be confirmed, it is `UNCERTAIN` (charter invariant 3).

## 1. Four units

| ID | Unit | In code | What is checked | Automation |
|---|---|---|---|---|
| `WORD` | word | a name (identifier) | whether the role shows, whether the name matches the behavior | GUIDE |
| `SENTENCE` | sentence | one line's declaration, call, condition or exit | whether it fits a pattern (section 3) | SUGGEST |
| `PARAGRAPH` | paragraph | a group of sentences separated by blank lines | whether it has one purpose (section 4) | SUGGEST |
| `TEXT` | text | a file, a function body | whether the paragraph order fits the genre (section 5) | GUIDE |

**When the property differs, split the paragraph.** A sentence's property is its pattern (section 3) and, for a definition, its **declaration kind**. Put a blank line where the property changes. Examples: a group of value definitions (`const`) → a check (`WHEN`+`EXIT`) → a result (`EXIT`); in tests, a group of setup (`const`) → a group of assertions (`expect`).

- **Declaration kind** uses only what can be determined reliably per language. The first criterion separates **declarations erased after compilation** (TypeScript `type`, `interface`, `import type`, `declare`) from **declarations that remain at run time** (`const`/`let`/`var`, `function`, `class`, `enum`). `class` and `enum` are also types but remain at run time, so they belong to the latter. Erased declarations are grouped separately instead of being slotted one by one between executed declarations.
- **Observational information:** visibility (`export`) and reassignability (`const`/`let`) are not mandatory criteria for splitting paragraphs. Making them mandatory over-fragments paragraphs; `const` only forbids reassignment rather than making a value immutable; and Python has no matching marker. They are shown as information in reports, and conventions (layer 3) decide whether to split.
- **Keep the original order.** The engine never reorders sentences. The basic principle is **preserving the original execution and evaluation order**, and dependencies (no use before declaration, TDZ) are one reason for it. Whether moving is safe differs by language: JavaScript function declarations are hoisted and erased types have no execution order, but Python's `def` evaluates defaults and decorators at definition time and module-level `import` can have side effects. So grouping by property goes only as far as inserting blank lines **within sentences that are already consecutive**, and proposals to move sentences are left to humans.
- **Inserting a blank line is also a suggestion.** It changes only whitespace, but changing a paragraph boundary changes what the next alignment targets. Inserting automatically first requires verifying syntactic boundaries, behavior preservation, a fixed split criterion, invariance on rerun, and that splitting and aligning do not keep flipping each other. Line breaks inside strings or continued expressions are not targets.

**Exception — a check right after a definition:** a guard that checks a name defined just above (`if (!found) throw …;` after `const found = …;`) stays in the same paragraph as the definition, because "find it, and refuse if missing" is one purpose (the extract → refuse ladder of the `ALGORITHM` genre has this shape too). If the guard checks a different name, it is not an exception.

**Paragraphs and tables differ.** A paragraph is a group separated by blank lines, and one paragraph may hold sentences with several roles. Normally a **table** is **three or more consecutive sentences of the same pattern** within one paragraph, with documented declaration/import pair exceptions. Tables have independent widths and normally stop at blank lines or comments.

**Scoped return-guard exception (2026-10-21 user clarification):** supported `WHEN` sentences of the form
`if (condition) return value;` can share a return-start column across ordinary statements and blank lines in one
immediate block. All statements retain their original order. Inner blocks calculate their own widths; their guards
do not enter the outer table. Comments between statements, unsupported guards, unconditional exits and function/class
declarations separate regions. See [column-sharing regions](readability-contract.md#column-sharing-regions).

## 2. Roles and markers

Sentences are made of **roles**, and roles show through **markers** (symbols). Markers work like grammatical particles: even when word order differs, the marker tells the role. Alignment lines up the markers of the same pattern vertically.

**Roles are defined only within a pattern.** The same `:` is the marker after `KEY` in `MAP` and the marker after `NAME` in `DESCRIBE`. Pairs whose role boundaries look blurry (`NAME`/`TARGET`/`KEY`, `VALUE`/`RESULT`, `ITEM`/`ARGS`) are told apart only by the role lists in section 3, after the pattern is decided.

| ID | Role | Used in patterns |
|---|---|---|
| `NAME` | a newly created name | `DEFINE`, `DESCRIBE` |
| `TYPE` | a type | `DEFINE`, `DESCRIBE` |
| `VALUE` | the value given to a name, target or key | `DEFINE`, `DESCRIBE`, `MAP`, `CHANGE` |
| `KEY` | the left side of a mapping | `MAP` |
| `ITEM` | one cell of a list | `LIST`, `IMPORT` |
| `SOURCE` | where something is imported from | `IMPORT` |
| `TARGET` | something that already exists (the receiver of a call, the thing that changes) | `DO`, `CHANGE` |
| `ACTION` | the function or method called | `DO` |
| `ARGS` | the values passed to a call | `DO` |
| `CONDITION` | a condition, the match pattern of a `case` | `WHEN` |
| `RESULT` | what is handed over when ending the flow (return value, thrown exception) | `EXIT` |

The match pattern of a `case` differs from a general condition (value comparison, destructuring), but this grammar groups both under `CONDITION`. If they ever need to be told apart, this document changes to create a new role.

## 3. Patterns (closed set, 9)

| ID | Meaning | Roles (in logical order) | TypeScript | Python | Java |
|---|---|---|---|---|---|
| `IMPORT` | imports | ITEM · SOURCE | `import { a } from "m";` | `from m import a` | `import m.a;` |
| `DEFINE` | defines | NAME · [TYPE] · VALUE | `const a = 1;` | (ambiguous, rule 2) | `int a = 1;` |
| `DESCRIBE` | describes | NAME · TYPE · [VALUE] | `a: string;` | `a: str` | `private int a;` |
| `MAP` | maps | KEY · VALUE | `a: handler,` | `"a": 1,` | — |
| `LIST` | lists | ITEM… | `[1, 2],` | `(1, 2),` | `{1, 2},` · `RED,` |
| `DO` | acts | TARGET · ACTION · ARGS | `log.info(a);` | — | — |
| `CHANGE` | changes | TARGET · VALUE | `a = 1;` | `self.a = 1` | — |
| `WHEN` | if the condition holds | CONDITION · (inner sentence) | `case A: …` | — | — |
| `EXIT` | ends | [RESULT] | `return a;` · `throw e;` | `return a` | `return a;` |

- `—` means that language's engine does not build tables of this pattern yet (layer 2's job). It does not mean the pattern is absent from the language.
- `EXIT` covers `return`, `throw`, `break` and `continue`. An unconditional `return value` is `EXIT`, not `WHEN`. A guard (`if (x) return;`) is **a sentence with `EXIT` inside `WHEN`**.
- The inner sentence of `WHEN` is another pattern (`EXIT`, `DO`, `CHANGE` …). `WHEN` only names the pairing of a condition and its inner sentence.

### Decision rules (ambiguous cases)

1. **An enumeration with values is `MAP`; names only is `LIST`.** `enum { A = 1 }` and `RED(1, 2)` are MAP, and `RED,` is LIST.
2. **With a declaration marker it is `DEFINE`; if the target certainly exists already it is `CHANGE`; otherwise it is ambiguous.**
   - Declaration markers: TypeScript `const`/`let`/`var`, Java type declarations.
   - Certain `CHANGE`: assignment to a property or element (`a.b =`, `a[i] =`), assignment without declaration in TypeScript and Java.
   - Python's `a = v` shares syntax between declaration and assignment. Until the parser confirms whether it is module level (indentation cannot tell: the inside of a module-level `if` is indented too), whether it is `global`/`nonlocal`, and whether the name is bound for the first time, it is **ambiguous**.
3. **Ambiguous rows are never grouped into one table with certain rows.** When a certain `DEFINE` row and an ambiguous row are adjacent, the table is split. Whether a table of ambiguous rows may be fixed is decided by verdict (layer 4). Until a verdict exists, the current behavior is kept and the result is marked ambiguous.
4. **The container decides the pattern.** `a: T = v` in a class body is `DESCRIBE` (a field with a default), and `a: T = v` inside a function is `DEFINE`. In an engine that does not know the container (the current Python line engine), it is ambiguous.
5. **A new pattern exists only by changing this document.** It needs evidence (corpus table counts) and human approval. Conventions and examples cannot create patterns.

## 4. Paragraph purposes

States what a `PARAGRAPH` groups sentences for. Used when checking the order of a function body (text). **The levels are only SUGGEST and GUIDE; there is no automatic fix.**

| ID | What it does | Patterns mainly used |
|---|---|---|
| `CHECK` | sends back the failing cases first | `WHEN` + `EXIT` |
| `PREPARE` | gathers what is needed | `DEFINE` |
| `DECIDE` | decides without side effects | `DEFINE`, `WHEN` |
| `ACT` | changes the outside world | `DO`, `CHANGE` |
| `RESULT` | returns | `EXIT` |

**Verbs are only hints.** Lookup verbs (`find`, `get`) likely mean preparation and action verbs (`save`, `send`) likely mean acting, but often, as with `load` or `create`, the name alone cannot reveal side effects. If control flow and outputs cannot confirm it, the purpose is `UNCERTAIN`. Verb dictionaries differ by project, so they live in conventions (layer 3) and the example book (layer 4).

Loop shapes (filter, find, collect, emit) are convention (layer 3) vocabulary, not grammar IDs, because their purpose spans several sentences rather than one line's pattern.

## 5. Genres

Order rules for a text (`TEXT`) differ by genre. Genres are set by config scopes (`scopes`).

| ID | Text order | Examples |
|---|---|---|
| `BUSINESS` | CHECK → PREPARE → DECIDE → ACT → RESULT | services, handlers |
| `ALGORITHM` | no order rule; an "extract → refuse" ladder is considered normal | parsers, alignment engines |
| `TEST` | Arrange → Act → Assert | tests |
| `CONFIG` | mostly `MAP` and `LIST`, no order rule | config, registration tables |

Scopes without a genre get no order rule.

## 6. Evidence (measured 2026-09-30)

Every **table of three or more rows** in the pinned corpus and the stress corpus was counted and mapped to a pattern. These numbers concern sentences that became tables; they are not evidence that every sentence is explained by the nine patterns (section 0).

| Pattern | TypeScript (7,214) | Python (879) | Java (162) |
|---|---|---|---|
| `DEFINE` | 3,367 | — | 154 |
| `DEFINE` or `CHANGE` (ambiguous) | — | 301 | — |
| `DESCRIBE` | 871 | 128 (including 26 container-ambiguous) | 2 |
| `MAP` | 2,259 | 339 | — |
| `LIST` | — | 111 | 6 |
| `DO` | 602 | — | — |
| `CHANGE` | 83 | — | — |
| `WHEN` | 32 | — | — |

- No table was left unmapped.
- TypeScript and Python: the pinned corpus in `development/corpus/manifest.json` (vscode, prisma, trpc, zod, requests, fastapi, pydantic, django), at most 400 files per source.
- Java: dropped from the first scope (2026-09-30). The table's numbers come only from five OpenJDK files in the stress corpus, chosen as the longest files and therefore biased, and are GPL so used for checking only. **Java distributions are not used as evidence until a permissively licensed Java corpus is pinned (M1.8 S2.5).**
- `IMPORT` is handled by a separate step (`00_normalize-imports.ts`), so it is not counted. `EXIT` rarely forms tables of three or more rows, so it is not counted; it is used in GUIDE and paragraph checks.
- 51.5% of TypeScript tables are inside function bodies. Patterns are used not only in declarations but also inside business logic.

## 7. Open questions

- Whether to introduce scope analysis (the official `ast` module) to separate Python `DEFINE`/`CHANGE`.
- Classification priority of value shapes (value/computation, call/construction, `await`, object/array, `as`) when they overlap, as in `await f() as T`.
- Whether to separate the match pattern of a `case` from `CONDITION`.
