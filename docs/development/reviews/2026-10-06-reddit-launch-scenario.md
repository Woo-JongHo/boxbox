# Reddit 론칠 시나리오 점검 — 2026-10-06

`docs/reviews/2026-10-06-release-readiness-review.md`의 판정(아직 배포 단계 아님)을 전제로,
"Reddit에 올린다면"의 시나리오를 점검한다. 게시물 작성이 아니다.

## 1. 타깃과 포지셔닝

| 커뮤니티 | 적합도 | 이유 |
|---|---|---|
| r/ClaudeAI | 1순위 | Claude Code 스킬/플러그인 생태계 사용자가 있고, "agent가 코드를 고칠 때 지켜주는 규칙"이라는 가치가 바로 통한다 |
| r/ChatGPTCoding, r/cursor | 2순위 | Codex·에이전트 코딩 사용자. SKILL.md가 도구 불가입이라는 점이 호환성 메시지 |
| r/mcp | 부적합 | MCP 서버 커뮤니티다. 이 플러그인은 스킬+CLI다 |
| r/programming 등 대형 | 부적합 | 포매터 논쟁용 대형 sub는 아니고 "작고 진지한 도구" 톤이 아니다 |

한 문장 포지셔닝(변하지 않는 축): **"에이전트가 표 형태 코드를 쓸 때 같은 문형은 같은
구조로, 나머지는 최소 폭 컬럼으로 정렬한다. 확신이 없으면 고치지 않고 거절한다."**

## 2. 지금 게시해도 되는가 — 게이트 5개

1. **이름이 `boxbox` placeholder다.** 신뢰 0. 게시 전 이름 확정 필수(배포 검토 P0-1과 동일).
2. **LICENSE 없음.** 공개 저장소 링크를 못 건다. 라이선스 결정 + 파일 추가 필수.
3. **승인 규칙 0개.** `format`이 승인 gate에서 항상 거절된다. 데모에 `check`(읽기 전용
   리포트)와 정렬 자체는 쓸 수 있지만 "자동 수정"을 보여줄 수 없어 제품의 절반이
   화면에 안 나온다. 최소 1건의 승인 데이터가 시나리오의 전제다.
4. **설치 경로 미검증.** `install.sh` 링크 방식은 로컬 실측만 있고, 릴리스 태그·
   marketplace 경로는 미검증. "설치 한 줄"을 올리려면 그 줄이 실제로 동작해야 한다.
5. **데모 자료 없음.** GIF/짧은 캡처가 없다. Reddit은 첫 화면에서 승부난다.

5개 중 하나라도 미충족이면 정식 론칠 게시는 보류하고 시나리오 (b)(아래)로 대체한다.

## 3. 말할 수 있는 주장 / 말하면 안 되는 주장

**근거가 있어 말할 수 있는 것:**
- AST 기반 표 감지 + 토큰 보존 검사 + 쓰기 후 재파싱 비교 (403 tests / 0 fail, 오늘 재확인)
- fail-closed: 파서가 없거나 불명확하면 쓰지 않고 보고만 한다 (REFUSE 설계)
- formatter(run-last) 설계 — Prettier·black 뒤에서 마지막에 실행
- NEW/MODIFY 구분: 고치지 않은 표를 건드리지 않는다 (기준본 비교)
- 코퍼스: 공개 저장소 8개 고정 커밋에서 관측 18,613건, 규칙 키 88개로 후보 선정

**말하면 안 되는 것(근거 없음·과장):**
- "10개 언어 지원" — 첫 공개 범위는 TypeScript·Python만 동등 품질이다. 나머지 8개는
  "엔진 존재, 첫 배포 품질 보장 안 함"이 계약상 정확한 표현이다.
- "8개 저장소에서 검증됐다" — 코퍼스는 표본이지 대표성 주장이 아니다(corpus-data.md 명시).
  VS Code·Prisma는 앞 1,000파일 표본이다.
- "프로덕션 레디" / "모든 쓰기 경로가 안전하다" — 안전 gate는 `06_align-tables.ts`에
  적용됐고 보조 명령은 미적용이다.
- 승인 데이터 기반 품질 주장 — 승인 0건 상태에서는 아예 언급하지 않는다.

## 4. 시나리오 3종

### (a) 정식 론칠 — "I built a formatter-pass for agents that refuses when unsure"
- 전제: 게이트 5개 충족.
- 구성: 6-12초 before/after GIF → 한 줄 가치 제안 → 설치 2줄 → "왜 formatter가 못 하냐"
  한 문단(세로 정렬은 formatter의 관심사가 아니다 + formatter가 다시 돌면 정렬이 사라진다)
  → honest limitations 섹션(첫 배포 TS/Python, Windows 미지원, 승인 gate).
- 리스크: "Prettier 플러그인으로 만들지 왜?" 반론 — 답변 준비 필요: formatter run-last
  설계 자체가 그 답의 시작이다.

### (b) 빌드 과정 공유 — "주 3일간 만든 것" 톤
- 지금 데이터로도 가능. 게이트 불필요(이름/라이선스만 있으면 저장소 링크 가능).
- 내용: 실패한 시도(포매터 뒤에 정렬이 사라지는 문제), REFUSE 설계를 왜 택했나,
  코퍼스 수집 방법. 피드백 수집이 목적 — `verdicts.jsonl`이 비어 있으므로
  초기 사용자 반응이 곧 승인 데이터 후보가 된다. **전략적으로 가장 권장.**

### (c) 기술 딥다이브 — "Token-preserving table alignment for code"
- 대상 r/programming류보다는 개인 블로그+크로스포스트. 코퍼스·안전 gate 설계를 다룬다.
- 시간 투자 대비 반응 불확실. 후순위.

## 5. 게시 전 자료 체크리스트

- [ ] 제품명 확정 + `skills/boxbox/` 경로 교체 1-pass
- [ ] LICENSE 파일 + README 라이선스 섹션
- [ ] 승인 규칙 ≥1건으로 format 데모 가능
- [ ] 릴리스 태그 + `install.sh` 원라이너 실측 (깨끗한 디렉터리에서)
- [ ] before/after GIF (정렬 전후 + REFUSE 케이스 1건 포함이면 best)
- [ ] README 상단 3줄 영문 (이미 영문 기반이고, 배포 검토 P0 이름 교체와 함께)
- [ ] "지원 범위" 표: TS·Python만 동등 품질임을 명시
- [ ] 댓글 대응 메모: Prettier 차별화, 탭/스페이스 논쟁 회피, "왜 거절하냐" 사례 1개

> Historical naming note (2026-10-12): this record predates the confirmed product name `boxbox` and npm package `boxbox`. Maintained links and examples use the current names; earlier placeholder-name findings are historical, not current naming blockers. Raw execution evidence remains unchanged.
