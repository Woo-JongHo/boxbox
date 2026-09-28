// Deliberately misaligned Rust table fixture — golden: tables.aligned.rs, traps: tricky.rs.

struct Connection<'a> {
    host       : String     ,
    port       : u16        ,
    timeout_ms : Duration   ,
    retry_limit: u32        ,
    tags       : Vec<String>,
}

// Second field table mixing strings, lifetimes and trailing comments — no width shared with the table above.

use std::time::Instant;

struct Record<'a> {
    id     : u64            , // row identifier
    label  : &'a str        ,
    tags   : Vec<String>    ,
    seen_at: Option<Instant>, // last lookup
}

fn sample<'a>(raw: &'a str) -> u32 {
    let name   : u32     = 7      ;
    let scale  : f64     = 0.5    ;
    let offset : i64     = -1     ;
    let retries: u32     = 3      ;
    let message: &'a str = "k=v:j";
}

fn totals() -> u32 {
    let base  = 10         ;
    let step  = 2          ;
    let total = base + step;
    let label = "n=m"      ;
}

enum Mode {
    Sleep,
    Pause,
    Halt ,
}

enum Frame {
    Read (u32)     ,
    Write(u64)     ,
    Move (i64, i64),
}

enum Priority {
    Low      = 1  ,
    Normal   = 10 ,
    High     = 100,
    Critical = 999,
}

fn route(frame: Frame) -> i64 {
    match frame {
        Read(n)    => n    ,
        Write(n)   => n * 2,
        Move(x, y) => x + y,
    }
}

// 2-row group — reported as a pair, not aligned.

struct Span {
    start: u32,
    end : u32,
}

// points are paren bundle rows — inner cell columns are aligned.
const POINTS: [(i32, i32); 3] = [
    (1  , 22  ),
    (333, 4   ),
    (55 , 6666),
];

// labels are 3-cell paren bundle rows — a different arity, so no width shared with the table above.
const LABELS: &[(&str, i32, &str)] = &[
    ("alpha", 1  , "x" ),
    ("b"    , 333, "yy"),
    ("gamma", 22 , "z" ), // cell columns align on the code part even with a comment
];

// edges is a 2-row pair — reported, not aligned.
const EDGES: [(u32, u32); 2] = [
    (7, 8),
    (99, 10),
];
