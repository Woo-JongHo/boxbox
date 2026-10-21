import      { chmodSync, cpSync, mkdirSync, rmSync } from "node:fs"            ;
import      { resolve                              } from "node:path"          ;

import      { preparePublicPreset                  } from "./public-preset.ts" ;

const root         = resolve(import.meta.dir, ".."                              , "..")  ;
const template     = resolve(root           , "product/packages/cli"                   ) ;
const output       = resolve(root           , "dist/cli"                        )        ;
const preset       = resolve(root           , "product/rules/presets/recommended"  )     ;
const publicPreset = preparePublicPreset(preset)                                         ;

rmSync(output, { recursive: true, force: true });
mkdirSync(resolve(output, "dist"), { recursive: true });

cpSync(resolve(template, "README.md"), resolve(output, "README.md"));
const yamlManifest = await Bun.file(resolve(root, "node_modules/yaml/package.json")).json() as { readonly version: string; readonly license: string };
if (yamlManifest.version !== "2.9.1" || yamlManifest.license !== "ISC") throw new Error(`unexpected bundled yaml license identity: ${yamlManifest.version} ${yamlManifest.license}`);
const yamlLicense = await Bun.file(resolve(root, "node_modules/yaml/LICENSE")).text();
await Bun.write(resolve(output, "THIRD_PARTY_NOTICES"), `yaml ${yamlManifest.version} (${yamlManifest.license})\n\n${yamlLicense}`);
const manifest = await Bun.file(resolve(template, "package.json")).json() as Record<string, unknown>;
manifest.version = (await Bun.file(resolve(root, "package.json")).json() as { version: string }).version;
await Bun.write(resolve(output, "package.json"), JSON.stringify(manifest, null, "\t") + "\n");
const packagedPreset = resolve(output, "rules/presets/recommended");
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
if (!bundle.includes("yaml@2.9.1")) throw new Error("public CLI bundle is missing the statically bundled yaml parser identity");
chmodSync(bundlePath, 0o755);

console.log(output);
