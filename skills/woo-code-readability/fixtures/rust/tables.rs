// 의도적으로 어긋난 Rust 표 fixture — 골든은 tables.aligned.rs, 함정은 tricky.rs.

struct Connection<'a> {
    host   : String,
    port  : u16,
    timeout_ms     : Duration,
    retry_limit: u32,
    tags: Vec<String>,
}

// 문자열·수명·주석 꼬리가 섞인 두 번째 필드 표 — 위 표와 폭을 공유하지 않는다.

use std::time::Instant;

struct Record<'a> {
    id  : u64,      // 행 식별자
    label    : &'a str,
    tags: Vec<String>,
    seen_at   : Option<Instant>, // 마지막 조회
}

fn sample<'a>(raw: &'a str) -> u32 {
    let name  : u32 = 7;
    let scale : f64 = 0.5;
    let offset     : i64 = -1;
    let retries: u32 = 3;
    let message: &'a str = "k=v:j";
}

fn totals() -> u32 {
    let base = 10;
    let step  = 2;
    let total   = base + step;
    let label = "n=m";
}

enum Mode {
    Sleep,
    Pause,
    Halt,
}

enum Frame {
    Read (u32),
    Write(u64),
    Move (i64, i64),
}

enum Priority {
    Low      = 1,
    Normal  = 10,
    High     = 100,
    Critical = 999,
}

fn route(frame: Frame) -> i64 {
    match frame {
        Read(n)      => n,
        Write(n)  => n * 2,
        Move(x, y) => x + y,
    }
}

// 2행 그룹 — pair로 보고만 하고 정렬하지 않는다.

struct Span {
    start: u32,
    end : u32,
}

// points는 괄호 묶음 행이다 — 내부 셀 열을 맞춘다.
const POINTS: [(i32, i32); 3] = [
    (1, 22),
    (333, 4),
    (55, 6666),
];

// labels는 3셀 괄호 묶음 행이다 — arity가 달라 위 표와 폭을 공유하지 않는다.
const LABELS: &[(&str, i32, &str)] = &[
    ("alpha", 1, "x"),
    ("b", 333, "yy"),
    ("gamma", 22, "z"), // 주석이 있어도 셀 열은 코드 부분끼리 맞춘다
];

// edges는 2행 pair — 보고만 하고 정렬하지 않는다.
const EDGES: [(u32, u32); 2] = [
    (7, 8),
    (99, 10),
];
