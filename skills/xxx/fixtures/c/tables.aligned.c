/* Misaligned C table fixture — 06_align-tables produces the golden at the minimum width of the actual longest cell */

struct point {
    int          x    ;
    int          y    ;
    unsigned int flags;
    struct point *next;
};

/* Second field table, separated from the first by a comment */
typedef struct node {
    long long   weight; /* edge weight */
    struct node *prev ;
    struct node *next ; // prevents cycles
} node;

enum mode {
    MODE_OFF      = 0  ,
    MODE_LOW      = 10 , // power saving
    MODE_CRITICAL = 100,
};

enum level {
    LEVEL_QUIET = 1 ,
    LEVEL_LOUD  = 5 ,
    LEVEL_MAX   = 50,
};

struct config defaults = {
    .name       = "socket = open",
    .retries    = 3              ,
    .timeout_ms = 1500           , // milliseconds
};

/* Initializer tables are also split by comments */
struct limits bounds = {
    .min   = "min = 0; max = 9",
    .max   = 9                 ,
    .label = "범위"            ,
};

#define PORT     80 /* default port */
#define BACKLOG  128
#define GREETING "hi = ;"

static int counter;

int probe_a;
int probe_b;

/* Bundle row table — inner cell columns align to each longest cell */
static const Entry entries[] = {
    {1  , "alpha", 0x10 },
    {22 , "b"    , 0x201},
    {333, "ccc"  , 3    },
};

/* Bundle row table with a different arity — different slot count, so no width shared with the table above */
static const Flag flags[] = {
    {NAME_A, 0x1  , -1  , "first" },
    {NAME_B, 0x22 , +2  , "second"},
    {NAME_C, 0x333, 4096, "third" },
};

/* A 2-row bundle is reported but not aligned */
static const Pair pairs[] = {
    {7, "x"},
    {99, "yy"},
};
