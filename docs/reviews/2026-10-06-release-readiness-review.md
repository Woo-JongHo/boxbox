# 배포 준비 검토 — 2026-10-06

읽기 전용 검토 + 기계 검증 재실행. 기준: 작업 트리 그대로, 브랜치 `m1-safety-proof`,
HEAD `8338798`(upstream 대비 +27). `docs/plan.md`의 REL 표와 `docs/release-contract.md`를
판정 기준으로 삼는다. 이 문서는 배포 승인이 아니다.

## 1. 결론

**아직 배포 단계가 아니다.** 기계 검증은 최고 수준으로 유지되고 있으나(오늘 재확인:
403 pass / 5 skip / 0 fail), 배포 계약이 요구하는 **사람 결정 4종·사람 승인 데이터·
플랫폼/호스트 실측**이 모두 미해결이다. 남은 일은 구현이 아니라 **결정과 실측**이 중심이다.

## 2. 오늘의 기계 검증 재현 기록

- 최초 실행: **401 pass / 5 skip / 2 fail** — 실패 2건은 모두 아티팩트 격리 설치 테스트.
- 원인 진단: 코드 회귀가 아니라 **오프라인 npm 캐시 냉각**(`ENOTCACHED`,
  `cache mode is 'only-if-cached'`). `typescript@7.0.2`와 플랫폼 네이티브 패키지가
  캐시에 없어 `npm install --offline`이 실패했다.
- 해소: `npm cache add typescript@7.0.2` + `npm cache add @typescript/typescript-darwin-arm64`
  이후 **403 pass / 5 skip / 0 fail**(tsc --noEmit, bash -n install.sh 포함 전체 통과).
- 재현 조건: 새 머신·캐시 정리 후에는 이 의존성 캐시 워밍이 먼저 필요하다. CI에서
  오프라인 설치 테스트를 쓰면 캐시 워밍 단계를 워크플로에 명시해야 한다.

## 3. REL 진행 현황 (docs/plan.md 기준)

| REL | 내용 | 상태 |
|---|---|---|
| REL0 | 계획 정본화 | ⏸ 독립 검토·수락 대기 |
| REL1 | 배포 계약·지원 범위 확정 | 계약 초안 존재, OS/호스트 조합 미확정 |
| REL2 | fail-closed 안전 gate | 부분 — 2a/b/c 검증 완료, 공개 gate·TS native timeout 후속 |
| REL3 | Node 런타임·패키지 실증 | ✅ **macOS 한정** |
| REL4 | 통합 CLI 생명주기 | ✅ |
| REL5 | 설정 계층 계약 | ✅ |
| REL6 | 사람 승인 DB 최초 데이터 | ⏸ **두 후보 제시 상태, 승인 대기** |
| REL7 | 승인 gate + GUIDE 순환 | core 검증 완료, 실제 승인 데이터 대기 |
| REL8 | formatter run-last | ✅ |
| REL9 | 실제 호스트 수용 | 미착수(모의·흉내 검증만) |
| REL10-12 | clean 설치·갱신·제거 → 동결 → 릴리즈 | 미착수 |

## 4. 배포 차단 목록 (우선순위)

**P0 — 결정이 필요한 것 (코드와 무관, REL11 동결 전 반드시)**
1. **제품명.** `xxx`/`XXX` placeholder가 `package.json` name, `skills/xxx/` 디렉터리 경로,
   설치 경로, 문서 전반에 박여 있다. README가 정한 "한 번의 패스로 교체"는 디렉터리
   rename을 포함하므로 설치된 링크·훅 경로까지 파급된다.
2. **라이선스.** `LICENSE` 파일이 저장소에 없다. 코퍼스가 MIT/Apache-2.0/BSD만 수용하는
   저장소인데 자체 라이선스가 없으면 공개 자체가 불가능하다.
3. **사람 승인 0건.** REL6의 두 후보가 사용자 답변을 기다리는 중이고 `corpus/verdicts.jsonl`은
   0행이다. 승인 데이터가 없으면 `format`의 승인 gate는 항상 거절 — "자동 수정이
   전혀 없는 포매터"를 공개하게 된다. 데모 가능한 최소 1건의 승인이 첫 공개의 실질 조건이다.

**P1 — 실측이 필요한 것**
4. **Linux/artifact 수용.** REL3·REL4의 증거는 macOS뿐이다. Linux CI 설정이 있어도
   artifact 설치·엔진 동작 실측 기록이 없다. Windows는 계약상 미지원 표기가 맞다.
5. **실제 호스트 수용(REL9).** Claude Code/Codex에 실제 설치 → 훅 발동 → 리포트 수상까지
   실측한 기록이 없다(모의 테스트만 존재).
6. **작업 트리 정리.** 미커밋 60건(handoff 시점 57건보다 증가). 배포 전 커밋 경계가 필요하다.
   `.www/`가 이 저장소에서 untracked로 잡히는 등 이기적 산출물도 섞여 있다.

**P2 — 품질·표면**
7. 독립 최종 감사(Sonnet 5·Opus) 미실행 — plan.md가 유지 중인 배포 전 요구.
8. `.claude-plugin/marketplace.json`의 `source: "./"`가 저장소 전체를 가리키는 경계 문제(handoff §2).
9. 영문화 — 별도 문서(`docs/plan-refactor-i18n-2026-10-06.md`)로 준비물을 정리했다.

## 5. 배포까지 최소 경로 제안

1. 이름·라이선스 결정 (사람) → 2. 승인 2건 마무리로 REL6 종료 (사람) → 3. 미커밋 60건
   커밋 경계 정리 → 4. Linux artifact 실측 → 5. REL9 호스트 수용 실측 → 6. REL10 clean
   설치·갱신·제거 → 7. REL11 동결(이름 교체 1-pass 포함) → 8. REL12 릴리즈.
   1·2는 코드 작업과 병행 가능하며 나머지는 전부 순서 의존이다.
