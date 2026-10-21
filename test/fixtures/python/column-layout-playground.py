"""Input and aligned examples for discussing column groups and nested alignment.

This is a runnable playground, not a golden file or approved formatting policy.
Case 02 is aligned by the current Python engine; other cases are comparison inputs.
Cases preserve statement order. Blank lines and comments mark deliberate boundaries.
"""

from dataclasses import dataclass
from typing import Any


def make(*args: Any, **kwargs: Any) -> tuple[Any, ...]:
	return (*args, kwargs) if kwargs else args


@dataclass
class VeryLongType:
	value: str


class ColumnLayoutPlayground:
	def __init__(self) -> None:
		x = "x"
		y = "y"
		z = "z"
		long_name = "long-name"
		value = VeryLongType("value")

		# 01. Original question: two calls followed by an annotated assignment.
		self.a = make(x, y)
		self.b = make(long_name, z)
		self.c: VeryLongType = value

		# 02. Many equal-shaped calls: compare every comma and closing parenthesis.
		self.first  = make("a"                    , "b"                     )
		self.second = make("a-long-first-argument", "c"                     )
		self.third  = make("d"                    , "a-long-second-argument")
		self.fourth = make("medium"               , "medium"                )
		self.fifth  = make("e"                    , "f"                     )
		self.sixth  = make("last"                 , "argument"              )

		# 03. An unusually long target must not automatically widen every short row.
		self.small = 1
		self.total = 20
		self.an_exceptionally_long_target_name_for_one_rare_assignment = 300
		self.count = 4
		self.limit = 50
		self.size = 600

		# 04. An unusually long value; compare outer columns with inner columns.
		self.one = make("a", "b", "c")
		self.two = make("a", "one-exceptionally-long-middle-argument-that-occurs-only-once", "c")
		self.three = make("d", "e", "f")
		self.four = make("g", "h", "i")
		self.five = make("j", "k", "l")

		# 05. Optional type columns interleaved with plain assignments.
		self.plain_a = 1
		self.typed_a: int = 2
		self.plain_b = 3
		self.typed_b: VeryLongType = value
		self.plain_c = 4
		self.typed_c: bool = True
		self.plain_d = 5
		self.typed_d: str = "text"

		# 06. Same annotated shape, but types have very different widths.
		self.enabled: bool = True
		self.retries: int = 3
		self.label: str = "worker"
		self.record: VeryLongType = value
		self.mapping: dict[str, list[tuple[int, str]]] = {}
		self.optional: VeryLongType | None = None

		# 07. Annotation-only rows omit '=' and value; assignment-only rows omit ':'.
		self.pending_a: int
		self.pending_b: VeryLongType
		self.pending_c: dict[str, list[int]]
		self.ready_a = 10
		self.ready_b = 20
		self.ready_c = 30
		self.pending_a = 40

		# 08. The same callee with different arities creates different inner shapes.
		self.zero = make()
		self.single = make("a")
		self.pair = make("a", "b")
		self.triple = make("a", "b", "c")
		self.pair_again = make("long-first", "second")
		self.single_again = make("long-single")

		# 09. Positional, keyword and expanded arguments must remain distinct.
		self.positional = make("a", "b")
		self.keyword = make(name="a", count=2)
		self.mixed = make("a", count=2)
		self.reversed_keywords = make(count=2, name="a")
		self.long_keyword = make(exceptionally_long_option_name=True, count=2)
		self.expanded = make(*["a", "b"], **{"count": 2})

		# 10. Different callees: sharing '=' need not mean sharing argument columns.
		self.built = make("a", "b")
		self.maximum = max(1, 20)
		self.minimum = min(300, 4)
		self.rounded = round(1.2345, 2)
		self.built_again = make("long-first", "second")
		self.maximum_again = max(50, 6)

		# 11. A single bundle argument adds another level of cells and commas.
		self.list_a = make([1, 20, 300])
		self.list_b = make([4000, 5, 60])
		self.list_c = make([7, 800, 9])
		self.tuple_a = make(("a", "long-middle", "c"))
		self.tuple_b = make(("long-first", "b", "d"))
		self.tuple_c = make(("e", "f", "long-last"))

		# 12. Nested calls: inspect each level without confusing their separators.
		self.nested_a = make(make("a", "b"), "c")
		self.nested_b = make(make("long-first", "d"), "e")
		self.nested_c = make(make("f", "long-second"), "g")
		self.nested_d = make("h", make("i", "j"))
		self.nested_e = make([make(1, 2), make(30, 4)], "k")

		# 13. Separators inside strings are data, never alignment boundaries.
		self.string_a = make("a,b", "x:y")
		self.string_b = make("left=right", "# not a comment")
		self.string_c = make("(inside)", "[inside]")
		self.string_d = make('quote: "a,b"', "backslash: \\")
		self.string_e = make(f"value={x}, next={y}", "tail")
		self.string_f = make("범위", "emoji: 🥚")

		# 14. Trailing comments have their own widths and remain original content.
		self.comment_a = make("a", "b") # short note
		self.comment_b = make("long-first", "c") # longer descriptive note
		self.comment_c = make("d", "e") # note with commas, colon: and equals=
		self.comment_d = make("f", "g")

		# 15. Explicit paragraph boundaries prevent width sharing.
		self.group_a = make("a", "b")
		self.group_b = make("c", "d")
		self.group_c = make("e", "f")

		self.separate_long_target = make("long-first", "long-second")
		self.separate_b = make("g", "h")
		self.separate_c = make("i", "j")

		# 16. Identical syntax can still represent different business purposes.
		self.host = "localhost"
		self.port = 8080
		self.protocol = "https"
		self.elapsed = 0.1
		self.attempts = 2
		self.failures = 0

		# 17. Different operators must not be treated as interchangeable columns.
		self.counter = 10
		self.counter += 2
		self.counter -= 1
		self.counter *= 3
		self.counter //= 2
		self.counter %= 5

		# 18. Tuple targets and chained assignment have different target shapes.
		self.left, self.right = make("a", "b")
		self.upper, self.lower = make("long-first", "c")
		self.primary = self.secondary = 0
		self.only = 1
		(self.inner_a, (self.inner_b, self.inner_c)) = (1, (2, 3))

		# 19. Multiline expressions and comprehensions are separate review cases.
		self.multiline = make(
			"first",
			"a-long-second-argument",
			"third",
		)
		self.comprehension = [item * 2 for item in range(4)]
		self.filtered = {item: item * 2 for item in range(4) if item > 0}
		self.conditional = "active" if self.enabled else "inactive"
		self.slice = self.comprehension[1:3]

		# 20. Nested blocks have independent alignment ranges.
		if self.enabled:
			self.branch_a = make("a", "b")
			self.branch_b = make("long-first", "c")
			self.branch_c = make("d", "e")
		else:
			self.branch_a = make("f", "g")
			self.branch_b = make("h", "long-second")
			self.branch_c = make("i", "j")

		# 21. Literal rows with matching and differing numbers of cells.
		self.rows = [
			("a", 1, True),
			("long-label", 200, False),
			("c", 30, True),
			("two-cells", 4),
			("five-cells", 5, False, "extra", None),
		]
		self.lookup = {
			"a": 1,
			"a-long-key": 200,
			"c": 30,
			"nested": {"inner": make(1, 2)},
		}

		# 22. Sparse abstract columns are comments, not invalid Python statements.
		# Columns:  1 = target; 2 = type; 3 = callee; 4 = arguments or value.
		# Present:  1,4     -> target plus scalar value.
		# Present:  1,2,3   -> typed target plus a callable value; no call arguments.
		# Present:  2,3     -> a function parameter type and its callable default.
		self.scalar = 7
		self.factory: Any = make

	def parameter_defaults(
		self,
		short: int = 1,
		long_parameter_name: VeryLongType | None = None,
		factory: Any = make,
		*,
		enabled: bool = True,
	) -> tuple[Any, ...]:
		return make(short, long_parameter_name, factory, enabled)


if __name__ == "__main__":
	example = ColumnLayoutPlayground()
	print(f"Prepared {len(vars(example))} attributes across 22 layout cases.")
