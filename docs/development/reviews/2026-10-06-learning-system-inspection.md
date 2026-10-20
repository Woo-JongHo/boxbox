# 자체 학습 시스템 점검 — 2026-10-06

읽기 전용 점검이다. 기준: 작업 트리 그대로, HEAD `8338798`, 2026-10-06 실측. 이 문서는
`docs/handoff-2026-10-05.md`의 판정을 대신하지 않으며, 학습 루프(corpus → 후보 → 승인 →
배포)가 실제로 어디까지 돌아가는지를 코드·데이터 실측으로 확인하고 SQLite 도입 설계를 제안한다.

## 1. 학습 루프의 실제 상태 (실측)

루프의 4계층 설계(내부 연구 Evidence → 제작자 preset → 사용자 전역 DB → 프로젝트 DB)는
문서·코드로 존재한다. 실측한 각 계층:

| 단계 | 설계 | 실측 상태 |
|---|---|---|
| 수집 | `corpus/manifest.json` 고정 핀 | 8개 공개 저장소 pin 존재, `docs/corpus-data.md`의 7,759파일·관측 18,613건 수치와 일치 |
| 관측 저장 | `~/.cache/boxbox/corpus/observations.jsonl` + `signatures.json` | JSONL/JSON 파일 기반. SQLite 미도입(`docs/status.md`에 명시) |
| 후보 | `corpus-candidates.ts` → 88키·225예문 | `.boxbox/cache/corpus/` 캐시, 기계 검증 213/225 통과·12 보류(handoff §3) |
| **판정(피드백)** | `corpus/verdicts.jsonl` | **0행(빈 파일)** — 사람 판정이 한 건도 기록되지 않았다 |
| 배포 preset | `presets/recommended/{conventions,examples,decisions}.jsonl` | **`presets/` 디렉터리 자체가 작업 트리에 없다**(빌드 산출물로만 생성되는 것으로 보인다). 승인 0이므로 산출물도 0행 |
| 평가 | `eval/items/items.jsonl` 28항목, `eval/runs/` | 실행 4회(2026-09-30), model `gpt-6-sol`·codex exec, template v0, `instructions_sha256` 핀 존재. `grade.json`은 1개 run에만 있다. `eval/judging/2026-10-01-pack/`의 답안 CSV는 `answers-판정자이름.csv` placeholder 그대로다 |
| 사용자 DB | `boxbox db init/status` (`cli.ts:253-279`) | 파일 기반(행 수를 세는 JSONL 파일들) 생성·조회만 가능. `initializeUserDatabase` 이후 add/import/export/backup은 미구현(handoff와 일치) |
| 패턴 조회 | `common/report.ts` `ConventionDb` | 승인/거절/미지정/충돌 카운트를 **보고만** 한다(report-only, 동작 불변). 조회 결과가 쓰기 동작에 영향을 주지 않는다 |

## 2. 진단 — 루프는 "수집"까지만 구현됐다

1. **학습의 입력이 비어 있다.** 판정 파일 `corpus/verdicts.jsonl` 0행 + 사람 승인 0건. README의
   "사용자 피드백으로 확정된 규칙만 SKILL.md로 승격"이라는 승격 규칙이 작동한 역사가 없다.
   현재 시스템은 학습 시스템이 아니라 **학습 준비 시스템**이다.
2. **계층 간 이동이 전부 수작업 파일 편집이다.** 관측→후보는 스크립트로 자동화돼 있으나,
   후보→승인(verdicts)→preset→사용자 DB로 가는 경로에 스키마 검증·게이트·이력 기록이 없다.
   `db add/import/export/backup` 부재가 바로 이 빈자리다.
3. **평가도 미완이다.** 28개 평가 아이템은 관측 18,613건 대비 0.15%이고, judge pack은
   placeholder 파일명이며 grade는 1회다. 평가가 후보 선정을 되먹이지 못하고 있다.
4. **JSONL 전체 스캔 방식의 한계.** 조회 키 88개·관측 18,613행 수준에서는 동작하지만,
   승인 이력·예문 버전·충돌(같은 키에 승인과 거절 공존)·출처 추적을 관리하려면
   `report.ts`가 이미 갖고 있는 개념(승인/거절/미지정/충돌)을 저장 구조로 정착시켜야 한다.

## 3. SQLite3 도입 설계 제안

기존 JSONL을 폐기하지 않고 import 경로로 흡수한다. 4계층 설계는 유지하고 각 계층에
저장 기술을 부여한다. 공통 운영: `PRAGMA foreign_keys=ON`, `STRICT` 테이블, 관측 같은
대형 테이블은 `WITHOUT ROWID`, 사용자 DB 디렉터리는 기존대로 0700/파일 0600.

### Layer A — 연구 Evidence DB (`evidence.sqlite3`, 로컬 캐시, 배포 제외)

```sql
sources(id TEXT PRIMARY KEY, repository TEXT, commit TEXT, license TEXT, paths_json TEXT);
files(id INTEGER PRIMARY KEY, source_id TEXT REFERENCES sources, path TEXT,
      content_sha256 TEXT, UNIQUE(source_id, path));
signatures(id INTEGER PRIMARY KEY, signature TEXT UNIQUE, depth INTEGER);
observations(  -- 18,613행, WITHOUT ROWID
  id TEXT PRIMARY KEY, source_id TEXT REFERENCES sources, file_id INTEGER REFERENCES files,
  key TEXT, signature_id INTEGER REFERENCES signatures, depth INTEGER,
  status TEXT CHECK(status IN ('fixable','pass','refuse')),
  lines INTEGER, edits_json TEXT, evidence_ref TEXT);
```

- `observations.jsonl` 1회 import로 적재, rowcount 불일치 시 중단. 이후 후보 선정은
  `GROUP BY key` 인덱스 쿼리로 대체(전체 스캔 제거).

### Layer B — 후보 DB (`candidates.sqlite3`, 저장소 gitignored)

```sql
rule_keys(key TEXT PRIMARY KEY, observation_count INTEGER, first_seen_run INTEGER);
examples(id TEXT PRIMARY KEY, key TEXT REFERENCES rule_keys, evidence_id TEXT,
         before_sha256 TEXT, after_sha256, machine_check TEXT CHECK(machine_check IN ('pass','hold','fail')),
         hold_reason TEXT);
review_pack(id INTEGER, example_id TEXT REFERENCES examples, judged_by TEXT, answer TEXT);
```

- 기존 `candidates.jsonl`/`examples.jsonl`(88행/225행) import. 12개 보류는
  `machine_check='hold'`로 그대로 표현된다.
- eval run 4회 기록도 `eval_runs(run_id, config_json, template_version, instructions_sha256, graded_at)`로
  함께 관리해 "어느 후보가 어느 평가로 검증됐는가"를 연결한다.

### Layer C — 승인 DB (사용자 전역, `~/.config/boxbox/approvals.sqlite3`)

```sql
decisions(
  id INTEGER PRIMARY KEY, example_id TEXT, key TEXT,
  verdict TEXT CHECK(verdict IN ('approved','rejected')),
  reason TEXT, decider TEXT, decided_at TEXT,
  basis_example_sha256 TEXT,      -- 승인 당시 예문 내용 해시(버전 고정)
  source_run INTEGER);            -- 어느 후보/평가를 근거로 했는가
schema_migrations(version INTEGER PRIMARY KEY, applied_at TEXT);
```

- `corpus/verdicts.jsonl`과 동일 정보를 담되, 같은 key의 승인+거절 공존을
  `v_conflicts` 뷰로 반드시 보이게 한다(`report.ts`의 conflict 개념의 저장 정착).
- `db add`는 이 테이블의 insert, `db export`는 Layer D 생성, `db backup`은
  `VACUUM INTO`다. 4개 미구현 명령이 정확히 이 테이블을 채우는 형태가 된다.

### Layer D — 배포 preset (JSONL 유지)

- preset은 SQLite가 아니라 **Layer C에서 결정론적으로 export한 JSONL**로 유지한다
  (diff 가능·리뷰 가능이 목적). export는 `decisions` 스냅샷 해시를 `payloadDigest`처럼
  함께 남겨 preset↔DB 대조를 가능하게 한다.

### 이동 규칙과 게이트

A→B는 기계 필터(기존 스크립트), B→C는 사람 승인(게이트, 기계 판정이 승인으로 승격되지 않음),
C→D는 export 게이트(충돌 미해결 시 export 거부). 각 이동은 이동 run 테이블에
`from/to 계층, 입력 해시, 산출 해시, 건수`를 기록한다 — KRAFTON 01/02의 evidence ledger와
동일한 "해시로 연결된 원장" 방식이다.

## 4. 최우선 다음 작업

1. Layer C 승인 DB 최소 구현(`db add/export/backup`) — 피드백 진입점이 이것 하나로 열린다.
2. `corpus/verdicts.jsonl`·`candidates.jsonl`·`examples.jsonl`의 import 커맨드(현 0행/캐시 데이터 흡수).
3. judge pack placeholder 교체와 2회째 eval 실행 + grade 기록 — 평가 축이 후보 선정에
   되먹이는 첫 사례를 만든다.

점검 결과 판정: 루프의 수집·집계·평가 인프라는 설계대로 존재하고 출처 핀·해시 규율도
양호하다. 그러나 판정 데이터 0건으로 학습은 아직 시작되지 않았으며, 시작점은 저장 기술
(SQLite) 이전에 **승인 기록의 진입점**이다.

> Historical naming note (2026-10-12): this record predates the confirmed product name `boxbox` and npm package `boxbox`. Maintained links and examples use the current names; earlier placeholder-name findings are historical, not current naming blockers. Raw execution evidence remains unchanged.
