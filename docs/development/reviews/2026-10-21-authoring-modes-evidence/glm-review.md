모든 증거를 수집했습니다. 최종 감사 보고서입니다.

---

# BoxBox 0.2.4 Write/Refactor/Align 최종 독립 감사 (GLM, 읽기 전용)

본 감사는 정적 읽기만으로 수행되었으며 **어떤 테스트도 실행하지 않았습니다.** 아래 테스트 결과 인용은 모두 기록된 evidence(`docs/development/reviews/2026-10-21-authoring-modes.md` 및 링크된 로그)에서 온 것이며, 제가 실행한 것이 아닙니다. 검증 방법은 소스 정독 + 의존성 추적입니다.

## 결론: **PASS** (차단 결함 없음, 필수 수정 항목 없음)

## 1. 계약 검증 — 독립 확인 결과

| 계약 항목 | 판정 | 근거 (경로) |
|---|---|---|
| Write/Refactor는 에이전트 소유, CLI 생성 경로 없음 | 충족 | `runCli`의 명령 분기에 `write`/`refactor` 없음 → `UNKNOWN_COMMAND` (`product/engine/cli.ts:runCli` fall-through), HELP·SKILL.md 명시. 테스트로 `write`/`refactor` exit 2 확인(기록됨, `test/authoring-modes.test.ts`) |
| Align은 수평 공백만, 외부 포매터 절대 실행 안 함 | 충족 | 이중 방지: CLI가 `alignmentOnly`일 때 `formatter = undefined` (`cli.ts`의 `format()`), 파이프라인도 `alignmentOnly && formatter`면 즉시 throw (`format-pipeline.ts:136`). 엔진 내 유일한 `spawn` 경로는 포매터(`formatter-process.ts`, Align에서 도달 불가)와 파서 프로브뿐임을 전수 확인. 기록된 테스트는 포매터 마커 파일 미생성을 증명 |
| Align이 줄바꿈/들여쓰기/내용 보존 | 충족 | `assertAlignmentOnly` (`alignment-only.ts`) 4계층: UTF-8 왕복, 구분자(`\r\n\|\r\|\n\|`)+줄 수 정확 비교, 라인별 비공백 내용·선행(BOM 포함)·후행 공백 정확 비교, 토큰/보호텍스트 검증. throw 시 `updateFileAtomically` 콜백 내부라 **커밋 미실행 + working/lock 정리** → 대상 무결 (`safe-file.ts:110-116`). 수직 제안은 Align이 거부하고 `format`은 유지함을 기록된 테스트가 확인 |
| Preview가 대상 무변경 | 충족 | dryRun은 working을 `initial`로 복원 → `commitUpdate`가 bytes 동일로 `false` 반환, `beforeCommit`도 미호출 (`safe-file.ts:82-84`). `alignmentEdits`는 Align dry-run에만 조건부 spread. 기록된 테스트가 바이트 무변경·마커 미생성 증명 |
| `guide --authoring`이 쓰기 권한/검증 주장 없이 범위 지정 승인 지침만 제공 | 충족 | 출력에 `verification:"not-run"`, `writeAuthorized:false`를 `...advice` **앞에** 고정하고 `advice`는 `{rules, unavailable}`뿐이라 덮어쓰기 불가 (`cli.ts` guide). 각 규칙은 `evaluateApproval` 전체 증명(결정·문서 hash·예시·승인 영수증) 통과분만, 미달은 `unavailable`로. 지침 생성 후 provenance fingerprint 재검. 실제 쓰기 권한은 파이프라인이 항상 registry에서 재도출하므로 지침 출력으로 우회 불가 |
| 기존 `format` 호환 | 충족 (정적) | `alignmentOnly` 선택 인자(기본 falsy), JSON 추가 필드는 조건부·가산적(`alignmentEdits`, align 전용 `mode`/`horizontalWhitespaceOnly`), 옵션 파싱·종료코드 무변경. `format --dry-run`은 설정된 포매터를 계속 실행(기록된 테스트가 마커 생성으로 확인) |
| `sectionText` 추출, hash 알고리즘 불변 | 정적으로 일치 | `sectionHash = sha256(sectionText(...))` (`examples.ts:67-81`). 유의미 드리프트가 있었다면 preset 문서 docHash 비교가 실패해 fail-closed로 format/align이 거부됐을 것 — 기록된 evidence는 preset이 통과함 |

경로 안전: `targetOf`가 realpath 포함 재검사, `insideRoot(allowMissing)`은 신규 파일의 최근접 존재 부모에 대해 symlink/realpath 검사, 기존 파일은 정규파일 검사. `--authoring`은 오직 `guide`만 허용, `check`/`align`/`format`은 거부, 중복 불가. 기록된 테스트가 `../`, symlink, dangling, 디렉터리, .json/.yaml, 디렉터리 미생성을 확인.

## 2. Sonnet 리뷰 반박 검증 — 저심각 보존 이슈의 도달 가능성

Sonnet의 PASS와 4개 저심각 항목을 **독립적으로 재추론**했습니다. 결론: 4건 모두 코드상 실재하나, **현재 writer로는 도달 불가능하거나 fail-closed**이므로 차단 사유가 아닌 것에 동의합니다. 그중 2건은 Sonnet보다 더 강한 근거로 확인했습니다.

1. **TS 토큰 가드의 JSX 비인식·regex 오분류 (`token-preservation.ts:11-31`)** — 실재 확인: `DIVISION_AFTER`에 `)`/`}` 포함, 스캐너 non-JSX. 단, 도달 불가: (a) preset 규칙은 `**/*.ts`/`**/*.py`뿐이고 `globToRegExp("**/*.ts") → ^.*[^/]*\.ts$`는 `.tsx`를 절대 매치하지 않음(직접 추적) → preset만으로는 `.tsx`가 "no verified approval rule"로 거부; (b) 프로젝트/사용자 규칙이 `.tsx`를 승인하더라도 TS writer의 편집은 AST 노드 경계에서만 발생(`align.ts` `writeGroups`의 edit 범위)하고 regex/JSX 텍스트 내부는 단일 토큰이라 내부 편집이 별도 엔진 버그 없이는 생성 불가; (c) 동일한 `preservesTokens` 게이트가 이 변경 이전의 `format` 경로를 동일하게 지켜왔으므로 이번 변경이 베이스라인 대비 위험을 추가하지 않음. → 방어심화 격차, 유지 보수 필요.
2. **Python 가드의 `1 .real` 공백 제거 허용 (`preservation.ts`)** — 실재 확인: `WORD=[\p{L}\p{N}_$]`, `OPERATOR`에 `.` 포함, `joinable`은 동일 클래스만 → 숫자·점 사이 공백은 정규화 후 소거됨. 단, **현 writer로 도달 불가함을 Sonnet보다 강하게 확인**: `table-engine.ts`의 `rebuildCode`는 오직 슬롯 경계의 canonical gap만 재작성하며, Python 프로파일러(`python/profile.ts`)의 슬롯 경계는 `:`, `,`, `=`, 괄호/중괄호와 셀 경계뿐 — **`.`은 어떤 슬롯 경계도 아니고**, 비-스칼라 셀(`1 .real`)은 `BUNDLE_SCALAR`/`assignedCall` 정규식이 거부하며 value 슬롯은 텍스트를 통째로 보존. 즉 "엔진 버그가 필요하다"가 아니라 "열거된 gap 축에 점이 없다"까지 확인. → 방어심화 격차.
3. **`--authoring` 경로의 ENOTDIR 미형화 (`cli.ts:105-113`)** — 확인: `lstatSync(..., {throwIfNoEntry:false})`는 ENOENT만 억제하므로 `a.py/b.py`(a.py가 파일)는 원시 ENOTDIR → `INTERNAL_ERROR`, exit 2, 부작용 없음. fail-closed이므로 저심각. 테스트 커버에 없음.
4. **`formatReadiness.mode`가 align 실행과 무관하게 `"formatter"` 가능 (`cli.ts:321`)** — 확인: `check` 출력 전용이며 `next` 문구가 align/format을 구분. 화면적 불일치.

## 3. Sonnet이 밝히지 않아 제가 추가 확인한 항목 (모두 이상 없음)

- **커밋 실패 닫힘**: guard throw가 staged 콜백 안에서 발생 → 커밋 스킵 + lock/working 정리 (`safe-file.ts`).
- **승인 우회 불가**: 파이프라인 내 승인은 staged working-copy 이름이 아닌 원본 `display` 경로로 평가; provenance는 시작 시 1회 + 콜백 내 1회 + `beforeCommit` 1회.
- **`compareParse("python","pass\n",text)`**: 깨끗한 기준선 프로브로 "출력이 무진단으로 파싱"을 요구하는 정상 설계 (오독 소지가 있어 명시함).
- **counterexample 라벨 "preserve the before form"**: 배포된 `bad` 예시의 `before`가 유지해야 할 형태임을 `examples.jsonl`에서 직접 확인 — 현재 지침은 정확함(향래 다른 관례의 `bad` 예시에 대한 내구성은 follow-up).
- **Align이 수직 후보 파일을 부분 정렬하지 않고 전체 거부**: 계약상 정확한 동작이며 기록된 테스트가 확인.

## 4. Follow-ups (선택적 개선 — 릴리스 조건 아님)

1. `.tsx`에 대해 `tokenStream`을 JSX 인식으로 전환하거나 Align에서 `.tsx` 거부 (`token-preservation.ts:34`), 그리고 `alignment-only.ts:29` 주석·문서의 "protected content" 표현을 `.tsx` 한정 완화.
2. `preservation.ts`의 digit–dot joinability 예외에 대한 부정 테스트 추가(Python `1 .real`), JSX 텍스트/`if (x) /re  gex/` 부정 테스트, `--authoring --file a.py/b.py`(파일-as-경로성분) 부정 테스트.
3. `insideRoot` allowMissing 분기에서 ENOTDIR을 형화된 경로 에러로 변환.
4. Align 출력의 `formatEligible: true` 네이밍 정리(`mode:"align"`과 중복 의미 혼재), `formatReadiness.mode`의 align 맥락 불일치.
5. Python 수직 거부 테스트 추가(현재 수직 테스트는 TypeScript 전용; Python은 줄 수 검사에 의존).
6. `unavailable`이 비어 있지 않아도 `rules`가 있으면 `ok:true` — 소비자 주의를 위한 `partial` 플래그 검토.

## 검증 한계

- 읽기 전용 제약으로 git diff 불가 — `sectionText`의 이전 구현과의 바이트 동일성과 "모든 기존 align/format 거동 무변경"은 코드 읽기 + 기록된 호환성 evidence에 의존.
- 기록된 `bun run check`(554 passed, 5 skips), targeted/alignment/artifact/installer 로그는 작성자의 evidence이며 본 감사가 재실행·검증하지 않음.
- HUD 및 이번 범위 외 변경, 원격 전달(SSH) 사항은 미검토.

**최종 판정: PASS.** 차단 결함 없음. 위 6건은 모두 follow-up이며, Sonnet의 저심각 4건 포함 어느 것도 현재 writer·프리셋 구성으로는 도달 가능한 내용 손상·승인 우회·불안전 경로·포매터 실행·비호환 CLI 거동이 아님을 독립 추적으로 확인했습니다.
