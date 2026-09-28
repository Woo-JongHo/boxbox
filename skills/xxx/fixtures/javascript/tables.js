// Object literal table 1 — key and value columns are misaligned.
const config = {
  short: 1,
  aVeryLongKey: 22,
  mid: "v:1;k=2", // separators inside strings are not structure
  deep: { nested: true },
};

// Object literal table 2 — does not share widths with the previous table.
const limits = {
  low: 5,
  higherLimit: 300,
  tiny: `tpl:${1 + 1}`,
};

class Span {
  width = 10;
  height = 200;
  label = "w=10;h=2";
}

const small = 1;
const extraLargeName = 222;
const midSize = "a=b;c"; // trailing comment

// Pair — two rows do not form a table.
const pairOne = 1;
const pairTwo = 22;

// Bundle row table — adjacent 3-cell and 4-cell rows do not share widths when their arity differs.
const rows = [
  ["alpha", 1, "x"],
  ["b", 22, "yy"],
  ["ccc", 333, "z"], // the trailing comment follows the closing bracket
  ["a", 1, true, null],
  ["bb", 22, false, undefined],
  ["x,y", 333, true, "z"],
];

// Bundle pair — two rows do not form a table.
const pairRows = [
  ["pair", 1, 2],
  ["pairs", 22, 33],
];
