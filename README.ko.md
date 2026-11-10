# BoxBox

[English](README.md) | [한국어](README.ko.md) | [简体中文](README.zh-CN.md)

링크된 상세 문서는 주로 영어로 제공됩니다.

**코드의 흐름을 따라 읽고, 나란히 놓인 차이를 비교하세요.**

BoxBox는 반복되는 코드를 스프레드시트처럼 다룹니다. 같은 역할의 문장을 행으로, 대응하는 구성 요소를 열로 봅니다. 코딩 에이전트가 불균일한 구조를 단순화하도록 돕고, 남은 구문을 간결하고 읽기 쉬운 표 형태로 정렬합니다.

```typescript
// Before
const name = "deploy";
const retries = 3;
const timeoutMs = 1000;

// After
const name      = "deploy" ;
const retries   = 3        ;
const timeoutMs = 1000     ;
```

위 정렬 예시는 실제 TypeScript 엔진의 출력이며, 테스트로 이를 유지합니다. 현재 자동 쓰기 범위는 승인된 규칙 몇 개로 의도적으로 좁아서, 그 밖의 패턴은 대부분 변경하지 않고 보고만 합니다. 이름, 값, 실행 순서는 유지하면서 대응하는 구문을 더 쉽게 비교할 수 있게 합니다.

제품명은 **BoxBox**이며, 핵심 CLI·스킬·플러그인 ID는 `boxbox`입니다(2026-10-16 확정). 공개 npm 설치 패키지는 [`boxbox-plugin`](https://www.npmjs.com/package/boxbox-plugin)이며 `npx boxbox-plugin`으로 설치합니다. [Windows 플러그인 설치 안내](product/installer/README.md)를 참고하세요.

| 중요한 항목 | BoxBox 0.2.8 |
| --- | --- |
| 결정적 언어 처리 범위 | TypeScript, Python, 엄격한 JSON, YAML 1.2 |
| 기본 쓰기 승인 | 의도적으로 제한한 규칙 5개 |
| 엔진과 훅의 모델 호출 | **0회** |
| npm 다운로드 | 압축 384,104바이트, 압축 해제 607,186바이트 |

BoxBox는 범용 포매터가 아니며 바이트 보존 여부를 모델에게 판단시키지 않습니다. 엔진이 로컬에서 측정·계획·
구문 분석·검증을 수행합니다. 모델의 판단은 실제로 판단이 필요한 Write, Refactor, 선택형 읽기 전용
inspector 작업에만 사용합니다.

## 코드를 표로 읽는 이유

반복되는 코드는 서로 다른 데이터에 같은 작업을 수행하는 경우가 많습니다. 문단처럼 읽으면 매 줄을 따로 해석해야 하지만, 표처럼 읽으면 차이가 드러납니다.

- 식별자, 타입, 인수, 값을 위아래로 비교합니다.
- 각 그룹의 실제 내용에 맞춰 열 너비를 정합니다.
- 역할이 다른 코드는 한 표로 늘려 맞추지 않고 분리합니다.
- 유독 긴 행 하나가 나머지 행의 폭까지 늘리기 전에 그 구조를 단순화합니다.

목표는 프로그램의 흐름을 위에서 아래로 따라가기 쉬운 일관된 형태입니다.

## 단순화. 정렬. 검증.

### 1. 구조 단순화

스킬은 에이전트가 반복되는 행과 그 코드를 사용하는 부분을 함께 살펴보도록 안내합니다. 에이전트는 표를 넓히는 불필요한 래퍼, 중복 표현식, 구현 세부 사항을 줄이는 방법을 제안합니다. 구조 변경은 에이전트와 사람이 판단합니다.

### 2. 비교 가능한 행 정렬

결정적 엔진은 지원되는 연속 구문을 그룹으로 묶고 구문 경계를 정렬합니다. 빈 줄, 들여쓰기, 호환되지 않는 행 구조가 그룹의 경계가 됩니다. 각 그룹에는 필요한 최소 열 너비를 적용합니다.

지원 패턴에는 선언, 대입, 가져오기, 객체의 행, 일부 호출이 포함됩니다. 지원 범위는 언어와 패턴에 따라 다르며, 엔진이 가능한 모든 구문을 분류하지는 않습니다.

### 3. 쓰기 전 변경 검증

정렬 단계는 공백 문자만 변경합니다. 파일을 교체하기 전에 내용 보존 여부를 확인하고 변경 전후 파서 진단을 비교합니다. 구조를 확실하게 분해할 수 없거나, 파서를 사용할 수 없거나, 파일 상태가 안전하지 않으면 쓰기를 거부할 수 있습니다.

공개 `format` 명령에는 완전한 사람의 승인 증거가 필요합니다. 프로젝트 포매터가 설정되어 있으면 먼저 실행한 뒤, 구문 분석을 검증하고 규칙 승인을 확인한 다음 정렬합니다. 포매터가 설정되어 있지 않으면 승인된 패턴을 직접 정렬합니다. 전체 과정을 두 번 실행해 결과가 더 이상 바뀌지 않는 고정점인지 검증한 뒤, 대상 파일을 한 번 교체합니다. 외부 포매터의 변경은 정렬 단계의 공백만 변경한다는 보장과 별개입니다.

## 작성·구조 개선·정렬·검사

BoxBox 0.2.8은 에이전트 작업과 엔진의 변경 범위를 구분합니다.

- **Write — 작성:** 에이전트가 승인된 작성 안내를 참고하여 요청한 기능을 구현합니다.
- **Refactor — 구조 개선:** 에이전트가 기존 구조를 개선하고 동작과 필요한 성능을 별도로 검증합니다.
- **Align — 정렬:** 엔진이 승인된 가로 배치 공백을 조정합니다. 줄바꿈·들여쓰기를 바꾸거나 외부 포매터를 실행하지 않습니다.
- **Check — 검사:** 기존 코드를 수정하지 않고 조사합니다. 탐지된 그룹이 없다고 파일 전체의 스타일이 검증된 것은 아닙니다.

`guide --file <file> --authoring --json`은 기존 파일, 빈 파일, 아직 만들지 않은 파일에 적용할 승인된 안내를 제공합니다.
예제는 작성 안내이며 해당 파일의 쓰기 승인 증거가 아닙니다. `align --file <file> --dry-run --json`으로 정렬을 미리 보고,
`align --file <file> --json`으로 적용합니다. Write와 Refactor는 CLI 생성 명령이 아니라 호스트 에이전트의 작업입니다.
미리보기는 대상을 변경하지 않으며, 기존 `format` 파이프라인은 별도 작업으로 유지합니다.
Check와 Format은 반복 `--file` 또는 범위가 제한된 재귀 `--directory` 선택도 받습니다. 포매터가 설정되어 있으면
Check는 작업 사본에서 포매터 다음 BoxBox를 실행한 최종 바이트를 검증하고, 원본 소스의 조사 결과와 `canonical`
검증을 구분합니다. 여러 파일의 포맷은 파일마다 원자적으로 적용하며, 다른 파일이 실패해도 앞서 완료한 쓰기를
보고합니다. 그룹별 선택 쓰기는 계속 보류합니다. 세션 훅의 기본 `check`는 읽기 전용이며, 명시적인
`boxbox mode align` 선택만 일치하는 도구 호출 뒤 승인된 가로 공백 정렬을 허용합니다. Stop은 읽기 전용입니다.
[작업 모드 선택과 검증의 한계](docs/user/modes.md)를 참고하세요.

CLI는 이제 TypeScript, Python, 엄격한 JSON, YAML 1.2를 검사하며 구문 상태를 valid, invalid, parser error로
보고합니다. JSON/YAML 정렬 범위는 같은 단계에서
서로 인접한 단일 행 스칼라 매핑 항목 3개 이상으로 제한됩니다. 지원하지 않는 행은 별도로 보고하고 그대로
둡니다. YAML 블록 스칼라, 앵커, 별칭, 태그, 복합 키, flow collection, sequence, directive, document marker는
이 정렬 범위에 포함되지 않습니다. 구조화 문서용 Align 엔진 경로는 구현됐지만, 권장 프리셋의 쓰기 승인은
아래 TypeScript와 Python 규칙뿐입니다. JSON/YAML 쓰기에는 완전한 로컬 승인 증거나 향후 프리셋 승인이
별도로 필요합니다.

## 플러그인 설치

Node.js 22.22.3 이상, npm, Codex 또는 Claude Code CLI가 필요합니다. 공개 설치 프로그램은 감지된 모든 호스트에 플러그인과 로컬 Node 엔진을 설치합니다. 자세한 내용은
[설치 안내](product/installer/README.md)를 참고하세요.

```sh
npx boxbox-plugin
```

호스트를 다시 시작한 뒤 BoxBox로 파일을 정렬해 달라고 요청하세요. 이 저장소를 Claude나 Codex 마켓플레이스로 추가하면 엔진 없이 플러그인만 설치됩니다. 이 경우 명령은 설정 안내를 내고 멈추며 검사는 실행되지 않습니다. 훅은 차단하지 않고, 세션 시작 훅만 그 안내를 출력합니다. 이미 그렇게 추가했다면 사용하는 호스트의 줄을 실행해 등록을 먼저 지운 뒤 설치 프로그램을 실행하세요.

```sh
claude plugin uninstall boxbox@boxbox-plugins --scope user
claude plugin marketplace remove boxbox-plugins
codex plugin marketplace remove boxbox-plugins
```

Windows에서는 와일드카드 대신 아카이브 전체 경로를 쓰세요. 설치 안내를 참고하세요. **프로젝트에서 코드 포매터를 쓴다면:** Prettier, Black, Ruff 포매터는 자신이 다시 쓰는 파일에서 BoxBox의 정렬을 되돌립니다. 언어에 포매터 하나를 설정한 뒤 에디터, 훅, CI가 포매터를 직접 실행하는 대신 BoxBox의 `format`과 `check`를 호출하도록 구성하세요. 반복 `--file` 또는 `--directory`로 여러 파일을 선택할 수 있으며, 파일마다 전체 파일 승인 조건을 유지합니다. 이후 포매터를 직접 실행하면 정렬이 다시 없어질 수 있습니다. `doctor`, `init`, `align`, `format`은 프로젝트 루트 설정에서 포매터가 확인되면 경고합니다.

저장소 체크아웃은 빌드할 때만 필요합니다. 설치된 플러그인은 영구 설치된 자체 Node 엔진을 사용합니다.
공개 설치 프로그램에는 Node.js 22.22.3 이상과 npm이 필요하며, Python 검사와 포맷에는 실행 가능한 `python3`가 추가로 필요합니다.

## BoxBox는 무거운가요?

짧게 답하면 다운로드 크기는 작고, 설치 후 용량의 대부분은 TypeScript 도구 체인이 차지합니다.

아래 수치는 공개된 `boxbox-plugin@0.2.8`을 macOS arm64의 깨끗한 격리 환경에 설치해 측정한
스냅샷입니다. 플랫폼마다 npm 메타데이터와 네이티브 TypeScript 패키지 크기가 달라질 수 있으므로
플랫폼 공통 보장값은 아닙니다.

| 측정 항목 | 크기 |
| --- | ---: |
| npm tarball | 384,104 B (375.1 KiB) |
| npm이 보고한 압축 해제 패키지, 42개 파일 | 607,186 B (0.58 MiB) |
| Codex 영구 설치 | 30,984,814 B (29.55 MiB) |
| Claude 영구 설치 | 30,986,310 B (29.55 MiB) |
| 각 호스트가 추가한 플러그인 캐시 | 약 0.10 MiB |
| 격리 설치에서 사용한 새 npm 다운로드 캐시 | 27.80 MiB |
| npm 캐시를 포함한 두 호스트 전체 격리 시험 디렉터리 | 87.10 MiB |

각 호스트 영구 설치에서 약 26.22 MiB는 고정된 네이티브 TypeScript 7 패키지입니다. Codex와 Claude는
한 호스트를 복구하거나 제거할 때 다른 호스트를 몰래 바꾸지 않도록 별도의 영구 런타임을 받습니다.
따라서 한 호스트 설치에는 영구 용량 약 29.55 MiB, 두 호스트에는 약 59.1 MiB가 필요하며, 재사용 가능한
npm 다운로드 캐시는 별도입니다.

같은 Apple M1 워크스테이션에서 3행 TypeScript 파일 하나를 검사한 warm process 10회는 248~475 ms,
중앙값 266 ms, 평균 298 ms였습니다. 이는 작은 파일의 시작 비용 측정이지 대규모 프로젝트 벤치마크가
아닙니다. 훅 비용은 실제로 검사하는 변경 파일 수에 따라 늘어납니다.

## AI 토큰은 얼마나 사용하나요?

BoxBox에는 비용 특성이 전혀 다른 두 경로가 있습니다.

- **엔진 명령과 lifecycle 훅:** `check`, `guide`, `align`, `format`, `doctor`, 업데이트 확인, 상태 출력,
  세션 receipt는 모델을 호출하지 않으므로 직접 AI 토큰 비용이 **0**입니다.
- **에이전트 작업:** Write와 Refactor는 호스트에서 이미 실행 중인 모델을 사용합니다. 사용량은 작업,
  저장소, 호스트에 따라 달라지며 BoxBox는 고정된 토큰 절감률을 주장하지 않습니다.
- **선택형 Claude inspector:** 위임할 때만 모델 토큰을 소비하는 별도 읽기 전용 subagent입니다.
  생성된 0.2.8 정의는 현재 Sonnet과 medium effort를 지정하지만, 이는 검증된 최적값이 아니라
  `unevaluated-default`입니다. 배포되는 Codex 플러그인에는 inspector agent가 없습니다.

설치된 `SKILL.md`는 16,644바이트입니다. 스킬과 참고문서 4개를 모두 합치면 92,343바이트입니다.
문자 4개당 토큰 1개라는 거친 환산으로 각각 약 4.2K, 23K 토큰이지만, 실제 값은 호스트 tokenizer,
열어 본 참고문서, prompt cache 재사용에 따라 달라집니다. 이는 context 크기 추정치이지 과금 측정값이
아닙니다.

228행 TypeScript 파일 하나를 사용한 Claude 6회 pilot은 상속된 Opus 5.5와 Sonnet 5 inspector를
비교했습니다.

| pilot 결과 | 상속된 Opus | Sonnet inspector |
| --- | ---: | ---: |
| 평균 표시 세션 비용 | $0.7244 | $0.6107 |
| 평균 소요 시간 | 107초 | 177초 |
| 평균 inspector turn | 4.3 | 8.7 |
| 평균 inspector 출력 토큰 | 8,070 | 12,230 |
| 평균으로 가리킨 수정 가능 그룹 | 6.7 / 8 | 7.7 / 8 |

Sonnet의 평균 표시 비용 비율은 사전 등록한 기준 0.70보다 높은 0.843이어서, 비용 절감 모델로 Sonnet을
선정할 근거가 되지 못했습니다. 파일 하나와 조건별 3회 실행만 사용했고 조언 품질은 채점하지 않았습니다.
[프로토콜·원시 실행·정정·한계](docs/development/reviews/2026-10-22-inspector-model-pilot/RESULTS.md)를
참고하세요. [Ponytail](https://github.com/DietrichGebert/ponytail)이나
[Caveman](https://github.com/JuliusBrussee/caveman)처럼 더 넓은 최적화 플러그인과 달리 BoxBox는 전체
토큰이나 전체 비용이 줄어든다는 대표 수치를 주장하지 않습니다. 이 프로젝트들은 이점과 측정 방법,
불리한 결과까지 함께 보여 주는 README 구성의 참고 사례일 뿐이며, 그 벤치마크 결과가 BoxBox에
그대로 적용되지는 않습니다.

SessionStart는 최대 24시간에 한 번 GitHub release tag를 확인하며 소스 내용은 전송하지 않습니다.
이 확인은 `BOXBOX_UPDATE_CHECK=0`으로 끌 수 있습니다. Monitor 보고서는 로컬에 남고 transcript,
명령, 소스 내용을 포함하지 않습니다.

## 어디에서 동작하나요?

npm 설치 프로그램의 공식 지원 대상은 **Codex와 Claude Code**입니다. 개발용 설치 프로그램은
agent-agnostic 스킬을 ZCode와 Pi / Oh My Pi에도 노출할 수 있으며, 다른 harness도 Node CLI를 직접
호출할 수 있습니다. 다만 이런 경로는 아직 공식 두 호스트와 같은 lifecycle hook, trust, 네이티브
수용 검증 매트릭스를 갖추지 않았습니다. Codex나 Claude를 감싸는 wrapper는 해당 호스트의 플러그인
환경과 이벤트를 보존할 때 동작합니다. Gajae Code, Pi, 그 밖의 orchestrator가 직접 통합하려면 discovery,
plugin data, 편집 이벤트 매핑, Stop 동작을 잇는 얇은 adapter가 필요합니다.
[이식성 계약](docs/development/agent-portability.md)을 참고하세요.

## BoxBox 개발

제품 소스는 `product/`에, 개발 도구·연구·증거는 `development/`에 있습니다.
`plugin/`은 제품 템플릿에서 생성되며, `dist/`에는 생성된 패키지가 저장됩니다.
`docs/`에는 공개 사용자·기여자 문서를 둡니다. 테스트·빌드 도구·이 문서들은 설치 패키지에서 제외되더라도
소스 저장소에 필요하며, 개인 작업 기록은 별도로 관리합니다.
[개발 안내](development/README.md)와 [디렉터리 구조 계약](docs/development/layout.md)을 참고하세요.

```sh
bun install
bun run check
./development/install.sh codex
bun product/packages/cli/entry.ts check --file path/to/file.ts --json
```

개발용 스킬은 Claude Code, Codex, ZCode, pi를 지원합니다. 기본 링크 설치는 현재 제품 소스를 따라가며,
`--copy`는 관리 대상 복사본을 만듭니다. 개발용 저작 훅은 호스트에 별도로 등록해야 합니다.

## 언어 지원 범위

| 구분 | 지원 범위 |
| --- | --- |
| 구현된 공개 CLI Check/Align 엔진 | TypeScript, Python, 엄격한 JSON, YAML 1.2 (`.yaml`/`.yml`) |
| 기본 프리셋 쓰기 승인 | TypeScript 선언 형태 4개와 Python 단순 대입, 다섯 규칙만 승인 |
| 개발용 정렬 엔진 | 위와 같은 4개 언어(그 밖의 라인 엔진 언어는 2026-10-22에 제거) |
| TypeScript 탐지 | TypeScript 7 AST 도구와 표 종류 레지스트리 |
| JSON/YAML 탐지 | 같은 단계에서 인접한 단일 행 스칼라 매핑 항목 3개 이상 |
| Python 탐지 | 문서별 CPython AST·토큰 분석을 공통 줄 엔진과 제한된 행 프로필에 전달 |

지원하는 4개 언어의 배포 지원 수준이 모두 같지는 않습니다. 기본 프리셋의 쓰기 승인은 TypeScript와 Python에만 있습니다. 쓰기 검증에는 해당 언어의 파서 도구가 필요합니다. 언어별 한계는 [구현 현황](docs/development/implementation.md)을 참고하세요.

## 프로젝트 설정과 규칙

프로젝트 설정은 `.boxbox/`에 저장됩니다. 설정은 Base → Preset → User → Project 순서로 적용되며, 안전 불변 조건은 항상 지켜야 합니다.

권장 프리셋에는 승인된 규칙 5개, 합성 예제 10개, 결정 기록 5개가 있습니다. 규칙은 TypeScript 최상위 선언인 같은 함수 호출, 그 밖의 호출, 빈 호출, 단순 값(2행 이상)과 Python 단순 대입(3행 이상)입니다. 연구 후보는 별도로 보관하며 자동으로 승인하지 않습니다. 현재 규칙은 [가독성 계약](product/rules/references/readability-contract.md), 에이전트 작업 흐름은 [플러그인 스킬](product/plugin/skills/boxbox/SKILL.md)을 참고하세요.

## 개발 현황

공개 설치 프로그램 `boxbox-plugin@0.2.8`은 게시됐으며, macOS의 Codex·Claude 깨끗한 registry 설치와
네이티브 Windows 설치·엔진 검사 증거가 있습니다. 결정적 엔진과 호스트 adapter는 구현됐지만, 선택형
inspector의 모델 선정은 명시적으로 미평가 상태입니다. 기본 `plugin/` 실행 연결 스크립트에는 여전히
명시적인 로컬 엔진이 필요하지만, npm 설치 프로그램은 그 엔진을 포함하여 영구 로컬 디렉터리에
설치합니다.

검증된 동작과 남은 작업은 [배포 준비 상태](docs/development/status.md), [배포 계약](docs/development/release-contract.md), [계획](docs/development/plan.md)을 참고하세요. 이름 변경과 구조 이전의 과거 기록은 [이름 변경 기록](docs/development/reviews/2026-10-16-boxbox-rename.md)에 있습니다.

## 기여하기

구조, 검사 단계, 저장 계약, 반복해서 적용할 수 있는 변경 절차는 [유지보수 문서](docs/development/README.md)에서 시작하세요.

```bash
bun install
bun run check
```

`check`는 제품 식별 정보와 의존 관계 검사, 테스트, TypeScript 타입 검사, 개발용 설치 스크립트의 셸 문법 검사를 실행합니다. 기여와 저작 규칙은 [AGENTS.md](AGENTS.md)를 따릅니다. BoxBox는 [MIT 라이선스](LICENSE)로 배포되며, 설치 패키지와 엔진 패키지도 `MIT`를 선언하고 라이선스 파일을 포함합니다. 합성 프리셋 예제 10개에는 별도로 CC0-1.0이 표시되어 있습니다.

제품 이름은 [`product.json`](product.json)에서 관리합니다. [이름 변경 절차와 코드 길이 기준](docs/development/product-identity.md)을 참고하세요.
