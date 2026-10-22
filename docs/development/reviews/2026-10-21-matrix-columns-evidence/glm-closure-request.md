FINAL READ-ONLY CLOSURE AUDIT. Respond in English. All tools are disabled: use ONLY this immutable snapshot. Initial audit BLOCKED on missing axis note and stale scoped evidence; both are corrected below. Check current dot boundaries and exact guard row metadata, skill final reconciliation, and legacy-key preservation. Do not revisit unrelated existing features or infer test execution. Return PASS/BLOCKED with concise actual findings and scope. Final full suite is running separately; 38 dot-related tests,44 metadata tests,8 contract tests already passed. This audit is code review, not an executed-test claim.

Initial audit verdict:
검토에 필요한 모든 정보를 수집했습니다. 최종 확인 사항: 문제의 축(axis)에 대한 노트가 포함될 수 있도록 `AXIS_NOTES` 객체를 다시 한 번 확인했으며(801행에서 종료됨), 이는 확정되었습니다. 분석을 완료했습니다.

## 검토 결과: **BLOCKED**

### 차단 요인 1 — 새로운 `call-member-dot` 축(axis)에 레지스트리 노트가 없어 `bun run check`가 실패합니다

`product/engine/typescript/grid-kinds.ts:820`의 `KIND_AXES`는 이제 `declaration-call-envelope`가 삽입 축으로 `"call-member-dot"`를 필요로 하며, `envelopeBoundaries`는 이를 `grid-kinds.ts:936`에서 생성합니다. 그러나 `AXIS_NOTES`(`grid-kinds.ts:761–800`, `"guard-continue"`에서 종료)에는 `"call-member-dot"` 항목이 없습니다. `test/plugin-contract.test.ts:84-88`("모든 테이블 종류 축은 사람이 읽을 수 있는 노트를 가지고 있어야 함")는 `KIND_AXES`의 모든 축에 대해 `AXIS_NOTES[axis]`가 정의되어 있어야 하므로 이 테스트가 실패하고, 이로 인해 `bun run check` 및 CI(`verify.yml`)도 실패합니다. 수정 방법은 노트 한 줄을 추가하는 것뿐입니다. 예: `"call-member-dot": "최종 수신자/메서드 구분 기호인 \`.\`, 가장 넓은 수신자 이후"` — 그 후 다시 검토가 필요합니다.

### 차단 요인 2 — 구현 보고서와 증거 자료가 검토 중인 코드를 정확하게 설명하지 못합니다

요청된 스코프 diff는 member-dot 작업을 전혀 포함하지 않으며(diff의 `envelopeBoundaries`에는 점 블록이 없고, diff의 `KIND_AXES` 삽입 목록에는 `call-member-dot`가 없음), 보고서는 10개의 새로운 테스트를 설명하지만 `test/typescript-matrix-boundaries.test.ts`는 이제 13개를 포함하고 있습니다 (1-3행: 공유 수신자-메서드 점, 최종 구분 기호 일치, 멤버 경계 주석 — 279행, 제가 읽은 내용 기준). 보고된 로그(`targeted-expanded.log` 35개 통과, `typecheck.log`)는 이 확장 이전의 것입니다. 저는 실행이 제한되어 있으므로, member-dot 테스트가 실제로 통과하는지는 확인할 수 없으며, 대신 차단 요인 1에서 정적으로 실패하는 부분을 발견했습니다. 보고서의 "셀프 포맷 고정점" 주장은 확인된 적이 없는 트리 상태를 참조합니다.

### 검토 결과 건전한 부분 (차단 요인 외)

- **승인 키 호환성이 유지됩니다.** 유일하게 승인된 TS 키(`v1|typescript|SourceFile|declaration-equals|equals>call-open-paren>call-close-paren>semicolon`)는 `withCallEnvelope`(`grid-kinds.ts:941-956`)의 조기 반환(early return)에 의해 정확히 보존되며, 이는 모든 행에 대해 legacy `declarationCall`이 정의된 경우(인자 ≥1개, `!` 없음, await/new 아님)에 동작합니다. type-argument/trailing-comma/comment 케이스는 `grid-kinds.ts:908-919`에서 `envelopeCall`이 배제하므로, 이전 flat 동작으로 유지됩니다. `typescript-matrix-boundaries.test.ts:262-275`의 테스트에 의해 고정되었습니다.
- **프리셋 승인 데이터가 확장되지 않았습니다.** `product/rules/presets/recommended/*`는 저장소에서 가장 오래된 파일입니다(mtime 순서 기준). 내용은 변경되지 않았습니다. `product/rules/base/typescript.json`의 새로운 종류 항목은 승인이 아닌 표면 형식(보고용) 매핑입니다. `report.ts:64`의 `TWO_ROW_KINDS`는 체크 리포트 분류에만 영향을 미치며, `report.test.ts:62-73`에 의해 고정되어 있습니다.
- **토큰/의미 보존, 겹침, 멱등성.** `guard-return`은 `)` 뒤의 공백만 수정하고(`grid-kinds.ts`의 `detectReturnGuard`), `spacesOnly`는 감지 전에 `)`와 `return` 사이의 주석/개행을 배제합니다. 축 범위는 행 내에서 분리되어 있으며(멤버 점 `[receiverEnd, dot)` vs 열린 괄호 `[calleeEnd, open)` vs 닫는 괄호 vs `;`), `align.ts:writeGroups`는 어떤 그룹이든 겹치는 편집이 발생하면 어차피 실패합니다. 삽입 축 패딩은 `pad === at − from`에서 다시 편집되지 않으므로 고정점 연산이며, 테스트 헬퍼의 사후 쓰기 확인(exit 0)은 이를 고정합니다. `return-guards`는 `IfStatement` 소유 유일한 종류(`guard-statements`와 상호 배타적)이므로, 어떤 노드도 두 테이블에 포함되지 않습니다.
- **배리어/브리징은 문서화된 계약과 일치합니다.** 리전 분할은 주석(간격 정규식), 감지되지 않은 `if`, 무조건 `return/throw/break/continue`, 함수/클래스 선언부이며, 일반 명령문과 빈 줄은 브리징합니다. 내부 블록은 별도의 `Block` 컨테이너입니다. 이 모든 것은 부정적 테스트에 의해 고정되어 있습니다.

### 정확성을 위한 미미한 관찰 사항 (통과를 막는 요인 아님)

1. `grid-kinds.ts`의 `guardRegionBarrier`는 함수/클래스를 분할하지만 `TypeAlias`/`Interface`/`Enum`/`Namespace` 선언 및 `LabelledStatement`는 분할하지 않습니다. 블록 내에서는 드물지만, `type X = …;`로 분리된 가드는 여전히 하나의 리전으로 브리징됩니다. 문서는 function/class만 분할한다고 명시하므로 코드는 계약과 일치합니다. 필요하다면 의도적으로 확장하세요.
2. "직접적인 동일한 호출/아리티 행은 이전 레이어를 유지합니다"라는 주장은 *레거시* `declarationCall`이 모든 행에서 정의된 경우에만 정확합니다. 인자가 0개인 동일한 호출 쌍(예: 두 개의 `get()`)이나 후행 `!`가 혼합된 동일한 호출 실행은 이제 `declaration-call-envelope`로 이동합니다. 어떤 승인된 키도 영향을 받지 않지만(해당 형태는 승인된 축 서명을 생성한 적이 없음), 해당 형태에 대한 개발 작성기 출력이 변경되며, 공개 경로는 이를 새로운 미승인 키로 보고합니다.
3. `readability-contract.md`의 종류 테이블(~157-175행, "KIND_AXES에 1:1로 매핑")은 두 가지 새로운 종류에 대한 행을 추가하지 않습니다. 이들은 "열 공유 리전" 산문과 "체커가 우선합니다" 조항에 의해서만 다뤄집니다. `call-envelope-open`/`call-envelope-close` 축 이름은 축 이름 목록에 나타나지 않습니다. 산문은 `guard-return`과 `call-member-dot`의 이름을 올바르게 지정합니다.

**결론:** 리뷰 중인 파일은 스코프 diff 이후 계속 수정되었으며(약 3분 전 `call-member-dot` 추가), 그 결과 현재 트리가 저장소의 자체 계약 테스트를 위반합니다. `AXIS_NOTES`에 `call-member-dot` 노트를 추가하고, 갱신된 diff/테스트 실행과 함께 보고서를 다시 제출하면 위에 나열된 보존/키 특성을 바탕으로 통과될 수 있습니다.

product/engine/typescript/grid-kinds.ts SHA256 9c6e6f8109d17b87b43710ab69cb5ebe53cd70ac84a2ecfe80246730311d94d4
	for (const [tag, cell] of rowListCells(source, "call-statements", node)) boundaries.push(...itemLayer(source, cell, listAxisPrefix(tag), tag));
	const comment = trailingComment(source, semicolon + 1);
	if (comment) boundaries.push(comment);
	return boundaries;
}

/** A one-line, unbraced early return; only the space before `return` belongs to this axis. */
function detectReturnGuard(source: SourceFile, node: Node): readonly RowBoundary[] | undefined {
	if (!isIfStatement(node) || node.elseStatement !== undefined || !isReturnStatement(node.thenStatement)) return undefined;
	if (!ownLineOf(source, node, LINE_REST))                                                                return undefined;

	const close = tokenAfter                 (source, node.expression.getEnd(), ")") ;
	const start = node.thenStatement.getStart(source                               ) ;
	if (close === undefined || !spacesOnly(source, close + 1, start))                                       return undefined;

	return [{ axis: "guard-return", from: close + 1, at: start }];
}

/**
 * A guard row: a one-line `if (…) { …; continue; }` whose block ends in `continue`, with no `else`. Aligned cells
 * are the condition's closing `)` (hugging the widest condition), the first statement's `;` (hugging the widest
 * first statement) and the `continue` column; the statements in between stay as written.
 */
	}
	return boundaries;
}

/** Keep resource declarations and awaited/constructor initializers outside direct-call approval keys. */
function declarationGroupName(run: readonly DetectedRow[]): string {
	if (run.some(row => row.boundaries.some(boundary => boundary.layer === "call-envelope"))) return "declaration-call-envelope";
	if (!run.some(row => row.boundaries.some(boundary => boundary.axis === "equals"))) return "declaration";
	const extended = run.some(row => {
		if (!isVariableStatement(row.node)) return false;
		const declaration = row.node.declarationList                 ;
		const initializer = declaration.declarations[0]?.initializer ;
		return (declaration.flags & NodeFlags.Using) !== 0 || (initializer !== undefined && (isAwaitExpression(initializer) || isNewExpression(initializer)));
	});
	return extended ? "declaration-extended-equals" : "declaration-equals";
}

/**
 * Kind priority. Ordered so node syntaxes never overlap and no node is claimed by two kinds; when object-rows
 * claims array-element objects first, registration backs off via seen.
 */
export const ROW_KINDS: readonly RowKind[] = [
	{
		name       : "declaration",
		gap        : "blank",
		containers : node => (isSourceFile(node) || isBlock(node)) ? node.statements : undefined,
		detect     : detectDeclaration,
		groupName  : declarationGroupName,
		minRows    : run => run.every(row => row.boundaries.some(boundary => boundary.axis === "equals")) ? 2 : undefined,
		layerCall  : node => kindLayerCall("declaration", node),
	},
	{
		name       : "type-alias",
	{
		name       : "call-statements",
		gap        : "blank",
		containers : node => (isSourceFile(node) || isBlock(node)) ? node.statements : undefined,
		detect     : detectCallStatement,
		layerCall  : node => kindLayerCall("call-statements", node),
	},
	{
		name       : "return-guards",
		gap        : "blank",
		containers : node => isBlock(node) ? node.statements : undefined,
		detect     : detectReturnGuard,
	},
	{
		name       : "guard-statements",
		gap        : "blank",
		containers : node => (isSourceFile(node) || isBlock(node)) ? node.statements : undefined,
		detect     : detectGuard,
	},
	{
];

/** Human-readable description of which syntax boundary each axis name means. Fill it in when registering a new axis. */
export const AXIS_NOTES: Readonly<Record<string, string>> = {
	"call-member-dot"        : "final receiver/method dot of a supported member call; inner receiver dots remain inside the receiver cell",
	"colon"                  : "`:` separating a name or identifier from its type or expression",
	"equals"                 : "`=` of a declaration, alias or enum member",
	"semicolon"              : "statement-terminating `;`",
	"comma"                  : "row-separating `,`",
	"comment"                : "start column of a trailing `//` note",
	"open-paren"             : "parameter-opening `(` (after the name width)",
	"close-paren"            : "parameter-closing `)` (after the minimum inner width)",
	"case-colon"             : "`:` of a case label",
	"call-paren"             : "opening `(` of the first call in a case row",
	"subject-close-paren"    : "`)` closing the subject argument cell of a call statement",
	"matcher-dot"            : "`.` before the right-hand matcher of a call statement",
	"matcher-open-paren"     : "`(` opening the matcher argument cell",
	"matcher-close-paren"    : "`)` closing the matcher argument cell",
	"return-tail"            : "start column of a bare `return;` at the end of a case row",
	"value"                  : "start column of a registration-object expression",
	"property"               : "start column of the property name at each position in an object row",
	"open-brace"             : "opening `{` of an object row",
	"close-brace"            : "closing `}` of an object row",
	"tail"                   : "tail after an object row's `}` (`,` `;` `)` `as const`)",
	"call-open-paren"        : "`(` of the nested call cell (same callee and arity in every row)",
	"call-comma"             : "top-level argument `,` of the nested call cell, right after the widest argument",
	"call-arg"               : "start column of the next argument of the nested call cell",
	"call-close-paren"       : "`)` of the nested call cell, right after the widest last argument",
	"list-value-open"        : "opening `[` or `{` of a declaration value list",
	"list-value-comma"       : "`,` of a declaration value list, right after the widest item",
	"list-value-el"          : "start column of the next item of a declaration value list",
	"list-value-close"       : "closing `]` or `}` of a declaration value list, right after the widest last item",
	"list-arg-open"          : "opening `[` or `{` of a list inside a nested call argument",
	"list-arg-comma"         : "`,` of a list inside a nested call argument, right after the widest item",
	"list-arg-el"            : "start column of the next item of a list inside a nested call argument",
	"list-arg-close"         : "closing `]` or `}` of a list inside a nested call argument, right after the widest last item",
	"list-matcher-arg-open"  : "opening `[` or `{` of a list inside a matcher argument",
	"list-matcher-arg-comma" : "`,` of a list inside a matcher argument, right after the widest item",
	"list-matcher-arg-el"    : "start column of the next item of a list inside a matcher argument",
	"list-matcher-arg-close" : "closing `]` or `}` of a list inside a matcher argument, right after the widest last item",
	"subscript-close"        : "`]` of a declaration's subscript value, right after the widest index",
	"guard-return"           : "start column of an unbraced early return in the same block",
	"call-envelope-open"     : "opening `(` of compatible direct-call declaration values with different signatures",
	"call-envelope-close"    : "closing `)` of a nonempty direct-call value; its arguments remain one opaque cell",
	"guard-close-paren"      : "`)` of a guard row's condition, right after the widest condition",
	"guard-semi1"            : "first statement's `;` of a guard row, right after the widest first statement",
	"guard-continue"         : "start column of the trailing `continue;` in a guard row",
};

export function syntaxKindName(node: Node): string {
	return SyntaxKind[node.kind] ?? `Kind${String(node.kind)}`;
}

const DECLARATION_EQUALS_AXES = { gap: ["colon", "equals", "call-arg{i}", "list-value-comma{i}", "list-value-el{i}", "list-arg{i}-comma{i}", "list-arg{i}-el{i}", "semicolon"], insert: ["call-open-paren", "call-comma{i}", "call-close-paren", "list-value-open", "list-value-close", "list-arg{i}-open", "list-arg{i}-close", "subscript-close", "comment"] };

/**
 * Axis contract per kind — the single basis shared by authoring time (prompts, doc examples) and check time
 * (06_align-tables). gap axes keep at least one space; insert axes preserve existing conventions (`):`, `":`,
 * `//`) and only align the column. `{i}` marks per-property-position axes of object rows.
 */
export const KIND_AXES: Readonly<Record<string, { readonly gap: readonly string[]; readonly insert: readonly string[] }>> = {
	"declaration"                 : { gap: ["colon", "semicolon"], insert: ["comment"] },
	"declaration-equals"          : DECLARATION_EQUALS_AXES,
	"declaration-extended-equals" : DECLARATION_EQUALS_AXES,
	"return-guards"               : { gap: ["guard-return"], insert: [] },
	"declaration-call-envelope"   : { gap: ["colon", "equals", "semicolon"], insert: ["call-member-dot", "call-envelope-open", "call-envelope-close", "comment"] },
	"guard-statements"            : { gap: [], insert: ["guard-close-paren", "guard-semi1", "guard-continue"] },
	"type-alias"                  : { gap: ["equals", "semicolon"], insert: ["comment"] },
	"method-signature"            : { gap: [], insert: ["open-paren", "close-paren", "colon", "comment"] },
	"class-method"                : { gap: [], insert: ["open-paren", "close-paren", "colon", "comment"] },
	"interface-members"           : { gap: ["colon", "equals", "semicolon"], insert: ["comment"] },
	"type-members"                : { gap: ["colon", "equals", "semicolon"], insert: ["comment"] },
	"class-members"               : { gap: ["colon", "equals", "semicolon"], insert: ["comment"] },
	"enum-member"                 : { gap: ["equals", "comma"], insert: ["comment"] },
	"case-clause"                 : { gap: [], insert: ["case-colon", "call-paren", "return-tail"] },
	"assignments"                 : { gap: ["equals", "semicolon"], insert: ["comment"] },
	"call-statements"             : { gap: ["call-arg{i}", "list-arg{i}-comma{i}", "list-arg{i}-el{i}", "list-matcher-arg{i}-comma{i}", "list-matcher-arg{i}-el{i}", "semicolon"], insert: ["call-open-paren", "call-comma{i}", "call-close-paren", "list-arg{i}-open", "list-arg{i}-close", "list-matcher-arg{i}-open", "list-matcher-arg{i}-close", "subject-close-paren", "matcher-dot", "matcher-open-paren", "matcher-close-paren", "comment"] },
	"object-rows"                 : { gap: ["property{i}", "colon{i}", "value{i}", "comma{i}", "close-brace"], insert: ["open-brace", "tail"] },
	"registration"                : { gap: ["colon", "value"], insert: [] },
};
/** Terminal statements and unrelated declaration/control-flow forms end a guard region. */
function guardRegionBarrier(node: Node): boolean {
	return [
		"IfStatement",
		"ReturnStatement",
		"ThrowStatement",
		"BreakStatement",
		"ContinueStatement",
		"FunctionDeclaration",
		"ClassDeclaration",
	].includes(syntaxKindName(node));
}

/** Inspect immediate siblings only: ordinary statements bridge guards, while comments and explicit section barriers split them. */
function returnGuardRuns(source: SourceFile, siblings: readonly Node[], kind: RowKind): readonly (readonly DetectedRow[])[] {
	const runs      : DetectedRow[][] = [] ;
	let current     : DetectedRow[]   = [] ;
	let previousEnd : number | undefined   ;

	for (const sibling of siblings) {
		const boundaries = kind.detect(source, sibling)                                                              ;
		const gap        = previousEnd === undefined ? "" : source.text.slice(previousEnd, sibling.getStart(source)) ;
		const barrier    = boundaries === undefined && guardRegionBarrier(sibling)                                   ;
		if (!/^[ \t\r\n]*$/u.test(gap) || barrier) {
			if (current.length > 0) runs.push(current);
			current = [];
		}
		if (boundaries !== undefined) current.push({ node: sibling, boundaries });
		previousEnd = sibling.getEnd();
	}
	if (current.length > 0) runs.push(current);

	return runs;
}

/** Identifier/property callees only: optional chains, computed access and call-produced receivers stay opaque. */
function simpleCallee(node: Node): boolean {
	if (isIdentifier(node)) return true;
	if (!isPropertyAccessExpression(node) || node.questionDotToken !== undefined) return false;

	return simpleCallee(node.expression);
}

/** A direct call may carry one trailing non-null assertion; await/new/type arguments are separate contracts. */
function envelopeCall(node: Node): Node | undefined {
	if (!isVariableStatement(node) || (node.declarationList.flags & NodeFlags.Using) !== 0) return undefined;

	const value = node.declarationList.declarations[0]?.initializer;
	const call = value !== undefined && syntaxKindName(value) === "NonNullExpression"
		? (value as unknown as { readonly expression: Node }).expression : value;
	if (call === undefined || !isCallExpression(call) || call.questionDotToken !== undefined || call.typeArguments !== undefined) return undefined;

	return simpleCallee(call.expression) ? call : undefined;
}

/** The outer call is one cell; commas and nested expressions inside that cell are deliberately not edited. */
function envelopeBoundaries(source: SourceFile, call: Node): readonly RowBoundary[] | undefined {
	const callee = (call as unknown as { readonly expression: Node }).expression ;
	const open   = tokenAfter(source, callee.getEnd(), "(")                      ;
	const items  = callArguments(call)                                           ;
	if (open === undefined) return undefined;

	const end   = items.at(-1)?.getEnd() ?? open + 1 ;
	const close = tokenAfter(source, end, ")")       ;
	if (close === undefined || close !== call.getEnd() - 1) return undefined;

	const boundaries: RowBoundary[] = [];
	if (isPropertyAccessExpression(callee)) {
		const receiverEnd = callee.expression.getEnd()                         ;
		const dot         = tokenAfter              (source, receiverEnd, ".") ;
		if (dot === undefined || !spacesOnly(source, dot + 1, callee.name.getStart(source))) return undefined;
		boundaries.push({ axis: "call-member-dot", from: receiverEnd, at: dot, insert: true, layer: "call-envelope" });
	}
	boundaries.push({ axis: "call-envelope-open", from: callee.getEnd(), at: open, insert: true, layer: "call-envelope" });
	// Empty calls retain (), including their zero inner width.
	if (items.length === 0 && close !== open + 1) return undefined;
	if (items.length > 0) boundaries.push({ axis: "call-envelope-close", from: end, at: close, insert: true, layer: "call-envelope" });

	return boundaries;
}

/** Existing direct same-call argument layers keep their key; empty calls and non-null wrappers use the new envelope contract. */
function withCallEnvelope(source: SourceFile, kind: RowKind, run: readonly DetectedRow[]): readonly DetectedRow[] {
	if (kind.name !== "declaration" || run.length < 2)                          return run;

	const calls = run.map(row => envelopeCall(row.node));
	if (calls.some(call => call === undefined))                                 return run;

	const legacyCalls = run.map(row => declarationCall(row.node))                ;
	const signatures  = new Set(calls.map(call => callSignature(source, call!))) ;
	if (signatures.size === 1 && legacyCalls.every(call => call !== undefined)) return run;

	const envelopes = calls.map(call => envelopeBoundaries(source, call!));
	if (envelopes.some(boundaries => boundaries === undefined))                 return run;

	return run.map((row, index) => ({
		node: row.node,
		boundaries: [...row.boundaries.filter(boundary => boundary.layer === undefined), ...envelopes[index]!],
	}));
}

/** An argument cell this much wider than the second widest in its column is an outlier (import rule B); the layer is not applied. */
const OUTLIER_GAP = 20;

/**

product/engine/typescript/align.ts SHA256 5fb06eb1efcb3ad0e90b22dab4cd6bf170fab06ca9a88eab987479bec8852677
interface Edit {
	readonly start : number ;
	readonly end   : number ;
	readonly text  : string ;
}

interface TableGroup {
	readonly kind      : string ;
	readonly startLine : number ;
	readonly endLine   : number ;
	readonly rowCount  : number ;
	/** Exact row membership for noncontiguous guard regions. */
	readonly rowLines? : readonly number[];
	/** Rows rendered as the declaration vertical form; their edits replace the whole row and may insert line breaks. */
	readonly vertical : number            ;
	readonly axes     : readonly string[] ;
	readonly skipped  : readonly string[] ;
	readonly edits    : readonly Edit[]   ;
	/** The immediate AST container of the table (SourceFile, Block, InterfaceDeclaration, …) and its nesting depth. */
	readonly context   : string            ;
	readonly depth     : number            ;
}
		}
	}
	return { axes, skipped, targets, edits };
}

function buildGroup(source: SourceFile, kindName: string, groupName: string, run: readonly DetectedRow[], context: string, depth: number): TableGroup {
	const straight = run.filter(row => row.vertical === undefined) ;
	const marked   = run.filter(row => row.vertical !== undefined) ;
	const aligned  = alignRows(source, straight)                   ;
	// The vertical rows take the table's `=` column; with no aligned equals axis, the widest anchor of the run sets it.
	const equalsRows   = run.filter(row => row.boundaries.some(boundary => boundary.axis === "equals"))                                                                                    ;
	const equalsTarget = aligned.targets.get("equals") ?? Math.max(...equalsRows.map(row => displayColumn(source, row.boundaries.find(boundary => boundary.axis === "equals")!.from))) + 1 ;
	const newline      = source.text.includes("\r\n") ? "\r\n" : "\n"                                                                                                                      ;
	// The render carries the statement's own indentation, so the edit replaces the whole line's code, from its start.
	const verticalEdits = marked.map(row => {
		const start     = row.node.getStart(source)                                                                 ;
		const lineStart = source.getPositionOfLineAndCharacter(source.getLineAndCharacterOfPosition(start).line, 0) ;
		return { start: lineStart, end: row.node.getEnd(), text: verticalCallText(source, row, equalsTarget, newline) };
	})                                                                                                                                                                                      ;
	const edits         = [...aligned.edits, ...verticalEdits]                                                                                                                              ;
	if (process.env.DEBUG_ALIGN) {
		for (const row of run) {
			const line = source.getLineAndCharacterOfPosition(row.node.getStart(source)).line + 1     ;
			const text = source.text.slice(row.node.getStart(source), row.node.getEnd()).slice(0, 50) ;
			console.error(`    row line=${line} [${text}] ${row.boundaries.map(b => `${b.axis}(from=${displayColumn(source, b.from)},at=${displayColumn(source, b.at)})`).join(" ")}`);
		}
	}
	const first = run[0]!.node     ;
	const last  = run.at(-1)!.node ;
	return {
		kind      : groupName,
		startLine : source.getLineAndCharacterOfPosition(first.getStart(source)).line + 1,
		endLine   : source.getLineAndCharacterOfPosition(last.getEnd() - 1).line + 1,
		rowCount  : run.length,
		...(kindName === "return-guards" ? { rowLines: run.map(row => source.getLineAndCharacterOfPosition(row.node.getStart(source)).line + 1) } : {}),
		vertical  : marked.length,
		context   : context,
		depth     : depth,
		axes      : aligned.axes,
		skipped   : aligned.skipped,
		edits,
	};
}

					emit(`  ${kind.name}: ${boundaries.map(boundary => `${boundary.axis}@${displayColumn(source, boundary.at)}`).join(" ")}`);
				} catch {
					// A detector failing to read this node is itself diagnostic information, so skip silently.
				}
			}
			if (!matched) emit("  no registered kind — classify with 01, then register the kind and axes in grid-kinds.ts");
		}
		return 0;
	}
	const report = (parse: ResultParse): void => {
		if (!json) return;
		const resultGroups: ResultGroup[] = [
			...groups.map(group => ({ kind: group.kind, startLine: group.startLine, endLine: group.endLine, rows: group.rowCount, rowLines: group.rowLines, axes: group.axes, state: group.edits.length > 0 ? "FIXABLE" as const : "PASS" as const, edits: group.edits.length, context: group.context, depth: group.depth })),
			...refused.map(group => ({ kind: group.kind, startLine: group.startLine, endLine: group.endLine, rows: group.rowCount, rowLines: group.rowLines, axes: group.axes, state: "REFUSE" as const, edits: group.edits.length, context: group.context, depth: group.depth })),
			...result.compressed.map(entry => ({ kind: "interface-members-compressed", startLine: entry.line, endLine: entry.line, rows: entry.members, axes: [], state: "SUGGEST" as const, edits: 0 })),
		].sort((left, right) => left.startLine - right.startLine);
		emit(JSON.stringify(envelope([{ file: relative, language: "typescript", mode: write ? "write" : "check", summary: summarize(resultGroups), groups: resultGroups, parse }]), null, 2));

product/engine/common/result-json.ts SHA256 53db81999b37bcbf692c71e941fd17fd84fb1935a4279a2fde645543e8b2a3e8
/**
 * Versioned machine-readable result shared by every aligner (`--json`, design §3.3). The TypeScript aligner and all
 * line-engine aligners emit the same envelope, so agents, CI and the corpus tools read one format.
 */
export const RESULT_SCHEMA_VERSION = 1;

/** PASS aligned · FIXABLE whitespace edits pending · SUGGEST needs a person (pairs, compressed rows) · REFUSE unsafe. */
export type GroupState = "PASS" | "FIXABLE" | "SUGGEST" | "REFUSE";

export interface ResultGroup {
	readonly kind      : string            ;
	readonly startLine : number            ;
	readonly endLine   : number            ;
	readonly rows      : number            ;
	/** Exact 1-based row lines for noncontiguous tables; absent means the inclusive start/end span. */
	readonly rowLines? : readonly number[] ;
	readonly axes      : readonly string[] ;
	readonly state     : GroupState        ;
	readonly edits     : number            ;
	/** The immediate container of the table (TypeScript: the AST container kind); omitted where unknowable. */
	readonly context?  : string            ;
	/** How deeply nested the table's container is (0 = top level). */
	readonly depth?    : number            ;
}

export interface ResultParse {
	/** `not-run` in check mode; the re-parse gate runs only when writing. */
	readonly status  : "ok" | "changed" | "skipped" | "not-run" ;
	readonly tool    : string                                   ;
	readonly passes? : number                                   ;
}

export interface ResultSummary {
	readonly groups     : number ;
	readonly misaligned : number ;
	readonly edits      : number ;
	readonly refused    : number ;
	readonly suggested  : number ;
}

export interface FileResult {
	readonly file     : string                 ;
	readonly language : string                 ;
	readonly mode     : "check" | "write"      ;
	readonly summary  : ResultSummary          ;
	readonly groups   : readonly ResultGroup[] ;
	readonly parse    : ResultParse            ;
}

export interface ResultEnvelope {
	readonly schemaVersion : number                ;
	readonly tool          : "boxbox"              ;
	readonly results       : readonly FileResult[] ;
}

/** Builds the summary from the groups so the two can never disagree. */
export function summarize(groups: readonly ResultGroup[]): ResultSummary {
	return {
		groups     : groups.length,
		misaligned : groups.filter(group => group.state === "FIXABLE").length,
		edits      : groups.filter(group => group.state === "FIXABLE").reduce((count, group) => count + group.edits, 0),
		refused    : groups.filter(group => group.state === "REFUSE").length,
		suggested  : groups.filter(group => group.state === "SUGGEST").length,
	};
}

export const envelope = (results: readonly FileResult[]): ResultEnvelope => ({ schemaVersion: RESULT_SCHEMA_VERSION, tool: "boxbox", results });


product/engine/common/report.ts SHA256 d7b17f94323eae9a85cbdf1d4fdb3530adf6ce64b1dbb91bf44b839d46434a48
	const content = body.replace(/\s/gu, "").length                                                    ;
	return { padding, content };
}

/** Noncontiguous table spans describe their extent, not ownership of every line inside that extent. */
function rowLinesOf(group: ResultGroup): readonly number[] {
	return group.rowLines ?? Array.from({ length: group.endLine - group.startLine + 1 }, (_, index) => group.startLine + index);
}

function alarmsOf(input: ReportInput, limits: ReportLimits): readonly ReportAlarm[] {
	const { result, text } = input;
	const lines                 = text.split("\n").map(line => line.replace(/\r$/u, ""))                    ;
	const widthOf               = (lineNumber: number): number => displayWidth(lines[lineNumber - 1] ?? "") ;
	const alarms: ReportAlarm[] = []                                                                        ;
	const push = (id: AlarmId, startLine: number, endLine: number, detail: string, hint: string): void => {
		const anchor = (lines[startLine - 1] ?? "").trim().replace(/\s+/gu, " ");
		alarms.push({ id, label: ALARM_LABELS[id], startLine, endLine, detail, hint, anchor });
	};
	const groupAt = (lineNumber: number): ResultGroup | undefined =>
		result.groups.find(group => group.rowLines !== undefined
			? group.rowLines.includes(lineNumber) : group.startLine <= lineNumber && lineNumber <= group.endLine);

	// ① Screen axis: lines that cause horizontal scrolling. Lines in the same table are grouped into one alarm, noting the pattern and column count (density axis).
	const reported = new Set<ResultGroup>();
	for (let lineNumber = 1; lineNumber <= lines.length; lineNumber += 1) {
		const width = widthOf(lineNumber)                                                                            ;
		if (width <= limits.hard) continue                                                                           ;
		const group = groupAt(lineNumber)                                                                  ;
		const hint  = "make only the overflowing rows vertical, or simplify the exceptional element first" ;
		if (!group) {
			push("A1", lineNumber, lineNumber, `${width} cols > hard ${limits.hard} · outside table`, hint);
			continue;
		}
		if (reported.has(group)) continue                                                                            ;
		reported.add(group)                                                                                          ;
		const rows   = rowLinesOf (group                            ) ;
		const over   = rows.filter(row => widthOf(row) > limits.hard) ;
		const widest = Math.max   (...over.map(widthOf)             ) ;
		push("A1", group.startLine, group.endLine, `${over.length} row(s) over hard ${limits.hard} (max ${widest} cols) · pattern ${patternName(result.language, group) ?? "?"} · columns ${group.axes.length}`, hint);
	}

	// Out-of-table padding: with no rows to compare there must be no columns either (grammar section 1, statement regime).
	for (let lineNumber = 1; lineNumber <= lines.length; lineNumber += 1) {
		if (groupAt(lineNumber)) continue;

		const padding = straySemicolonPadding(lines, lineNumber - 1);
		if (padding !== undefined) push("A12", lineNumber, lineNumber, `${padding} space(s) before ;`, "do not align columns outside a table: remove the spaces");
	}

	for (const group of result.groups) {
		const rows    = rowLinesOf(group)                         ;
		const widths  = rows.map(widthOf)                         ;
		const widest  = Math.max(...widths)                       ;
		const pattern = patternName(result.language, group)       ;
		const span    = [group.startLine, group.endLine] as const ;

		if (widest > limits.soft && widest <= limits.hard) push("A2", ...span, `table width ${widest} > soft ${limits.soft}`, "allowed range; check whether it can be simplified");

		const sorted = [...widths].sort((left, right) => right - left);
		if (sorted.length >= 3 && sorted[0]! - sorted[1]! >= limits.outlierGap) {
			const row = rows[widths.indexOf(sorted[0]!)]!;
			push("A3", row, row, `longest row is ${sorted[0]! - sorted[1]!} cols wider than the second`, "simplify that row's exceptional element first");
		}

		if (group.state === "FIXABLE") push("A0", ...span, `${group.kind} ${group.rows} rows, pending edits ${group.edits}`, "fixable by whitespace alignment (safe): 06_align-tables.ts --file <file> --write");
		if (group.state === "REFUSE" ) push("A4", ...span, `${group.kind}: cannot split losslessly`, "check the row structure; if it is an engine bug, add a fixture");
		if (group.state === "SUGGEST") push("A6", ...span, `${group.kind} ${group.rows} rows`, "a human decides whether to make it a table");

		if (pattern === undefined) push("A8", ...span, `${group.kind} (axes ${group.axes.map(axis => axis.split("=")[0]).join(">")})`, "add a mapping to the surface-form data");
		else if (pattern.includes("|")) push("A5", ...span, `${pattern}`, "pattern the engine cannot distinguish; decided by verdict");

		const padding = rows.map(row => paddingOf(lines[row - 1] ?? "")).reduce((sum, cell) => ({ padding: sum.padding + cell.padding, content: sum.content + cell.content }), { padding: 0, content: 0 });
		if (padding.content > 0 && padding.padding / padding.content > limits.paddingRatio) {
			push("A7", ...span, `alignment spaces ${padding.padding} / content ${padding.content}`, "check whether the spaces pull semantic units apart");
		}

		if (group.state === "FIXABLE" && group.edits >= limits.largeEdits) push("A9", ...span, `pending edits ${group.edits}`, "a human reviews the before and after");
	}
	return alarms.sort((left, right) => left.startLine - right.startLine || left.id.localeCompare(right.id));
}

/** Looks up the pattern DB with each table's lookup key. A two-row pair is not a table, so it is not looked up. */
function conventionsOf(result: FileResult, db: ConventionDb): ConventionSummary {
	const counts                       = { approved: 0, rejected: 0, unknown: 0, conflict: 0 } ;

test/typescript-matrix-boundaries.test.ts SHA256 a3782c74e76e029e2448a1b6fb685e8ae33dadf80766efee074d49bb4bbf4199
import      { afterEach, describe, expect, test                } from "bun:test"                           ;
import      { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs"                            ;
import      { tmpdir                                           } from "node:os"                            ;
import      { join, resolve                                    } from "node:path"                          ;
import      { preservesTokens                                  } from "@/typescript/token-preservation.ts" ;
import type { ResultEnvelope, ResultGroup                      } from "@/common/result-json.ts"            ;
import      { lookupKeyOf                                      } from "@/common/signature.ts"              ;

const script               = resolve(import.meta.dir, "../product/engine/typescript/06_align-tables.ts") ;
const workspaces: string[] = []                                                                          ;

afterEach(() => {
	for (const workspace of workspaces.splice(0)) rmSync(workspace, { recursive: true, force: true });
});

function align(lines: readonly string[]): { text: string; groups: readonly ResultGroup[] } {
	const root   = mkdtempSync(join(tmpdir(), "boxbox-matrix-")) ;
	const file   = join(root, "sample.ts")                       ;
	const before = `${lines.join("\n")}\n`                       ;

	workspaces.push(root);
	writeFileSync(file, before);

	const first = Bun.spawnSync(["bun", script, "--file", "sample.ts", "--write", "--json"], { cwd: root });
	expect(first.exitCode).toBe(0);
	if (first.exitCode !== 0) throw new Error(first.stderr.toString());

	const text    = readFileSync (file, "utf8"                                                   ) ;
	const checked = Bun.spawnSync(["bun", script, "--file", "sample.ts", "--json"], { cwd: root }) ;

	expect(checked.exitCode                                    ).toBe   (0                                                     ) ;
	expect(preservesTokens(before, text)                       ).toBe   (true                                                  ) ;
	expect(text.split("\n").length                             ).toBe   (before.split("\n").length                             ) ;
	expect(text.split("\n").map(line => /^\s*/u.exec(line)![0])).toEqual(before.split("\n").map(line => /^\s*/u.exec(line)![0])) ;

	const report = JSON.parse(checked.stdout.toString()) as ResultEnvelope;

	return { text, groups: report.results[0]!.groups };
}

describe("matrix syntax boundaries", () => {
	test("shares the receiver-method dot as well as outer call parentheses", () => {
		const result = align([
			"const rows = Array.from(items);",
			"const over = rows.filter(isVisible);",
		]);

		expect(result.text).toBe("const rows = Array.from  (items    ) ;\nconst over = rows .filter(isVisible) ;\n");
		expect(result.groups[0]!.axes).toContain("call-member-dot=18");
	}, 60_000);

	test("matches the final method separator while preserving nested receivers and argument dots", () => {
		const result = align([
			"const rows = registry.rows.from(items);",
			"const over = rows.filter(value => value.amount > 1.5 && value.name === 'a.b');",
			"const plain = resolve(items);",
		]);
		const lines = result.text.split("\n");

		expect(lines[0]!.indexOf(".from")).toBe     (lines[1]!.indexOf(".filter")                         ) ;
		expect(lines[0]                  ).toContain("registry.rows"                                      ) ;
		expect(lines[1]                  ).toContain("value => value.amount > 1.5 && value.name === 'a.b'") ;
		expect(result.groups[0]!.kind    ).toBe     ("declaration-call-envelope"                          ) ;
	}, 60_000);

	test("keeps member-boundary comments outside the call-envelope contract", () => {
		const result = align([
			"const rows = Array /* keep */ .from(items);",
			"const over = rows. /* keep */ filter(isVisible);",
		]);

		expect(result.text                                                            ).toContain("Array /* keep */ .from(items)"     ) ;
		expect(result.text                                                            ).toContain("rows. /* keep */ filter(isVisible)") ;
		expect(result.groups.some(group => group.kind === "declaration-call-envelope")).toBe     (false                               ) ;
	}, 60_000);

	test("shares return columns across declarations and blank lines without moving statements", () => {
		const result = align([
			"function read(value: unknown) {",
			"\tif (!value) return undefined;",
			"\tconst declared = value;",
			"",
			"\tif (declared === undefined) return undefined;",
			"\tconst unwrapped = declared;",
			"\tif (typeof unwrapped !== 'string') return undefined;",
			"\treturn unwrapped;",
			"}",
		]);

		expect(result.text).toBe([
			"function read(value: unknown) {",
			"\tif (!value)                        return undefined;",
			"\tconst declared = value;",
			"",
			"\tif (declared === undefined)        return undefined;",
			"\tconst unwrapped = declared;",
			"\tif (typeof unwrapped !== 'string') return undefined;",
			"\treturn unwrapped;",
			"}",
			"",
		].join("\n"));
		expect(result.groups.filter(group => group.kind === "return-guards")).toHaveLength(1);
	}, 60_000);

	test("comments, unsupported guards, terminal statements and nested declarations break guard regions", () => {
		const barriers = [
			"\t// a separate region",
			"\tif (other) { return undefined; }",
			"\tif (other) return undefined; else handle();",
			"\treturn undefined;",
			'\tthrow new Error("stop");',
			"\tbreak;",
			"\tcontinue;",
			"\tfunction nested() {}",
			"\tclass Nested {}",
		];
		const lines = barriers.flatMap((barrier, index) => [
			`function check${index}() {`,
			"\tfor (;;) {",
			"\tif (a) return undefined;",
			"\tif (longCondition) return undefined;",
			barrier,
			"\tif (b) return undefined;",
			"\tif (anotherLongCondition) return undefined;",
			"\t}",
			"}",
		]);
		const result = align(lines);

		expect(result.text).toBe(`${lines.join("\n")}\n`);
		expect(result.groups.filter(group => group.kind === "return-guards")).toHaveLength(0);
	}, 60_000);

	test("subjectCall-shaped guards share return columns across while, statements and multiline declarations", () => {
		const result = align([
			"function subjectCall(node: Node): Node | undefined {",
			"\tif (!isExpressionStatement(node)) return undefined;",
			"\tconst expression = unwrapExpression(node.expression);",
			"\tif (!isCallExpression(expression) || !isPropertyAccessExpression(expression.expression)) return undefined;",
			"\tlet subject: Node = expression.expression.expression;",
			"\twhile (isPropertyAccessExpression(subject)) subject = subject.expression;",
			"\tobserve(subject);",
			"\tconst intermediate = (\n\t\tsubject\n\t);",
			"\tif (!isCallExpression(subject) || subject.arguments.length !== 1) return undefined;",
			"\tconst argument = subject.arguments[0]!;",
			"\treturn isCallExpression(argument) && argument.arguments.length > 0 ? argument : undefined;",
			"}",
		]);
		const guards = result.text.split("\n").filter(line => line.startsWith("\tif ("));

		expect(guards                                                       ).toHaveLength(3                                                                            ) ;
		expect(new Set(guards.map(line => line.indexOf("return")))          ).toHaveLength(1                                                                            ) ;
		expect(result.groups.filter(group => group.kind === "return-guards")).toHaveLength(1                                                                            ) ;
		expect(result.text                                                  ).toContain   ("\twhile (isPropertyAccessExpression(subject)) subject = subject.expression;") ;
	}, 60_000);

	test("callLayer-shaped guards bridge a for block whose own guards have independent return columns", () => {
		const result = align([
			"function callLayer(source: SourceFile, call: Node) {",
			"\tif (call.typeArguments) return undefined;",
			"\tconst callee = call.expression;",
			"\tconst open = tokenAfter(source, callee.getEnd(), '(');",
			"\tconst items = callArguments(call);",
			"\tif (open === undefined || items.length === 0) return undefined;",
			"\tconst boundaries: RowBoundary[] = [];",
			"\tfor (let index = 0; index + 1 < items.length; index += 1) {",
			"\t\tconst end = items[index]!.getEnd();",
			"\t\tconst comma = tokenAfter(source, end, ',');",
			"\t\tif (comma === undefined) return undefined;",
			"\t\tconst next = items[index + 1]!.getStart(source);",
			"\t\tif (!spacesOnly(source, comma + 1, next)) return undefined;",
			"\t\tif (next === end) return undefined;",
			"\t\tboundaries.push({ from: end, at: comma });",
			"\t}",
			"\tconst last = items.at(-1)!.getEnd();",
			"\tconst close = tokenAfter(source, last, ')');",
			"\tif (close === undefined || close !== call.getEnd() - 1) return undefined;",
			"\treturn boundaries;",
			"}",
		]);
		const outer  = result.text.split("\n").filter(line => line.startsWith("\tif ("))   ;
		const inner  = result.text.split("\n").filter(line => line.startsWith("\t\tif (")) ;
		const groups = result.groups.filter(group => group.kind === "return-guards")       ;

		expect(outer                                             )    .toHaveLength(3                          ) ;
		expect(inner                                             )    .toHaveLength(3                          ) ;
		expect(groups                                            )    .toHaveLength(2                          ) ;
		expect(new Set(outer.map(line => line.indexOf("return"))))    .toHaveLength(1                          ) ;
		expect(new Set(inner.map(line => line.indexOf("return"))))    .toHaveLength(1                          ) ;
		expect(outer[0]!.indexOf("return")                       ).not.toBe        (inner[0]!.indexOf("return")) ;
		expect(groups.every(group => group.rows === 3)           )    .toBe        (true                       ) ;
	}, 60_000);

	test("does not pad commented condition boundaries or span nested guard scopes", () => {
		const lines = [
			"function check() {",
			"\tif (a) /* keep */ return undefined;",
			"\tif (bbb) /* keep */ return undefined;",
			"\tif (cc) /* keep */ return undefined;",
			"\tif (outer) return undefined;",
			"\t{",
			"\t\tif (x) return undefined;",
			"\t\tif (longInner) return undefined;",
			"\t\tif (z) return undefined;",
			"\t}",
			"\tif (veryLongOuter) return undefined;",
			"}",
		];
		const result = align               (lines                                  ) ;
		const guards = result.groups.filter(group => group.kind === "return-guards") ;

		expect(guards              ).toHaveLength(1                                      ) ;
		expect(guards[0]!.startLine).toBe        (7                                      ) ;
		expect(guards[0]!.endLine  ).toBe        (9                                      ) ;
		expect(result.text         ).toContain   ("\tif (outer) return undefined;"       ) ;
		expect(result.text         ).toContain   ("\tif (a) /* keep */ return undefined;") ;
	}, 60_000);

	test("aligns different callable envelopes and preserves the trailing non-null assertion", () => {
		const result = align([
			"const decision = registry.decisions.get(convention.id)!;",
			"const document = resolveDocument(decision.ref, convention.layer);",
		]);

		expect(result.text).toBe([
			"const decision = registry.decisions.get(convention.id                 )! ;",
			"const document = resolveDocument       (decision.ref, convention.layer)  ;",
			"",
		].join("\n"));
		expect(result.groups[0]!.kind).toBe("declaration-call-envelope");
		expect(result.groups[0]!.axes.some((axis: string) => axis.startsWith("call-comma"))).toBe(false);
	}, 60_000);

	test("keeps heterogeneous arguments opaque, including different arities, literals and nested calls", () => {
		const result = align([
			'const a = first("(,)", nested(x, y));',
			'const longer = second("hello");',
			'const third = thirdCall(x, /* inside */ y, z);',
		]);
		const lines = result.text.trimEnd().split("\n");

		expect(new Set(lines.map(line => line.indexOf("(", line.indexOf("="))))).toHaveLength(1                                ) ;
		expect(new Set(lines.map(line => line.lastIndexOf(")")))               ).toHaveLength(1                                ) ;
		expect(result.text                                                     ).toContain   ('first    ("(,)", nested(x, y)'  ) ;
		expect(result.text                                                     ).toContain   ('thirdCall(x, /* inside */ y, z)') ;
	}, 60_000);

	test("zero argument calls retain compact parentheses while sharing the opening column", () => {
		const result = align([
			"const a = short();",
			"const bb = muchLonger(value, other);",
		]);

		expect(result.text).toBe("const a  = short     ()             ;\nconst bb = muchLonger(value, other) ;\n");
		expect(result.groups[0]!.axes.some((axis: string) => axis.startsWith("call-envelope-close"))).toBe(false);
	}, 60_000);

	test("keeps await/new/optional/type-argument/computed calls outside the new envelope contract", () => {
		const expressions = ["await first(x)", "new First(x)", "first?.(x)", "object?.first(x)", "first<string>(x)", "object[key](x)", "factory().first(x)", "first /* note */ (x)", "first(x,)", "first(x /* note */)"];
		const result = align(expressions.flatMap((expression, index) => [
			`const value${index} = ${expression};`,
			`const longer${index} = other(x, y);`,
			"",
		]));

		expect(result.groups.some(group => group.kind === "declaration-call-envelope")).toBe(false);
	}, 60_000);

	test("preserves the approved same-call key and output while new envelopes have distinct keys", () => {
		const approved      = align(["const short = make(1);", "const muchLonger = make(22);", "const middle = make(333);"]) ;
		const heterogeneous = align(["const short = first(1);", "const longer = other(22);"])                                ;
		const group         = approved.groups[0]!                                                                            ;

		expect(approved.text                                                   ).toBe("const short      = make(1  ) ;\nconst muchLonger = make(22 ) ;\nconst middle     = make(333) ;\n") ;
		expect(lookupKeyOf("typescript", group.context, group.kind, group.axes)).toBe("v1|typescript|SourceFile|declaration-equals|equals>call-open-paren>call-close-paren>semicolon"   ) ;
		expect(heterogeneous.groups[0]!.kind                                   ).toBe("declaration-call-envelope"                                                                       ) ;
	}, 60_000);
});


product/plugin/skills/boxbox/SKILL.md SHA256 cdfb7908745f37e33911a845d454b9cd00fe676a53e885afeb9867ede066053b
---
name: boxbox
description: Write, refactor, align or check TypeScript and Python code when the user requests BoxBox or spreadsheet-style readability, comparing same-role rows in minimum-width columns.
---

# BoxBox Code Readability

Let the reader follow execution top to bottom and compare same-role rows vertically. Rows share a comparison purpose;
columns are corresponding syntax boundaries, and cells hold their content. A comma in a nested call is not the same
axis as an outer argument separator. Use minimum-width columns without inventing work, wrappers or parameters to fill a grid.

## Choose the workflow

| Request | Workflow | Allowed change |
|---|---|---|
| Write new code using BoxBox readability | **Write** | The agent implements the requested behavior using applicable guidance. |
| Restructure existing code for BoxBox readability | **Refactor** | The agent improves structure within the authorized scope while preserving required behavior. |
| Align existing code without structural changes | **Align** | The engine changes approved horizontal whitespace only. |
| Inspect or review readability | **Check** | Report findings without changing source. |

Write and Refactor are agent workflows, not CLI generation commands. Follow an explicit mode choice. For an ambiguous
"fix" request, check first and clarify when the choice between structural changes and alignment affects the result.
Preview is an execution option for every workflow: present a proposed diff without modifying the target file.
Work one file at a time within the user's authorized scope; continue across authorized files without requiring fresh feedback for each file.

## Running the engine

Every check and fix goes through the bundled launcher. Resolve `<PLUGIN_ROOT>` from this skill location (`../..`) and run it from the root of the target repository. The standard shim requires `BOXBOX_CLI` to point to a locally installed engine; the BoxBox npm installer configures its own launcher during installation. Never fetch `boxbox` from npm: that registry name is owned by an unrelated package.

```bash
"<PLUGIN_ROOT>/scripts/boxbox" doctor                      # runtime, parser, config and approval data status
"<PLUGIN_ROOT>/scripts/boxbox" check  --file <file> --json  # read-only check
"<PLUGIN_ROOT>/scripts/boxbox" guide  --file <file> --json  # approved rules and examples that apply to this file
"<PLUGIN_ROOT>/scripts/boxbox" guide  --file <file> --authoring --json
"<PLUGIN_ROOT>/scripts/boxbox" align  --file <file> --dry-run --json
"<PLUGIN_ROOT>/scripts/boxbox" align  --file <file> --json
"<PLUGIN_ROOT>/scripts/boxbox" format --file <file> --dry-run --json
"<PLUGIN_ROOT>/scripts/boxbox" format --file <file> --json
```

- The implemented public commands accept TypeScript and Python files **one at a time**. JSON/YAML are planned, not supported. Fixing Python requires a runnable `python3`.
- `guide --authoring` reads approved guidance for the target language and scope, including a new or empty file.
  Its examples guide composition; they do not prove that a proposed file is approved or safe to write.
- `align` runs without an external formatter and preserves line structure, indentation and non-layout content.
  If the engine needs wrapping or another structural change, report the refusal; stay within the selected mode.
- `format` retains the formatter pipeline for explicit requests to use it. If a formatter is configured for the language, it runs first.
  `format --dry-run` also executes a configured formatter twice; inspect its command and arguments in the effective config
  before running it. Use existing authorization; ask only when executing that command is outside the authorized work.
  Human approval proof, re-parsing, preservation and a two-run fixed point must pass; report any refusal reason to the user.
- Do not look for or run other alignment scripts or bypass options.

## Write and Refactor

1. Run `guide --authoring --json` for the intended file before composing a change. For an existing file, also run
   `check --json` and read its definitions, callers and relevant tests before changing its structure.
2. Build a boundary inventory for the requested rows: name each cell, its syntax boundary and its comparison region.
   For a member call, inspect `receiver | final . | method | ( | arguments | )`; for a guard, inspect `condition | return | value`.
   Match roles and nesting depth before matching punctuation. Function signatures, bodies and call sites have separate
   regions. For member calls, early returns or nested type members, read
   [column-sharing regions](references/readability-contract.md#column-sharing-regions) before choosing widths or moving rows.
3. Author the requested implementation or structural improvement. Preserve execution order, public contracts and meaningful
   differences. An overlong exception is a reason to inspect responsibility and data flow, not permission to add abstractions
   just to shorten a column. Structural guidance is advisory; report unsupported patterns instead of inventing approval data.
   An explicit user request for a local layout change can guide this authoring pass; it does not create reusable preset
   approval or bypass the deterministic Align procedure.
4. For preview, show the proposed diff and distinguish checks run on a proposal from checks run on the target. For an
   authorized application, inspect the diff, run relevant syntax/type and behavior checks, and assess performance-sensitive
   changes with appropriate evidence. Alignment cannot prove behavioral equivalence or performance.
5. Where approved and requested, use Align below for final whitespace. Then run the final `check --json` and reconcile
   every requested boundary with its returned group axes. Account for missing axes, including unsupported or single-row
   boundaries. Inspect their actual columns and record manual verification or an unresolved coverage gap. Completion requires
   each requested boundary to be verified or explicitly reported unresolved, alongside remaining findings and checks not run.
   When the user or project instructions require issue-history records, use that schema within the authorized scope to
   retain the reproduction, cause, decision and verification evidence, including failed attempts and unresolved work.

## Check and Align

1. Run `check --json`. Read `formatReadiness` (approval eligibility; write verification is still `not-run`), `groups`
   and their `PASS`, `FIXABLE`, `REFUSE` states. A refused group stays unchanged by alignment.
2. Read `guide --json` for applicable approved rules. With no approved rule, report the candidate and missing evidence;
   do not align it by hand, auto-approve it or use a raw writer.
3. For Check, report findings. For Align preview, run `align --dry-run --json`. For authorized application, inspect the
   dry-run result and then run `align --json`; report refusal reasons without falling back to `format` or Refactor.
4. After application, rerun `check --json`, reconcile user-requested boundaries with the final returned axes, and report
   missing coverage alongside the remaining `misaligned` count. Zero detected groups
   or zero misalignment does not prove that unsupported code follows the requested style. Report only validations actually run.

## Rule documents

Read the documents in this folder when a judgment is needed.

- `references/charter.md` — principles and safety invariants
- `references/grammar.md` — grammar units, patterns, roles, paragraphs (split with a blank line when the property differs)
- `references/readability-contract.md` — confirmed rules, discarded rules, column-check order
- `references/typescript-grid-template.md` — per-role TypeScript table templates

## Authoring hooks

The plugin hooks check TypeScript and Python files changed during the session, read-only, and report the result. They never fix anything automatically.
The npm-installed launcher requires the host's plugin data folder and writes receipts there. Direct CLI hooks installed
with `hooks install` can fall back to `.boxbox/hooks` when the host provides no data folder. Source files stay read-only.


Metadata scoped changes and regressions:
Read-only targeted follow-up to the initial Sonnet review: exact row membership for noncontiguous guard reports. Review ONLY this diff and its tests; prior detector and dot changes reviewed separately. No commands or edits. Check metadata production in normal/refused paths, compatibility for ordinary groups, report A1/A2/A3/A7 and A12 group ownership. Finish PASS/BLOCKED and concrete defects. 44 relevant tests and tsc passed.

--- before/product/engine/typescript/align.ts
+++ product/engine/typescript/align.ts
@@ -37,6 +37,8 @@
 	readonly startLine : number ;
 	readonly endLine   : number ;
 	readonly rowCount  : number ;
+	/** Exact row membership for noncontiguous guard regions. */
+	readonly rowLines? : readonly number[];
 	/** Rows rendered as the declaration vertical form; their edits replace the whole row and may insert line breaks. */
 	readonly vertical : number            ;
 	readonly axes     : readonly string[] ;
@@ -134,6 +136,7 @@
 		startLine : source.getLineAndCharacterOfPosition(first.getStart(source)).line + 1,
 		endLine   : source.getLineAndCharacterOfPosition(last.getEnd() - 1).line + 1,
 		rowCount  : run.length,
+		...(kindName === "return-guards" ? { rowLines: run.map(row => source.getLineAndCharacterOfPosition(row.node.getStart(source)).line + 1) } : {}),
 		vertical  : marked.length,
 		context   : context,
 		depth     : depth,
@@ -333,8 +336,8 @@
 	const report = (parse: ResultParse): void => {
 		if (!json) return;
 		const resultGroups: ResultGroup[] = [
-			...groups.map(group => ({ kind: group.kind, startLine: group.startLine, endLine: group.endLine, rows: group.rowCount, axes: group.axes, state: group.edits.length > 0 ? "FIXABLE" as const : "PASS" as const, edits: group.edits.length, context: group.context, depth: group.depth })),
-			...refused.map(group => ({ kind: group.kind, startLine: group.startLine, endLine: group.endLine, rows: group.rowCount, axes: group.axes, state: "REFUSE" as const, edits: group.edits.length, context: group.context, depth: group.depth })),
+			...groups.map(group => ({ kind: group.kind, startLine: group.startLine, endLine: group.endLine, rows: group.rowCount, rowLines: group.rowLines, axes: group.axes, state: group.edits.length > 0 ? "FIXABLE" as const : "PASS" as const, edits: group.edits.length, context: group.context, depth: group.depth })),
+			...refused.map(group => ({ kind: group.kind, startLine: group.startLine, endLine: group.endLine, rows: group.rowCount, rowLines: group.rowLines, axes: group.axes, state: "REFUSE" as const, edits: group.edits.length, context: group.context, depth: group.depth })),
 			...result.compressed.map(entry => ({ kind: "interface-members-compressed", startLine: entry.line, endLine: entry.line, rows: entry.members, axes: [], state: "SUGGEST" as const, edits: 0 })),
 		].sort((left, right) => left.startLine - right.startLine);
 		emit(JSON.stringify(envelope([{ file: relative, language: "typescript", mode: write ? "write" : "check", summary: summarize(resultGroups), groups: resultGroups, parse }]), null, 2));


--- before/product/engine/common/report.ts
+++ product/engine/common/report.ts
@@ -182,6 +182,11 @@
 	return { padding, content };
 }
 
+/** Noncontiguous table spans describe their extent, not ownership of every line inside that extent. */
+function rowLinesOf(group: ResultGroup): readonly number[] {
+	return group.rowLines ?? Array.from({ length: group.endLine - group.startLine + 1 }, (_, index) => group.startLine + index);
+}
+
 function alarmsOf(input: ReportInput, limits: ReportLimits): readonly ReportAlarm[] {
 	const { result, text } = input;
 	const lines                 = text.split("\n").map(line => line.replace(/\r$/u, ""))                    ;
@@ -192,7 +197,8 @@
 		alarms.push({ id, label: ALARM_LABELS[id], startLine, endLine, detail, hint, anchor });
 	};
 	const groupAt = (lineNumber: number): ResultGroup | undefined =>
-		result.groups.find(group => group.startLine <= lineNumber && lineNumber <= group.endLine);
+		result.groups.find(group => group.rowLines !== undefined
+			? group.rowLines.includes(lineNumber) : group.startLine <= lineNumber && lineNumber <= group.endLine);
 
 	// ① Screen axis: lines that cause horizontal scrolling. Lines in the same table are grouped into one alarm, noting the pattern and column count (density axis).
 	const reported = new Set<ResultGroup>();
@@ -207,9 +213,9 @@
 		}
 		if (reported.has(group)) continue                                                                            ;
 		reported.add(group)                                                                                          ;
-		const rows   = Array.from  ({ length: group.endLine - group.startLine + 1 }, (_, index) => group.startLine + index) ;
-		const over   = rows .filter(row => widthOf(row) > limits.hard                                                     ) ;
-		const widest = Math .max   (...over.map(widthOf)                                                                  ) ;
+		const rows   = rowLinesOf (group                            ) ;
+		const over   = rows.filter(row => widthOf(row) > limits.hard) ;
+		const widest = Math.max   (...over.map(widthOf)             ) ;
 		push("A1", group.startLine, group.endLine, `${over.length} row(s) over hard ${limits.hard} (max ${widest} cols) · pattern ${patternName(result.language, group) ?? "?"} · columns ${group.axes.length}`, hint);
 	}
 
@@ -222,11 +228,11 @@
 	}
 
 	for (const group of result.groups) {
-		const rows    = Array.from({ length: group.endLine - group.startLine + 1 }, (_, index) => group.startLine + index) ;
-		const widths  = rows.map(widthOf)                                                                                  ;
-		const widest  = Math.max(...widths)                                                                                ;
-		const pattern = patternName(result.language, group)                                                                ;
-		const span    = [group.startLine, group.endLine] as const                                                          ;
+		const rows    = rowLinesOf(group)                         ;
+		const widths  = rows.map(widthOf)                         ;
+		const widest  = Math.max(...widths)                       ;
+		const pattern = patternName(result.language, group)       ;
+		const span    = [group.startLine, group.endLine] as const ;
 
 		if (widest > limits.soft && widest <= limits.hard) push("A2", ...span, `table width ${widest} > soft ${limits.soft}`, "allowed range; check whether it can be simplified");
 


--- before/test/report.test.ts
+++ test/report.test.ts
@@ -1,11 +1,11 @@
 import      { describe, expect, test                                   } from "bun:test"                  ;
 import      { spawnSync                                                } from "node:child_process"        ;
-import      { mkdtempSync, readFileSync, writeFileSync                 } from "node:fs"                   ;
+import      { mkdtempSync, readFileSync, rmSync, writeFileSync         } from "node:fs"                   ;
 import      { tmpdir                                                   } from "node:os"                   ;
 import      { join                                                     } from "node:path"                 ;
 import      { displayWidth                                             } from "@/common/display-width.ts" ;
 import      { buildReport, compareAlarms, DEFAULT_LIMITS, renderReport } from "@/common/report.ts"        ;
-import type { FileResult, ResultGroup                                  } from "@/common/result-json.ts"   ;
+import type { FileResult, ResultEnvelope, ResultGroup                  } from "@/common/result-json.ts"   ;
 
 const ROOT = join(import.meta.dir, "..");
 
@@ -127,6 +127,76 @@
 	});
 });
 
+describe("check report — exact noncontiguous row membership", () => {
+	test("intervening long padded preparation lines stay outside guard width and padding calculations", () => {
+		const guards      = group({ kind: "return-guards", startLine: 1, endLine: 5, rows: 3, rowLines: [1, 3, 5], axes: ["guard-return=12"] }) ;
+		const preparation = `prepare()${" ".repeat(200)};`                                                                                      ;
+		const report = buildReport({
+			result: fileResult([guards]),
+			text: text("if (a) return;", preparation, "if (b) return;", "const value = 1;", "if (c) return;"),
+		});
+		const hard  = report.alarms.filter(alarm => alarm.id === "A1" ) ;
+		const stray = report.alarms.filter(alarm => alarm.id === "A12") ;
+
+		expect(hard.map(alarm => [alarm.startLine, alarm.endLine]))    .toEqual  ([[2, 2]]       ) ;
+		expect(hard[0]!.detail                                    )    .toContain("outside table") ;
+		expect(stray.map(alarm => alarm.startLine)                )    .toEqual  ([2]            ) ;
+		expect(ids(report)                                        ).not.toContain("A2"           ) ;
+		expect(ids(report)                                        ).not.toContain("A3"           ) ;
+		expect(ids(report)                                        ).not.toContain("A7"           ) ;
+	});
+
+	test("nested groups own their rows even when an outer guard region spans the whole nested block", () => {
+		const outer = group({ kind: "return-guards", startLine: 1, endLine: 9, rows: 3, rowLines: [1, 7, 9], axes: ["guard-return=12"]}) ;
+		const inner = group({ kind: "return-guards", startLine: 3, endLine: 5, rows: 3, rowLines: [3, 4, 5], axes: ["guard-return=12"]}) ;
+		const report = buildReport({
+			result: fileResult([outer, inner]),
+			text: text("if (a) return;", "for (;;) {", "  if (b) return;", `  if (c) return "${"x".repeat(140)}";`, "  if (d) return;", "}", "if (e) return;", "observe();", "if (f) return;"),
+		});
+		const hard    = report.alarms.filter(alarm => alarm.id === "A1") ;
+		const outlier = report.alarms.filter(alarm => alarm.id === "A3") ;
+
+		expect(hard.map(alarm => [alarm.startLine, alarm.endLine])).toEqual  ([[3, 5]]            ) ;
+		expect(hard[0]!.detail                                    ).toContain("1 row(s) over hard") ;
+		expect(outlier.map(alarm => alarm.startLine)              ).toEqual  ([4]                 ) ;
+	});
+
+	test("CLI emits exact outer and inner guard lines while ordinary groups keep the legacy schema", () => {
+		const root = mkdtempSync(join(tmpdir(), "boxbox-row-lines-"));
+		const lines = [
+			"function inspect() {",
+			"  if (a) return undefined;",
+			"  for (;;) {",
+			"    if (x) return undefined;",
+			"    if (yyyy) return undefined;",
+			"    if (z) return undefined;",
+			"  }",
+			"  if (longer) return undefined;",
+			"  const a = 1;",
+			"  const bb = 2;",
+			"  if (b) return undefined;",
+			"}",
+		];
+
+		try {
+			writeFileSync(join(root, "sample.ts"), `${lines.join("\n")}\n`);
+
+			const run    = spawnSync(process.execPath, [join(ROOT, "product/engine/typescript/06_align-tables.ts"), "--file", "sample.ts", "--json"], { cwd: root, encoding: "utf8" }) ;
+			const result = JSON.parse(run.stdout) as ResultEnvelope                                                                                                                    ;
+			const groups = result.results[0]!.groups                                                                                                                                   ;
+			const guards = groups.filter(entry => entry.kind === "return-guards")                                                                                                      ;
+
+			expect(run.status                                                                                   ).toBe   (1                      ) ;
+			expect(result.schemaVersion                                                                         ).toBe   (1                      ) ;
+			expect(guards.map(entry => entry.rowLines)                                                          ).toEqual([[2, 8, 11], [4, 5, 6]]) ;
+			expect(groups.some(entry => entry.kind === "declaration-equals")                                    ).toBe   (true                   ) ;
+			expect(groups.filter(entry => entry.kind !== "return-guards").every(entry => !("rowLines" in entry))).toBe   (true                   ) ;
+		} finally {
+			rmSync(root, { recursive: true, force: true });
+		}
+	}, 60_000);
+});
+
 describe("check report — output", () => {
 	test("the description column of the safety-check lines lines up in one column by display width", () => {
 		const rendered = renderReport(buildReport({ result: fileResult([]), text: "" })).split("\n").filter(line => /^  S\d /u.test(line)) ;


/**
 * Versioned machine-readable result shared by every aligner (`--json`, design §3.3). The TypeScript aligner and all
 * line-engine aligners emit the same envelope, so agents, CI and the corpus tools read one format.
 */
export const RESULT_SCHEMA_VERSION = 1;

/** PASS aligned · FIXABLE whitespace edits pending · SUGGEST needs a person (pairs, compressed rows) · REFUSE unsafe. */
export type GroupState = "PASS" | "FIXABLE" | "SUGGEST" | "REFUSE";

export interface ResultGroup {
	readonly kind      : string            ;
	readonly startLine : number            ;
	readonly endLine   : number            ;
	readonly rows      : number            ;
	/** Exact 1-based row lines for noncontiguous tables; absent means the inclusive start/end span. */
	readonly rowLines? : readonly number[] ;
	readonly axes      : readonly string[] ;
	readonly state     : GroupState        ;
	readonly edits     : number            ;
	/** The immediate container of the table (TypeScript: the AST container kind); omitted where unknowable. */
	readonly context?  : string            ;
	/** How deeply nested the table's container is (0 = top level). */
	readonly depth?    : number            ;
}

export interface ResultParse {
	/** `not-run` in check mode; the re-parse gate runs only when writing. */
	readonly status  : "ok" | "changed" | "skipped" | "not-run" ;
	readonly tool    : string                                   ;
	readonly passes? : number                                   ;
}

export interface ResultSummary {
	readonly groups     : number ;
	readonly misaligned : number ;
	readonly edits      : number ;
	readonly refused    : number ;
	readonly suggested  : number ;
}

export interface FileResult {
	readonly file     : string                 ;
	readonly language : string                 ;
	readonly mode     : "check" | "write"      ;
	readonly summary  : ResultSummary          ;
	readonly groups   : readonly ResultGroup[] ;
	readonly parse    : ResultParse            ;
}

export interface ResultEnvelope {
	readonly schemaVersion : number                ;
	readonly tool          : "boxbox"              ;
	readonly results       : readonly FileResult[] ;
}

/** Builds the summary from the groups so the two can never disagree. */
export function summarize(groups: readonly ResultGroup[]): ResultSummary {
	return {
		groups     : groups.length,
		misaligned : groups.filter(group => group.state === "FIXABLE").length,
		edits      : groups.filter(group => group.state === "FIXABLE").reduce((count, group) => count + group.edits, 0),
		refused    : groups.filter(group => group.state === "REFUSE").length,
		suggested  : groups.filter(group => group.state === "SUGGEST").length,
	};
}

export const envelope = (results: readonly FileResult[]): ResultEnvelope => ({ schemaVersion: RESULT_SCHEMA_VERSION, tool: "boxbox", results });


Current contract check:
bun test v1.4.0 (34cbb9a40)

test/plugin-contract.test.ts:
(pass) plugin distribution contract > package, Claude and Codex manifests and both marketplaces share name and version [0.42ms]
(pass) plugin distribution contract > plugin components live inside the plugin folder [0.13ms]
(pass) plugin distribution contract > the development skill lists every language; the shipped plugin introduces only the first public scope [0.38ms]
(pass) plugin distribution contract > the plugin folder does not drift from the single source [1.97ms]
(pass) plugin distribution contract > hooks call only the shim inside the plugin, and the shim requires an explicit local engine [0.15ms]
(pass) plugin distribution contract > the plugin folder stays within the directory submission limits [0.28ms]
(pass) plugin distribution contract > shipped docs never instruct running a nonexistent repository test [0.05ms]
(pass) plugin distribution contract > every table-kind axis has a human-readable note [0.06ms]

 8 pass
 0 fail
 174 expect() calls
Ran 8 tests across 1 file. [87.00ms]


Targeted test result:

 38 pass
 0 fail
 175 expect() calls
Ran 38 tests across 2 files. [17.61s]