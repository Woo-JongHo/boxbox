Read-only review of ONLY the following follow-up: member-call dot alignment and stronger agent skill completion rules. Previous return/call-envelope review passed separately. Review current grid-kinds.ts envelopeBoundaries, call-member-dot KIND_AXES, the three new member tests at top of test/typescript-matrix-boundaries.test.ts, and canonical product/plugin/skills/boxbox/SKILL.md. Check whitespace/token safety, semantic role of final dot, legacy approved keys, negatives and whether boundary inventory actually prevents the observed missing-axis false completion. Do not edit or run commands. Return PASS/BLOCKED with concrete defects. 38 targeted tests passed; full new integration checks are pending.

--- before/product/engine/typescript/grid-kinds.ts
+++ product/engine/typescript/grid-kinds.ts
@@ -817,7 +817,7 @@
 	"declaration-equals"          : DECLARATION_EQUALS_AXES,
 	"declaration-extended-equals" : DECLARATION_EQUALS_AXES,
 	"return-guards"               : { gap: ["guard-return"], insert: [] },
-	"declaration-call-envelope"   : { gap: ["colon", "equals", "semicolon"], insert: ["call-envelope-open", "call-envelope-close", "comment"] },
+	"declaration-call-envelope"   : { gap: ["colon", "equals", "semicolon"], insert: ["call-member-dot", "call-envelope-open", "call-envelope-close", "comment"] },
 	"guard-statements"            : { gap: [], insert: ["guard-close-paren", "guard-semi1", "guard-continue"] },
 	"type-alias"                  : { gap: ["equals", "semicolon"], insert: ["comment"] },
 	"method-signature"            : { gap: [], insert: ["open-paren", "close-paren", "colon", "comment"] },
@@ -928,7 +928,14 @@
 	const close = tokenAfter(source, end, ")")       ;
 	if (close === undefined || close !== call.getEnd() - 1) return undefined;
 
-	const boundaries: RowBoundary[] = [{ axis: "call-envelope-open", from: callee.getEnd(), at: open, insert: true, layer: "call-envelope" }];
+	const boundaries: RowBoundary[] = [];
+	if (isPropertyAccessExpression(callee)) {
+		const receiverEnd = callee.expression.getEnd()                         ;
+		const dot         = tokenAfter              (source, receiverEnd, ".") ;
+		if (dot === undefined || !spacesOnly(source, dot + 1, callee.name.getStart(source))) return undefined;
+		boundaries.push({ axis: "call-member-dot", from: receiverEnd, at: dot, insert: true, layer: "call-envelope" });
+	}
+	boundaries.push({ axis: "call-envelope-open", from: callee.getEnd(), at: open, insert: true, layer: "call-envelope" });
 	// Empty calls retain (), including their zero inner width.
 	if (items.length === 0 && close !== open + 1) return undefined;
 	if (items.length > 0) boundaries.push({ axis: "call-envelope-close", from: end, at: close, insert: true, layer: "call-envelope" });
@@ -936,7 +943,7 @@
 	return boundaries;
 }
 
-/** New envelope semantics use a distinct group/key; existing direct same-call signatures keep their original layer. */
+/** Existing direct same-call argument layers keep their key; empty calls and non-null wrappers use the new envelope contract. */
 function withCallEnvelope(source: SourceFile, kind: RowKind, run: readonly DetectedRow[]): readonly DetectedRow[] {
 	if (kind.name !== "declaration" || run.length < 2)                          return run;
 


--- before/product/plugin/skills/boxbox/SKILL.md
+++ product/plugin/skills/boxbox/SKILL.md
@@ -53,9 +53,10 @@
 
 1. Run `guide --authoring --json` for the intended file before composing a change. For an existing file, also run
    `check --json` and read its definitions, callers and relevant tests before changing its structure.
-2. Identify same-role rows, corresponding cells and syntax axes. Keep necessary differences visible. Function signatures,
-   function bodies and call sites are separate comparison regions; unrelated functions need not share a shape.
-   For early-return guards, different callees or nested type members, read
+2. Build a boundary inventory for the requested rows: name each cell, its syntax boundary and its comparison region.
+   For a member call, inspect `receiver | . | method | ( | arguments | )`; for a guard, inspect `condition | return | value`.
+   Match roles and nesting depth before matching punctuation. Function signatures, bodies and call sites have separate
+   regions. For member calls, early returns or nested type members, read
    [column-sharing regions](references/readability-contract.md#column-sharing-regions) before choosing widths or moving rows.
 3. Author the requested implementation or structural improvement. Preserve execution order, public contracts and meaningful
    differences. An overlong exception is a reason to inspect responsibility and data flow, not permission to add abstractions
@@ -65,8 +66,12 @@
 4. For preview, show the proposed diff and distinguish checks run on a proposal from checks run on the target. For an
    authorized application, inspect the diff, run relevant syntax/type and behavior checks, and assess performance-sensitive
    changes with appropriate evidence. Alignment cannot prove behavioral equivalence or performance.
-5. Run `check --json` on the resulting file. Where approved and requested, use the Align procedure below for final whitespace.
-   Report checked groups, remaining findings, unsupported regions and any verification not run.
+5. Run `check --json` on the resulting file, then reconcile every boundary in the inventory with the returned group axes.
+   Inspect actual columns for requested boundaries that the engine does not cover; record them as manual verification or
+   an unresolved coverage gap. Where approved and requested, use Align below for final whitespace. Completion requires
+   each requested boundary to be verified or explicitly reported unresolved, alongside remaining findings and checks not run.
+   When the project has an issue-history schema, record user corrections and discovered defects with their reproduction,
+   cause, decision and verification evidence; retain failed attempts and distinguish unresolved work from completed fixes.
 
 ## Check and Align
 
