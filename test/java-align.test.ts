import { describe, expect, test } from "bun:test";
import { maskSource }             from "../skills/woo-code-readability/scripts/common/code-text.ts";
import { alignSource }            from "../skills/woo-code-readability/scripts/common/table-engine.ts";
import { JAVA_ALIGNER }           from "../skills/woo-code-readability/scripts/java/profile.ts";
import { defineLanguageSuite }    from "./lang-harness.ts";

defineLanguageSuite({
	aligner     : JAVA_ALIGNER,
	fixturesDir : new URL("../skills/woo-code-readability/fixtures/java/", import.meta.url).pathname,
	tableFile   : "tables.java",
	alignedFile : "tables.aligned.java",
	trickyFile  : "tricky.java",
});

const maskedOf = (line: string): string => maskSource(line, JAVA_ALIGNER.syntax).text;

const axesOf = (line: string): readonly string[] => JAVA_ALIGNER.profile(line, maskedOf(line))?.slots.map(slot => slot.axis) ?? [];

/** 원본 간격(gapBefore)으로 되짚어 조합해 무손실 분해를 검사한다 — 엔진이 행하는 것과 같은 검사다. */
const losslessOf = (line: string): string | null => {
	const profile = JAVA_ALIGNER.profile(line, maskedOf(line));
	if (!profile) return null;
	return profile.indent + profile.slots.map((slot, position) => position === 0 ? slot.text : slot.gapBefore + slot.text).join("");
};

describe("java 프로파일 거부 규칙", () => {
	test("중괄호·어노테이션·제어문·메서드 시그니처 행은 null로 거부한다", () => {
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

	test("네 형태를 축 나열로 분해하고 enum 괄호 인자는 괄호째 단일 셀로 잡는다", () => {
		expect(axesOf('    private static final String LABEL = "max=10;units=kg";')).toEqual(["modifiers", "type", "name", "equal", "value", "semicolon"]);
		expect(axesOf("    protected List queue;")).toEqual(["modifiers", "type", "name", "semicolon"]);
		expect(axesOf("    int count = 0;")).toEqual(["type", "name", "equal", "value", "semicolon"]);
		expect(axesOf('    Beta(22, "x=y"),')).toEqual(["name", "parenArgs", "comma"]);
		expect(axesOf("    Off,")).toEqual(["name", "comma"]);
	});

	test("문자열 내부의 = ; 는 구조로 읽지 않고 값 셀에 통째로 보존한다", () => {
		const line = '    String LABEL = "a=b;c=d // e";';
		const profile = JAVA_ALIGNER.profile(line, maskedOf(line));
		expect(profile?.slots.map(slot => [slot.axis, slot.text])).toEqual([
			["type", "String"],
			["name", "LABEL"],
			["equal", "="],
			["value", '"a=b;c=d // e"'],
			["semicolon", ";"],
		]);
		expect(losslessOf(line)).toBe(line);
	});

	test("구분자 축은 열 축이 아니고 canonical 간격은 Java 관습을 따른다", () => {
		for (const axis of ["equal", "semicolon", "comma", "open", "close"]) {
			expect(JAVA_ALIGNER.columnAxes).not.toContain(axis);
		}
		for (const axis of ["modifiers", "type", "name", "value", "parenArgs", "cell", "arg"]) {
			expect(JAVA_ALIGNER.columnAxes).toContain(axis);
		}
		expect(JAVA_ALIGNER.canonicalGaps).toEqual({ modifiers: " ", type: " ", name: " ", value: " ", parenArgs: "", equal: " ", semicolon: "", comma: "", open: "", cell: "", arg: " ", close: "" });
	});

	test("enum 상수 재조합은 이름과 괄호 사이에 공백을 늘리지 않는다", () => {
		const line = '        Beta(22, "x=y"),';
		expect(losslessOf(line)).toBe(line);
		const profile = JAVA_ALIGNER.profile(line, maskedOf(line));
		const canonical = profile!.indent + profile!.slots.map((slot, position) => `${position === 0 ? "" : JAVA_ALIGNER.canonicalGaps[slot.axis] ?? " "}${slot.text}`).join("");
		expect(canonical).toBe(line);
	});

	test("값이 비었거나 문자열 밖 ;를 둘 이상 품는 초기화는 확신 없음으로 거부한다", () => {
		for (const line of ["    int broken = ;", "    int split = a; b;", '    int nested = m(a; b);']) {
			expect(JAVA_ALIGNER.profile(line, maskedOf(line))).toBeNull();
		}
	});

	test("중첩·대입·호출·첨자·제네릭 묶음 행과 단일·빈 셀 행은 거부한다", () => {
		for (const line of [
			"    {1, {2, 3}, 4},",      // 중첩 묶음
			"    {1, x = 2, 3},",       // 대입
			"    {foo(1), 2},",         // 함수 호출
			"    {map[0], 2},",         // 첨자
			"    {List<Int>, 2},",      // 제네릭
			"    {Value.valueOf, 1},",  // 한정 참조는 스칼라가 아니다
			'    {"a"},',               // 셀 1개
			"    {a, },",               // 빈 셀
			'    {"a", 1} x',           // trailer 자리에 잔류
		]) {
			expect(JAVA_ALIGNER.profile(line, maskedOf(line))).toBeNull();
		}
	});
});

describe("java 정렬 성질", () => {
	test("묶음 행은 내부 셀 열을 각 최장 셀 폭에 맞춘다", () => {
		const source = [
			"    private static final String[][] TABLE = {",
			'        {"alpha", 1, "x"},',
			'        {"b", 22, "yy"},',
			'        {"ccc", 333, "z"},',
			"    };",
		].join("\n");
		const result = alignSource(source, JAVA_ALIGNER, { minRows: 3, apply: true });
		const lines = result.output.split("\n");
		expect(lines[1]).toBe('        {"alpha", 1  , "x" },');
		expect(lines[2]).toBe('        {"b"    , 22 , "yy"},');
		expect(lines[3]).toBe('        {"ccc"  , 333, "z" },');
		expect(result.misaligned).toBe(3);
	});

	test("형태가 다른 초기화 필드는 슬롯 수대로 서로 다른 표로 갈린다", () => {
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
		expect(outputLines[0]).toBe("    private static final int MAX_SIZE = 10;");
		expect(outputLines[1]).toBe("    private static final int LIMIT    = 20;");
		expect(outputLines[4]).toBe("    int count = 0 ;");
		expect(outputLines[6]).toBe("    int shift = 2 ;");
	});
});
