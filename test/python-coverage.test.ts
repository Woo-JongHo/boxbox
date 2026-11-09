import      { afterEach, describe, expect, test  } from "bun:test"                ;
import      { mkdtempSync, rmSync, writeFileSync } from "node:fs"                 ;
import      { tmpdir                             } from "node:os"                 ;
import      { join                               } from "node:path"               ;
import      { runAlignCli                        } from "@/common/align-cli.ts"   ;
import type { ResultEnvelope                     } from "@/common/result-json.ts" ;
import      { PYTHON_ALIGNER                     } from "@/python/profile.ts"     ;

const directories: string[] = [];

afterEach(() => {
	for (const directory of directories.splice(0)) rmSync(directory, { recursive: true, force: true });
});

function inspect(source: string) {
	const directory = mkdtempSync(join(tmpdir(), "boxbox-python-coverage-"));
	directories.push(directory);
	const file = join(directory, "input.py");
	writeFileSync(file, source);
	const run = runAlignCli(PYTHON_ALIGNER, ["--file", file, "--json"]);
	return (JSON.parse(run.report) as ResultEnvelope).results[0]!;
}

describe("bounded Python layout coverage", () => {
	const cases = [
		{ name : "top-level comma tuples"  , source : "alpha=1,2,\nbeta=3,4,\ngamma=5,6,\n"                       , lines : [1, 2, 3] },
		{ name : "indexed targets"         , source : "items[0]=1\nitems[1]=2\nitems[2]=3\n"                      , lines : [1, 2, 3] },
		{ name : "Unicode identifiers"     , source : "é=1\nlong_name=2\nδ=3\n"                                   , lines : [1, 3]    },
		{ name : "tuple-valued statements" , source : "first=1,\nlong_name=2,\nx=3,\n"                            , lines : [1, 2, 3] },
		{ name : "assigned keyword calls"  , source : "first=run(flag=1)\nlong_name=run(flag=2)\nx=run(flag=3)\n" , lines : [1, 2, 3] },
	] as const;

	test.each([...cases])("reports $name rather than a clean table verdict", ({ source, lines }) => {
		const result = inspect(source);
		expect(result.groups).toEqual([]);
		expect(result.unsupported?.map(row => row.line)).toEqual([...lines]);
		for (const row of result.unsupported ?? []) expect(row.reason).toContain("automatic layout coverage");
	});

	test("reports multiline assignments and numeric dictionary entries at their original lines", () => {
		const multiline  = inspect("first = (\n 1 + 2\n)\n\nsecond = (\n 3 + 4\n)\n") ;
		const dictionary = inspect("data = {\n 1: 10,\n 222: 20,\n 3: 30,\n}\n"     ) ;
		expect(multiline.unsupported?.map(row => row.line)).toEqual([1, 5]);
		expect(dictionary.unsupported?.map(row => row.line)).toEqual([1, 2, 3, 4]);
	});

	test("keeps partial coverage visible beside an aligned approved shape", () => {
		const result = inspect("a      = 1\nlonger = 2\nmid    = 3\n\nitems[0]=1\nitems[1]=2\nitems[2]=3\n");
		expect(result.groups.map(group => group.state)).toEqual(["PASS"]);
		expect(result.unsupported?.map(row => row.line)).toEqual([5, 6, 7]);
	});

	test("reports a formatted-string row rejected by lossless decomposition with or without a comment", () => {
		for (const suffix of ["", " # comment"]) {
			const result = inspect(`a = 1\nmessage = f"hi {a}"${suffix}\nlonger_name = 3\n`);
			expect(result.groups).toEqual([]);
			expect(result.unsupported?.map(row => row.line)).toEqual([2]);
		}
	});

	test("formatted values in dictionary and keyword rows remain explicitly unsupported", () => {
		for (const source of [
			'data = {\n "a": f"{x}",\n "longer": f"{x}",\n "mid": f"{x}",\n}\n',
			'call(\n a=f"{x}",\n longer=f"{x}",\n mid=f"{x}",\n)\n',
		]) {
			const result = inspect(source);
			expect(result.groups).toEqual([]);
			for (const line of [2, 3, 4]) expect(result.unsupported?.map(row => row.line)).toContain(line);
		}
	});

	test("does not label comments, literal contents or a decomposable lone row unsupported", () => {
		const result = inspect('# a = 1\ntext = """\na=1\nlonger=2\nmid=3\n"""\n\nx=1\n');
		expect(result.groups).toEqual([]);
		expect(result.unsupported?.map(row => row.line)).toEqual([2]);
	});
});
