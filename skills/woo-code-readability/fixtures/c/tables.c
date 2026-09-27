/* 어긋난 C 표 fixture — 06_align-tables가 실제 최장 셀 기준 최소 폭으로 골든을 만든다 */

struct point {
    int x;
    int y;
    unsigned int flags;
    struct point *next;
};

/* 주석으로 구획을 끊는 두 번째 필드 표 */
typedef struct node {
    long long weight; /* 간선 가중치 */
    struct node *prev;
    struct node *next; // 순환 방지용
} node;

enum mode {
    MODE_OFF = 0,
    MODE_LOW = 10, // 절전
    MODE_CRITICAL = 100,
};

enum level {
    LEVEL_QUIET = 1,
    LEVEL_LOUD = 5,
    LEVEL_MAX = 50,
};

struct config defaults = {
    .name = "socket = open",
    .retries = 3,
    .timeout_ms = 1500, // 밀리초
};

/* 초기화 표도 주석으로 끊는다 */
struct limits bounds = {
    .min = "min = 0; max = 9",
    .max = 9,
    .label = "범위",
};

#define PORT 80 /* 기본 포트 */
#define BACKLOG 128
#define GREETING "hi = ;"

static int counter;

int probe_a;
int probe_b;

/* 묶음 행 표 — 내부 셀 열이 각 최장 셀에 맞춰진다 */
static const Entry entries[] = {
    {1, "alpha", 0x10},
    {22, "b", 0x201},
    {333, "ccc", 3},
};

/* arity가 다른 묶음 행 표 — 슬롯 수가 달라 앞 표와 폭을 공유하지 않는다 */
static const Flag flags[] = {
    {NAME_A, 0x1, -1, "first"},
    {NAME_B, 0x22, +2, "second"},
    {NAME_C, 0x333, 4096, "third"},
};

/* 2행 묶음은 보고만 하고 정렬하지 않는다 */
static const Pair pairs[] = {
    {7, "x"},
    {99, "yy"},
};
