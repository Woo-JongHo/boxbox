import      { describe, expect, test } from "bun:test"                 ;
import      { maskSource             } from "@/common/code-text.ts"    ;
import      { alignSource            } from "@/common/table-engine.ts" ;
import      { JAVA_ALIGNER           } from "@/java/profile.ts"        ;
import      { defineLanguageSuite    } from "./lang-harness.ts"        ;

defineLanguageSuite({
	aligner     : JAVA_ALIGNER                                                ,
	fixturesDir : new URL("../test/fixtures/java/", import.meta.url).pathname ,
	tableFile   : "tables.java"                                               ,
	alignedFile : "tables.aligned.java"                                       ,
	trickyFile  : "tricky.java"                                               ,
});

const maskedOf = (line: string): string => maskSource(line, JAVA_ALIGNER.syntax).text;

const axesOf = (line: string): readonly string[] => JAVA_ALIGNER.profile(line, maskedOf(line))?.slots.map(slot => slot.axis) ?? [];

/** Reassembles with the original gaps (gapBefore) to check lossless decomposition — the same check the engine performs. */
const losslessOf = (line: string): string | null => {
	const profile = JAVA_ALIGNER.profile(line, maskedOf(line));
	if (!profile) return null;
	return profile.indent + profile.slots.map((slot, position) => position === 0 ? slot.text : slot.gapBefore + slot.text).join("");
};

describe("java profile refusal rules", () => {
	test("refuses brace, annotation, control-flow and method-signature rows with null", () => {
		const rejected = [
			"public class Warehouse {",
			"    }",
			"    {",
			"    @Override",
			'    @SuppressWarnings("a=b;c")',
			"    if (count > 0) {",
			"    for (int i = 0; i < size; i++) {",
			"    while (ready && size > 0) {",
			"    return total;",
			"    import java.util.List;",
			"    public void run(int speed) {",
			"    public Warehouse(int size) {",
			"    Map<String, Integer> cache = new HashMap<>();",
		];
		for (const line of rejected) {
			expect(JAVA_ALIGNER.profile(line, maskedOf(line))).toBeNull();
		}
	});

	test("decomposes the four forms into axis sequences and keeps enum argument lists as one cell including parentheses", () => {
		expect(axesOf('    private static final String LABEL = "max=10;units=kg";')).toEqual(["modifiers", "type", "name", "equal", "value", "semicolon"]) ;
		expect(axesOf("    protected List queue;")                                 ).toEqual(["modifiers", "type", "name", "semicolon"]                  ) ;
		expect(axesOf("    int count = 0;")                                        ).toEqual(["type", "name", "equal", "value", "semicolon"]             ) ;
		expect(axesOf('    Beta(22, "x=y"),')                                      ).toEqual(["name", "parenArgs", "comma"]                              ) ;
		expect(axesOf("    Off,")                                                  ).toEqual(["name", "comma"]                                           ) ;
	});

	test("does not read = ; inside strings as structure and keeps them whole in the value cell", () => {
		const line    = '    String LABEL = "a=b;c=d // e";'       ;
		const profile = JAVA_ALIGNER.profile(line, maskedOf(line)) ;
		expect(profile?.slots.map(slot => [slot.axis, slot.text])).toEqual([
			["type", "String"],
			["name", "LABEL"],
			["equal", "="],
			["value", '"a=b;c=d // e"'],
			["semicolon", ";"],
		]);
		expect(losslessOf(line)).toBe(line);
	});

	test("separator axes are not column axes and canonical gaps follow Java conventions", () => {
		for (const axis of ["equal", "semicolon", "comma", "open", "close"]) {
			expect(JAVA_ALIGNER.columnAxes).not.toContain(axis);
		}
		for (const axis of ["modifiers", "type", "name", "value", "parenArgs", "cell", "arg"]) {
			expect(JAVA_ALIGNER.columnAxes).toContain(axis);
		}
		expect(JAVA_ALIGNER.canonicalGaps).toEqual({ modifiers: " ", type: " ", name: " ", value: " ", parenArgs: "", equal: " ", semicolon: "", comma: "", open: "", cell: "", arg: " ", close: "" });
	});

	test("reassembling enum constants adds no space between the name and the parenthesis", () => {
		const line = '        Beta(22, "x=y"),';
		expect(losslessOf(line)).toBe(line);
		const profile   = JAVA_ALIGNER.profile(line, maskedOf(line))                                                                                                             ;
		const canonical = profile!.indent + profile!.slots.map((slot, position) => `${position === 0 ? "" : JAVA_ALIGNER.canonicalGaps[slot.axis] ?? " "}${slot.text}`).join("") ;
		expect(canonical).toBe(line);
	});

	test("refuses as uncertain initializers with an empty value or more than one ; outside strings", () => {
		for (const line of ["    int broken = ;", "    int split = a; b;", '    int nested = m(a; b);']) {
			expect(JAVA_ALIGNER.profile(line, maskedOf(line))).toBeNull();
		}
	});

	test("refuses bundle rows with nesting, assignment, calls, indexing or generics, and single or empty cells", () => {
		for (const line of [
			"    {1, {2, 3}, 4},",      // nested bundle
			"    {1, x = 2, 3},",       // assignment
			"    {foo(1), 2},",         // function call
			"    {map[0], 2},",         // indexing
			"    {List<Int>, 2},",      // generics
			"    {Value.valueOf, 1},",  // a qualified reference is not a scalar
			'    {"a"},',               // single cell
			"    {a, },",               // empty cell
			'    {"a", 1} x',           // leftover in the trailer position
		]) {
			expect(JAVA_ALIGNER.profile(line, maskedOf(line))).toBeNull();
		}
	});
});

describe("java alignment properties", () => {
	test("bundle rows align inner cell columns to each longest cell", () => {
		const source = [
			"    private static final String[][] TABLE = {",
			'        {"alpha", 1, "x"},',
			'        {"b", 22, "yy"},',
			'        {"ccc", 333, "z"},',
			"    };",
		].join("\n");
		const result = alignSource        (source, JAVA_ALIGNER, { minRows: 3, apply: true }) ;
		const lines  = result.output.split("\n"                                             ) ;
		expect(lines[1]         ).toBe('        {"alpha", 1  , "x" },') ;
		expect(lines[2]         ).toBe('        {"b"    , 22 , "yy"},') ;
		expect(lines[3]         ).toBe('        {"ccc"  , 333, "z" },') ;
		expect(result.misaligned).toBe(3                              ) ;
	});

	test("initialized fields of different shapes split into different tables by slot count", () => {
		const source = [
			"    private static final int MAX_SIZE = 10;",
			"    private static final int LIMIT = 20;",
			"    private static final int OFFSET = 30;",
			"",
			"    int count = 0;",
			"    int limit = 20;",
			"    int shift = 2;",
		].join("\n");
		const result = alignSource(source, JAVA_ALIGNER, { minRows: 3, apply: true });
		expect(result.tables).toBe(2);
		expect(result.misaligned).toBe(4);
		const outputLines = result.output.split("\n");
		expect(outputLines[0]).toBe("    private static final int MAX_SIZE = 10;") ;
		expect(outputLines[1]).toBe("    private static final int LIMIT    = 20;") ;
		expect(outputLines[4]).toBe("    int count = 0 ;"                        ) ;
		expect(outputLines[6]).toBe("    int shift = 2 ;"                        ) ;
	});
});
