import      { chmodSync, cpSync, mkdirSync, rmSync } from "node:fs"            ;
import      { resolve                              } from "node:path"          ;

import      { preparePublicPreset                  } from "./public-preset.ts" ;

const root         = resolve(import.meta.dir, ".."                              ) ;
const template     = resolve(root           , "packaging/cli"                   ) ;
const output       = resolve(root           , "dist/cli"                        ) ;
const preset       = resolve(root           , "skills/xxx/presets/recommended"  ) ;
const publicPreset = preparePublicPreset(preset)                                  ;

rmSync(output, { recursive: true, force: true });
mkdirSync(resolve(output, "dist"), { recursive: true });

for (const name of ["package.json", "README.md"]) cpSync(resolve(template, name), resolve(output, name));
const packagedPreset = resolve(output, "presets/recommended");
mkdirSync(packagedPreset, { recursive: true });
for (const file of publicPreset) {
	const destination = resolve(packagedPreset, file.path);
	mkdirSync(resolve(destination, ".."), { recursive: true });
	await Bun.write(destination, file.text);
}

const build = await Bun.build({
	entrypoints : [resolve(template, "entry.ts")],
	outdir      : resolve(output, "dist"),
	target      : "node",
	format      : "esm",
	external    : ["typescript", "typescript/*"],
	minify      : false,
	sourcemap   : "none",
	naming      : "cli.js",
});
if (!build.success) throw new Error(build.logs.map(log => log.message).join("\n"));

const bundlePath = resolve(output, "dist/cli.js")    ;
const bundle     = await Bun.file(bundlePath).text() ;
if (!bundle.startsWith("#!/usr/bin/env node")) throw new Error("public CLI bundle is missing its Node shebang");
for (const forbidden of ["Bun.", "bun:", "@/", root, "internal-runner", "00_normalize-imports", "00_expand-interface-members", "07_wrap-conditions", "08_function-map", "09_observe-shapes"]) {
	if (bundle.includes(forbidden)) throw new Error(`public CLI artifact contains forbidden runtime reference: ${forbidden}`);
}
chmodSync(bundlePath, 0o755);

console.log(output);
