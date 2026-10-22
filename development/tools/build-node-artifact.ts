import      {
              cpSync       ,
              mkdirSync    ,
              readFileSync ,
              rmSync       ,
                             } from "node:fs"   ;
import      { resolve        } from "node:path" ;

const root     = resolve(import.meta.dir, ".."            , ".." ) ;
const template = resolve(root           , "product/packages/node") ;
const output   = resolve(root           , "dist/engine"          ) ;

rmSync(output, { recursive: true, force: true });
mkdirSync(resolve(output, "dist"), { recursive: true });

cpSync(resolve(template, "README.md"), resolve(output, "README.md"));
const manifest = await Bun.file(resolve(template, "package.json")).json() as Record<string, unknown>;
manifest.version = (await Bun.file(resolve(root, "package.json")).json() as { version: string }).version;
await Bun.write(resolve(output, "package.json"), JSON.stringify(manifest, null, "\t") + "\n");

const build = await Bun.build({
	entrypoints : [resolve(root, "product/engine/internal-runner.ts")] ,
	outdir      : resolve(output, "dist")                              ,
	target      : "node"                                               ,
	format      : "esm"                                                ,
	external    : ["typescript", "typescript/*"]                       ,
	minify      : false                                                ,
	sourcemap   : "none"                                               ,
});
if (!build.success) throw new Error(build.logs.map(log => log.message).join("\n"));

const bundlePath = resolve     (output, "dist/internal-runner.js") ;
const bundle     = readFileSync(bundlePath, "utf8"               ) ;
for (const forbidden of ["Bun.", "bun:", "@/", root]) {
	if (bundle.includes(forbidden)) throw new Error(`Node artifact contains forbidden runtime reference: ${forbidden}`);
}

console.log(output);
