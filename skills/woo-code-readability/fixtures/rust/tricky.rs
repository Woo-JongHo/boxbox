// tricky: 겉보기 표 행·문자열·주석·수명 함정 — 0 변경이어야 한다.

#[derive(Debug, Clone)]
struct Tricky<'a> {
    note: &'static str, // 라벨: 값 = 의미
}

// Key:      value,
// Name    string    `json:"name"`
// Move(x, y) => x + y,

/*
   blocks: 값 = "x: y => z,"
*/

const RULE: &str = "a: b = c => d";

let lookalike = "x:   y => z,";

'a: loop {
    break 'a;
}

let cfg = Config {
    host: String::from("a=b"),
    port: 8,
};

let quote = '\'';

let s = "t"; // Pattern => Action,

let pair: ("a: b", u32) = ("k=v", 3);
