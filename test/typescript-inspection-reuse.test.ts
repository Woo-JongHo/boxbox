import      { expect, spyOn, test                   } from "bun:test"                         ;
import      { mkdirSync, mkdtempSync, rmSync, symlinkSync, unlinkSync, writeFileSync } from "node:fs" ;
import      { tmpdir                                } from "node:os"                          ;
import      { join                                  } from "node:path"                        ;

import      { API                                   } from "typescript/unstable/async"         ;
import      { validateSyntax                        } from "@/common/11_syntax-validation.ts"   ;
import      {
              loadSourceFile                       ,
              syntacticDiagnostics                 ,
              withTypeScriptInspection
                                                   } from "@/typescript/15_load-source-file.ts" ;

function workspace(source = "const value = 1;\n"): { readonly root: string; readonly file: string } {
	const root = mkdtempSync(join(tmpdir(), "boxbox-typescript-inspection-")) ;
	const file = join       (root, "sample.ts"                              ) ;
	writeFileSync(join(root, "tsconfig.json"), JSON.stringify({ compilerOptions: { noLib: true }, files: ["sample.ts"] }));
	writeFileSync(file, source);
	return { root, file };
}

test("one inspection scope reuses the diagnostic AST and closes its only native API", async () => {
	const { root, file } = workspace();
	const close          = spyOn(API.prototype, "close");
	try {
		const loaded = await withTypeScriptInspection(async () => {
			expect(await syntacticDiagnostics(root, file, "const value = 1;\n")).toEqual([]);
			return loadSourceFile(root, "sample.ts");
		});
		expect(loaded.source.text).toBe("const value = 1;\n");
		expect(close).toHaveBeenCalledTimes(1);
	} finally {
		close.mockRestore();
		rmSync(root, { recursive: true, force: true });
	}
}, 60_000);

test("separate inspection scopes always perform fresh native reads", async () => {
	const { root, file } = workspace();
	const close          = spyOn(API.prototype, "close");
	try {
		for (let index = 0; index < 2; index++) {
			await withTypeScriptInspection(async () => {
				expect(await syntacticDiagnostics(root, file, "const value = 1;\n")).toEqual([]);
				expect((await loadSourceFile(root, "sample.ts")).source.text).toBe("const value = 1;\n");
			});
		}
		expect(close).toHaveBeenCalledTimes(2);
	} finally {
		close.mockRestore();
		rmSync(root, { recursive: true, force: true });
	}
}, 60_000);

test("an escaped diagnostic cannot retain or reuse an ended inspection scope", async () => {
	const { root, file } = workspace();
	const close          = spyOn(API.prototype, "close");
	let pending!: Promise<readonly string[]>;
	try {
		await withTypeScriptInspection(async () => {
			pending = syntacticDiagnostics(root, file, "const value = 1;\n");
		});
		expect(await pending                                        ).toEqual              ([]                  ) ;
		expect((await loadSourceFile(root, "sample.ts")).source.text).toBe                 ("const value = 1;\n") ;
		expect(close                                                ).toHaveBeenCalledTimes(2                   ) ;
	} finally {
		close.mockRestore();
		rmSync(root, { recursive: true, force: true });
	}
}, 60_000);

test("a BOM source bypasses reuse without changing native parser behavior", async () => {
	const source         = "\uFEFFconst value = 1;\n";
	const { root, file } = workspace(source);
	const close          = spyOn(API.prototype, "close");
	try {
		await withTypeScriptInspection(async () => {
			expect(await syntacticDiagnostics(root, file, source)).toEqual([]);
			expect((await loadSourceFile(root, "sample.ts")).source.text).toBe("const value = 1;\n");
		});
		expect(close).toHaveBeenCalledTimes(2);
	} finally {
		close.mockRestore();
		rmSync(root, { recursive: true, force: true });
	}
}, 60_000);

test("changed bytes, caller text, and root identity each prevent snapshot reuse", async () => {
	const { root, file } = workspace();
	const nested         = join(root, "nested");
	mkdirSync(nested);
	writeFileSync(join(nested, "sample.ts"), "const nested = 1;\n");
	writeFileSync(join(nested, "tsconfig.json"), JSON.stringify({ compilerOptions: { noLib: true }, files: ["sample.ts"] }));
	const close = spyOn(API.prototype, "close");
	try {
		await withTypeScriptInspection(async () => {
			expect(await syntacticDiagnostics(root, file, "const value = 1;\n")).toEqual([]);
			writeFileSync(file, "const value = 2;\n");
			await expect(loadSourceFile(root, "sample.ts")).rejects.toThrow("source changed during TypeScript inspection");
		});
		expect((await loadSourceFile(root, "sample.ts")).source.text).toBe("const value = 2;\n");
		await withTypeScriptInspection(async () => {
			await expect(syntacticDiagnostics(root, file, "different caller text\n")).rejects.toThrow("source changed during TypeScript inspection");
		});
		await withTypeScriptInspection(async () => {
			expect(await syntacticDiagnostics(root, join(nested, "sample.ts"), "const nested = 1;\n")).toEqual([]);
			expect((await loadSourceFile(nested, "sample.ts")).source.text).toBe("const nested = 1;\n");
		});
		expect(close).toHaveBeenCalledTimes(5);
	} finally {
		close.mockRestore();
		rmSync(root, { recursive: true, force: true });
	}
}, 60_000);

test("diagnostic formatting is preserved and parser failures still close the API", async () => {
	const { root, file } = workspace("const value = ;\n");
	const close          = spyOn(API.prototype, "close");
	try {
		expect(await withTypeScriptInspection(() => syntacticDiagnostics(root, file, "const value = ;\n"))).toEqual(["1:1109"]);
		const update = spyOn(API.prototype, "updateSnapshot").mockRejectedValueOnce(new Error("parser failed"));
		try {
			await expect(withTypeScriptInspection(() => syntacticDiagnostics(root, file, "const value = ;\n"))).rejects.toThrow("parser failed");
		} finally { update.mockRestore(); }
		expect(close).toHaveBeenCalledTimes(2);
	} finally {
		close.mockRestore();
		rmSync(root, { recursive: true, force: true });
	}
}, 60_000);

test("validateSyntax rejects bytes changed after its caller read but before the native snapshot", async () => {
	const { root, file } = workspace();
	const originalUpdate = API.prototype.updateSnapshot;
	const update         = spyOn(API.prototype, "updateSnapshot").mockImplementationOnce(function(this: API, ...args: Parameters<API["updateSnapshot"]>) {
		writeFileSync(file, "const replacement = 2;\n");
		return originalUpdate.apply(this, args);
	});
	try {
		const result = await withTypeScriptInspection(() => validateSyntax({ root, file: "sample.ts", language: "typescript" }));
		expect(result).toEqual({ status: "error", tool: "typescript", diagnostics: ["source changed during TypeScript inspection"] });
	} finally {
		update.mockRestore();
		rmSync(root, { recursive: true, force: true });
	}
}, 60_000);

for (const scenario of ["changed", "deleted", "retargeted"] as const) test(`validateSyntax reports a source change when input is ${scenario} after the parser snapshot`, async () => {
	const { root, file } = workspace();
	if (scenario === "retargeted") {
		writeFileSync(join(root, "first.ts"), "const value = 1;\n");
		writeFileSync(join(root, "second.ts"), "const value = 1;\n");
		unlinkSync(file);
		symlinkSync("first.ts", file);
	}
	const originalClose = API.prototype.close           ;
	const close         = spyOn(API.prototype, "close") ;
	let intercepted     = false                         ;
	close.mockImplementation(async function(this: API) {
		if (!intercepted) {
			intercepted = true;
			if (scenario === "changed") writeFileSync(file, "const value = 2;\n");
			if (scenario === "deleted") unlinkSync(file);
			if (scenario === "retargeted") {
				unlinkSync(file);
				symlinkSync("second.ts", file);
			}
		}
		return originalClose.call(this);
	});
	try {
		const result = await withTypeScriptInspection(() => validateSyntax({ root, file: "sample.ts", language: "typescript" }));
		expect(result).toEqual({ status: "error", tool: "typescript", diagnostics: ["source changed during TypeScript inspection"] });
		expect(close).toHaveBeenCalledTimes(1);
	} finally {
		close.mockRestore();
		rmSync(root, { recursive: true, force: true });
	}
}, 60_000);
