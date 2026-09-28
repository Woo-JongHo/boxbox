// tricky: look-alike table rows, strings, comments and lifetime traps — must produce 0 changes.

#[derive(Debug, Clone)]
struct Tricky<'a> {
    note: &'static str, // label: value = meaning
}

// Key:      value,
// Name    string    `json:"name"`
// Move(x, y) => x + y,

/*
   blocks: value = "x: y => z,"
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
