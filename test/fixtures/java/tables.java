public class WarehouseConfig {

    public static final int     MAX_SIZE  = 100;
    private static final String LABEL     = "max=10;units=kg";
    private static final long   THRESHOLD = 42;

    // Retry limits — a second table of the same shape
    public static final double ratio   = 0.5;
    private static final int    retries = 3;
    private static final String stage   = "a=b;c=d";

    // Declaration-only field table
    private Map      cache;
    protected List   queue;
    private Deque    pending;

    // Initialized fields without modifiers
    int    shift = 0;
    long   limit = 90; // upper bound
    double window = 2;

    // 2-row pair — must not be aligned
    short total = 1;
    int   base  = 2;

    // Bundle row table — inner cell columns align to each longest cell
    private static final String[][] TABLE = {
        {"alpha", 1, "x"},
        {"b", 22, "yy"},
        {"ccc", 333, "z"},
    };

    // Bundle row table with a different arity — different slot count, so no width shared with the table above
    private static final Object[][] FLAGS = {
        {NAME_A, 0x1, -1, "first"},
        {NAME_B, 0x22, +2, "second"},
        {NAME_C, 0x333, 4096, "third"},
    };

    // A 2-row bundle is reported but not aligned
    private static final int[][] PAIRS = {
        {7, "x"},
        {99, "yy"},
    };

    public enum Level {

        Alpha(1, "one;two"),
        Beta(22, "x=y"),
        Gamma(333, "z=1;w=2"),

        Off,
        Partial,
        Full,
    }
}
