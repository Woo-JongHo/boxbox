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
