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

위 정렬 예시는 실제 TypeScript 엔진의 출력입니다. 이름, 값, 실행 순서는 유지하면서 대응하는 구문을 더 쉽게 비교할 수 있게 합니다.

제품명은 **BoxBox**이며, 핵심 CLI·스킬·플러그인 ID는 `boxbox`입니다(2026-10-16 확정). npm 설치 패키지 후보는 `boxbox-plugin`이며, 확인 당시에는 등록되지 않은 이름이었습니다. 목표 설치 명령은 `npx boxbox-plugin`입니다. 패키지 게시에는 유효한 npm 인증과 최종 릴리스 결정이 필요합니다. [Windows 플러그인 설치 안내](docs/user/codex-windows-test.md)를 참고하세요.

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

0.2.5 소스 후보는 에이전트 작업과 엔진의 변경 범위를 구분합니다.

- **Write — 작성:** 에이전트가 승인된 작성 안내를 참고하여 요청한 기능을 구현합니다.
- **Refactor — 구조 개선:** 에이전트가 기존 구조를 개선하고 동작과 필요한 성능을 별도로 검증합니다.
- **Align — 정렬:** 엔진이 승인된 가로 배치 공백을 조정합니다. 줄바꿈·들여쓰기를 바꾸거나 외부 포매터를 실행하지 않습니다.
- **Check — 검사:** 기존 코드를 수정하지 않고 조사합니다. 탐지된 그룹이 없다고 파일 전체의 스타일이 검증된 것은 아닙니다.

`guide --file <file> --authoring --json`은 기존 파일, 빈 파일, 아직 만들지 않은 파일에 적용할 승인된 안내를 제공합니다.
예제는 작성 안내이며 해당 파일의 쓰기 승인 증거가 아닙니다. `align --file <file> --dry-run --json`으로 정렬을 미리 보고,
`align --file <file> --json`으로 적용합니다. Write와 Refactor는 CLI 생성 명령이 아니라 호스트 에이전트의 작업입니다.
미리보기는 대상을 변경하지 않으며, 기존 `format` 파이프라인은 별도 작업으로 유지합니다.
통합 검증과 독립 검토는 진행 중입니다. [작업 모드 선택과 검증의 한계](docs/user/modes.md)를 참고하세요.

CLI는 이제 TypeScript, Python, 엄격한 JSON, YAML 1.2를 검사하며 구문 상태를 valid, invalid, parser error로
보고합니다. JSON/YAML 정렬 범위는 같은 단계에서
서로 인접한 단일 행 스칼라 매핑 항목 3개 이상으로 제한됩니다. 지원하지 않는 행은 별도로 보고하고 그대로
둡니다. YAML 블록 스칼라, 앵커, 별칭, 태그, 복합 키, flow collection, sequence, directive, document marker는
이 정렬 범위에 포함되지 않습니다. 구조화 문서용 Align 엔진 경로는 구현됐지만, 권장 프리셋의 쓰기 승인은
아래 TypeScript/Python 규칙 2개뿐입니다. JSON/YAML 쓰기에는 완전한 로컬 승인 증거나 향후 프리셋 승인이
별도로 필요합니다.

## 플러그인 설치

공개 npm 설치 패키지는 `boxbox-plugin`이라는 이름으로 준비 중이며, 레지스트리 게시는 아직 대기 중입니다.
Codex와 Claude Code용 플러그인 및 로컬 Node 엔진을 설치합니다. 현재 미리보기 상태와 호스트 요구 사항은
[설치 안내](docs/user/codex-windows-test.md)를 참고하세요.

로컬에서 빌드한 설치 패키지를 사용하려면:

```sh
bun install
bun run pack:installer
npm exec --yes --package '/absolute/path/to/dist/installer/boxbox-plugin-<version>.tgz' -- boxbox --codex
```

`<version>`을 `package.json`의 버전으로 바꾸거나, `pack:installer`가 출력한 정확한 아카이브 경로를 사용하세요. 로컬 패키지를 빌드하려면 저장소 체크아웃이 필요합니다. 설치된 플러그인은 영구 설치된 자체 Node 엔진을 사용합니다.
공개 설치 프로그램에는 Node.js 22.22.3 이상과 npm이 필요하며, Python 포맷에는 `python3`가 추가로 필요합니다.

## 터미널 HUD

로컬 설치 후보에서 macOS/Linux용 BoxBox HUD를 선택적으로 켤 수 있습니다.

```sh
npm exec --yes --package '/absolute/path/to/dist/installer/boxbox-plugin-<version>.tgz' -- boxbox --codex --claude --hud
~/.local/bin/boxbox-codex
```

Claude Code는 재시작 후 자체 상태줄을 사용합니다. Codex는 `boxbox-codex`로 실행하면 별도의 tmux 영역에
표시하며, 일반 `codex` 명령은 바뀌지 않습니다. tmux를 먼저 설치하고 기존 tmux 세션 밖에서 실행하세요.
HUD에는 엔진 준비 상태, 승인 규칙 수, 관측한 검사 결과가 나옵니다. 기록이 없으면 알 수 없음으로 표시합니다.
Codex는 시작할 때 고정한 프로젝트의 이력을 보여주며, 현재 세션의 결과 수용을 증명하지 않습니다.
이 어댑터는 Windows와 데스크톱 앱 HUD를 지원하지 않습니다. 설치는 관련 없는 설정을 보존하고, 다른 Claude
상태줄이 있으면 덮어쓰지 않으며, 훅 신뢰를 부여하지 않습니다. [HUD 설정·제약·해제](docs/user/hud.md)를 참고하세요.

## BoxBox 개발

제품 소스는 `product/`에, 개발 도구·연구·증거는 `development/`에 있습니다.
`plugin/`은 제품 템플릿에서 생성되며, `dist/`에는 생성된 패키지가 저장됩니다.
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
| 기본 프리셋 쓰기 승인 | TypeScript 호출 선언과 Python 단순 대입, 두 규칙만 승인 |
| 개발용 정렬 엔진 | TypeScript, Python, Java, Go, Rust, JavaScript, C, C++, Swift, Kotlin |
| TypeScript 탐지 | TypeScript 7 AST 도구와 표 종류 레지스트리 |
| JSON/YAML 탐지 | 같은 단계에서 인접한 단일 행 스칼라 매핑 항목 3개 이상 |
| 기타 개발 언어 탐지 | 언어별 프로필을 사용하는 공통 줄 단위 엔진 |

개발용 엔진이 10개 언어를 다룬다고 해서 배포 지원 수준이 모두 같다는 뜻은 아닙니다. 쓰기 검증에는 해당 언어의 파서 도구가 필요합니다. 언어별 한계는 [구현 현황](docs/development/implementation.md)을 참고하세요.

## 프로젝트 설정과 규칙

프로젝트 설정은 `.boxbox/`에 저장됩니다. 설정은 Base → Preset → User → Project 순서로 적용되며, 안전 불변 조건은 항상 지켜야 합니다.

권장 프리셋에는 승인된 규칙 2개, 합성 예제 4개, 결정 기록 2개가 있습니다. 규칙은 TypeScript 최상위 호출 선언(2행 이상)과 Python 단순 대입(3행 이상)입니다. 연구 후보는 별도로 보관하며 자동으로 승인하지 않습니다. 현재 규칙은 [가독성 계약](product/rules/references/readability-contract.md), 에이전트 작업 흐름은 [플러그인 스킬](product/plugin/skills/boxbox/SKILL.md)을 참고하세요.

## 개발 현황

현재는 개발 중이며 공개 배포가 완료된 상태가 아닙니다. 로컬 CLI 패키지와 스킬 어댑터는 구현되어 있지만, 공개 배포·호스트 네이티브 이벤트 수용·배포 패키지의 라이선스 메타데이터 작업은 남아 있습니다. 기본 `plugin/` 실행 연결 스크립트에는 명시적인 로컬 엔진 설정이 필요합니다. Windows Codex 시험에는 포함된 엔진을 영구 로컬 디렉터리에 설치하는 [npm 설치 프로그램](docs/user/codex-windows-test.md)을 사용하세요. 선택된 npm 설치 패키지 이름은 `boxbox-plugin`이며, 게시는 아직 대기 중입니다.

검증된 동작과 남은 작업은 [배포 준비 상태](docs/development/status.md), [배포 계약](docs/development/release-contract.md), [계획](docs/development/plan.md)을 참고하세요. 이름 변경과 구조 이전의 과거 기록은 [이름 변경 기록](docs/development/reviews/2026-10-16-boxbox-rename.md)에 있습니다.

## 기여하기

구조, 검사 단계, 저장 계약, 반복해서 적용할 수 있는 변경 절차는 [유지보수 문서](docs/development/README.md)에서 시작하세요.

```bash
bun install
bun run check
```

`check`는 제품 식별 정보와 의존 관계 검사, 테스트, TypeScript 타입 검사, 개발용 설치 스크립트의 셸 문법 검사를 실행합니다. 기여와 저작 규칙은 [AGENTS.md](AGENTS.md)를 따릅니다. GitHub main의 기존 [MIT LICENSE](LICENSE)는 유지됩니다. 설치 패키지 후보는 여전히 UNLICENSED 미리보기 메타데이터를 사용하며, 게시와 배포 패키지 메타데이터는 별도의 결정 사항입니다. 합성 프리셋 예제 4개에는 별도로 CC0-1.0이 표시되어 있습니다.

제품 이름은 [`product.json`](product.json)에서 관리합니다. [이름 변경 절차와 코드 길이 기준](docs/development/product-identity.md)을 참고하세요.
