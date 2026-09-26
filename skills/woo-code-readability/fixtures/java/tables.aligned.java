public class WarehouseConfig {

    public static final  int    MAX_SIZE  = 100              ;
    private static final String LABEL     = "max=10;units=kg";
    private static final long   THRESHOLD = 42               ;

    // 재시도 한도 — 같은 형태의 두 번째 표
    public static final  double ratio   = 0.5      ;
    private static final int    retries = 3        ;
    private static final String stage   = "a=b;c=d";

    // 선언만 있는 필드 표
    private   Map   cache  ;
    protected List  queue  ;
    private   Deque pending;

    // 수식어 없는 초기화 필드
    int    shift  = 0 ;
    long   limit  = 90; // 상한 개수
    double window = 2 ;

    // 2행 pair — 정렬 금지 대상
    short total = 1;
    int   base  = 2;

    public enum Level {

        Alpha(1, "one;two")  ,
        Beta (22, "x=y")     ,
        Gamma(333, "z=1;w=2"),

        Off    ,
        Partial,
        Full   ,
    }
}
