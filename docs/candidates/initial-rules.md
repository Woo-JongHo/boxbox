# 초기 규칙 후보 승인 패킷

이 문서는 아직 승인되지 않은 두 규칙 후보를 사람이 직접 비교하기 위한 자료다. 아래 승인은 적힌 조회 키와 파일 범위에만 적용되며, 다른 문형·행 수·언어·컨테이너에 대한 일반 스타일 승인을 뜻하지 않는다.

## rule-ts-sourcefile-call-declarations

- 후보 ID: `ts-sourcefile-call-declarations`
- 정확한 조회 키: `v1|typescript|SourceFile|declaration-equals|equals>call-open-paren>call-close-paren>semicolon`
- 적용 범위: `**/*.ts`
- 문형: `SourceFile`의 연속된 변수 선언 행이 단일 호출식 초기값을 가지며, 엔진이 이 정확한 축의 `declaration-equals`로 묶는 2행 이상의 `DEFINE` 표. 아래 `const`는 대표 예문이며 조회 키는 `const`/`let`/`var`를 구분하지 않는다.

승인 전:

```ts
const short = make(1);
const muchLonger = make(22);
const middle = make(333);
```

승인 후 기대 형태:

```ts
const short      = make(1  ) ;
const muchLonger = make(22 ) ;
const middle     = make(333) ;
```

범위 밖 반례:

```ts
const only = make(1);
```

한 행은 표로 검출되지 않으며 자동 정렬하지 않는다. 반대로 이 table kind에는 기존 엔진의 2행 예외가 있으므로, 조회 키가 같은 2행도 승인 범위에 포함된다.

수집한 실행 증거:

- 내부 러너 check JSON: `groups=1`, `misaligned=1`, `edits=7`, `kind=declaration-equals`, `rows=3`, `context=SourceFile`, `depth=0`.
- 안전 쓰기 JSON: `parse.status=ok`, `tool=typescript`, `passes=2`.
- 재검사 JSON: 같은 키의 표가 `state=PASS`, `misaligned=0`, `edits=0`인 고정점.
- TypeScript 7 scanner의 `preservesTokens(before, after)`가 `true`.
- 같은 조회 키의 2행 실측: check에서 `rows=2`, `FIXABLE`, `edits=4`; 안전 쓰기에서 `parse.status=ok`, `passes=2`; 재검사에서 `PASS`, `misaligned=0`, `edits=0`.
- 한 행 반례 write JSON: `groups=0`, `misaligned=0`, `edits=0`; 실행 전후 SHA-256가 `2aa5675adbf864add211e0d9ddc9e5b3b5179bd805ec3acb387cd86e61e299b6`로 같음.

사람의 승인이 허용하는 것은 이 정확한 조회 키와 `**/*.ts` 범위에서 엔진이 검출하는 `SourceFile` 단일 호출 변수 선언 행 2개 이상을 추천 convention으로 인정하는 것뿐이다. 선언 종류를 `const`로 제한하거나 실행 순서를 바꾸는 승인이 아니며, 다른 AST 컨테이너, 다른 초기값 구조, 다른 축 조합, 1행 입력은 승인하지 않는다.

## rule-python-simple-assignments

- 후보 ID: `py-simple-assignments`
- 정확한 조회 키: `v1|python|-|table|name>equal>value`
- 적용 범위: `**/*.py`
- 문형: 들여쓰기 깊이와 관계없이 같은 indent에서 연속된 단순 이름 대입 3행 이상으로 이루어진 `DEFINE` 표

승인 전:

```python
if enabled:
  alpha = 1
  much_longer = 22
  mid = 333
```

승인 후 기대 형태:

```python
if enabled:
  alpha       = 1
  much_longer = 22
  mid         = 333
```

범위 밖 반례:

```python
alpha = 1
much_longer = 22
```

두 행은 `SUGGEST`로만 보고하며 자동 정렬하지 않는다. 최소 3행 조건은 이 후보 승인에 포함되는 명시적 경계다.

수집한 실행 증거:

- 내부 러너 check JSON: `groups=1`, `misaligned=1`, `edits=2`, `kind=table`, `rows=3`, `depth=0`.
- 안전 쓰기 JSON: `parse.status=ok`, `tool=python3`.
- 재검사 JSON: 같은 키의 표가 `state=PASS`, `misaligned=0`, `edits=0`인 고정점.
- 2칸 들여쓰기 실측에서 JSON의 `depth=0`이어도 같은 조회 키가 생성됐으며, 각 행의 기존 2칸 indent를 그대로 보존함.
- 라인 엔진의 `changedLines(before, after, PYTHON_ALIGNER.syntax)`가 빈 배열로, indent를 포함해 수평 정렬 공백 밖의 내용 변화가 없음.
- 두 행 반례 write JSON: `state=SUGGEST`, `suggested=1`, `misaligned=0`, `edits=0`; 실행 전후 SHA-256가 `fff7d9e30fae59f0d3dd2021c25d9c1813451dc95d6c9d4e428f97f9610a432c`로 같음.

사람의 승인이 허용하는 것은 이 정확한 조회 키와 `**/*.py` 범위에서 어느 들여쓰기든 같은 indent에 연속된 최소 3행의 단순 이름 대입을 추천 convention으로 인정하는 것뿐이다. 두 행 입력, 서로 다른 indent가 섞인 입력, 복합 대입, 다른 축 조합, 다른 언어의 대입문은 승인하지 않는다.
