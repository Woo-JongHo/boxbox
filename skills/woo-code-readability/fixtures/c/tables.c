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
