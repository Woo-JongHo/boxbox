# Hardware coding conventions related to BoxBox

Researched: 2026-10-12. Scope: historical assembler layouts and HDL tabular formatting. Findings are source-based; formatter binaries were not executed. Similarity is not evidence of historical influence or originality.

## Finding

HDL tabular alignment is a strong precedent for BoxBox's structural column alignment. Verible is the closest implementation reference for optional columns and hierarchical cell identities. VHDL Style Guide is the closest explicit policy reference for separate alignment groups. Older assembler coding forms provide historical context, but their physical record limits differ from content-derived minimum widths.

## 1. IBM System/360 BOS assembler, July 1968

The IBM manual describes punched-card source and a coding form with name, operation, operand and comment entries. Its standard statement field occupies columns 1–71, with continuation handling outside that field. Crucially, programmers may disregard the form's internal field divisions subject to statement-boundary and separation rules. Do not claim every operation or operand has one mandatory absolute starting column.

This supports a historical comparison with role-specific columns, not an equivalent minimum-width or recursive alignment algorithm. Primary artifact: IBM, *System/360 Basic Operating System Assembler with Input/Output Macros*, seventh edition, printed pages 8–10. [Original manual scan](https://bitsavers.trailing-edge.com/pdf/ibm/360/bos_bps/C24-3361-6_BOS_Assembler_with_Input_Output_Macros_Jul68.pdf).

## 2. lowRISC Verilog/SystemVerilog convention

Similar lines may be formatted as tables; module-instance port expressions require tabular alignment. Blank lines separate tables. The guide deliberately allows an ordinary comment to remain inside a table, unlike BoxBox's current comment boundary. It also forbids padding inside port-expression parentheses, so it does not establish BoxBox's policy of aligning every nested closing delimiter or comma.

Primary source: [Tabular Alignment and Module Instantiation](https://github.com/lowRISC/style-guides/blob/9c15ff5dce23eef969e00ab3715153967419eadd/VerilogCodingStyle.md#tabular-alignment).

## 3. VHDL Style Guide

Keyword alignment rules expose compact alignment, blank/comment group boundaries, separate generic/port alignment and control-structure boundaries. Compact mode uses the longest necessary prefix instead of preserving an unnecessarily distant existing column. Separating generic and port sections prevents the longer generic names from widening port declarations. These are explicit choices about width-sharing scope, not semantic role inference or frequency-based subgroup discovery.

Primary source: [Alignment configuration](https://vhdl-style-guide.readthedocs.io/en/latest/configuring_keyword_alignment_rules.html); captured [source revision](https://github.com/jeremiah-c-leary/vhdl-style-guide/blob/650058d9f92f91c72e08ff75c1abe66ba49f607d/docs/configuring_keyword_alignment_rules.rst).

## 4. Verible implementation

Verible separates language-specific group/cell discovery from language-independent column sizing. Cells receive hierarchical syntax-path keys; optional constructs may leave empty cells, and column counts may vary. This directly addresses rows containing different subsets of columns. Widths are computed per alignment group. If alignment exceeds the configured column limit, it falls back to non-aligned formatting rather than necessarily discovering smaller groups.

Primary source: [Formatter developer guide](https://github.com/chipsalliance/verible/blob/0f26265133bda3ade669bc36fc71a6e1f39ad809/doc/formatter.md#alignment). The same architecture is documented in a [versioned earlier snapshot](https://foss-fpga-tools.googlesource.com/third_party/verible/+/refs/tags/v0.0-978-gb19cc5d/doc/formatter.md#alignment).

Verible's user guide distinguishes alignment from flush-left/preserved formatting. Its inference mode considers existing excess whitespace as author-intent evidence; this is not the proposed BoxBox calculation of newly introduced padding cost. Its current group-boundary option can split at blank lines and separator comments; default mode does not add those splits. Lexical-equivalence checks protect non-whitespace tokens.

Primary source: [User guide, aligned formatting and failsafe behavior](https://github.com/chipsalliance/verible/blob/0f26265133bda3ade669bc36fc71a6e1f39ad809/verible/verilog/tools/formatter/README.md#aligned-formatting).

## Implications for BoxBox — proposals, not adopted rules

1. Represent a column by structural role/path, not by the ordinal position of whichever token is present in a row. An absent second column must not make the third column become the second.
2. Treat cell discovery and width-sharing scope as distinct decisions. Optional-column support alone can still create excessive padding.
3. Define which boundaries terminate a group, including whether ordinary comments differ from separator comments.
4. Use real display widths. Make total-width and excess-padding limits separate policies; evaluate them with approved examples before choosing thresholds.
5. Retain order, content preservation and deterministic output. Do not infer business purpose merely from matching syntax.

No examined source establishes BoxBox's entire proposed combination of recursive subgrouping, repetition frequency and human approval evidence. No claim that this combination is unique follows from this limited search. The present research does not justify changing the current 120-column guidance or introducing a universal threshold automatically.

## Evidence and limits

SHA-pinned source files, extracted IBM manual text, original scan and SHA-256 hashes are stored locally in `.boxbox/cache/hardware-alignment-research-20261012/`. The main Bitsavers host returned HTTP 403; its mirror downloaded successfully. Some IBM documentation and PDF pages failed in the browser tool; their search snippets were not used as verified evidence. This is a literature/source comparison, not an execution benchmark, exhaustive historical survey or independent final audit.
