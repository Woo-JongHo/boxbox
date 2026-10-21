import { readFileSync } from 'node:fs';
import { validateConvention } from '/Users/jonghoPro/woo/00_project/98_BoxBox/product/engine/common/conventions.ts';
import { validateExample, validateDecision } from '/Users/jonghoPro/woo/00_project/98_BoxBox/product/engine/common/examples.ts';
const root = '/Users/jonghoPro/woo/00_project/98_BoxBox/product/rules/presets/recommended/';
const first = (file: string) => JSON.parse(readFileSync(root + file, 'utf8').trim().split('\n')[0]!);
const cases = [
 ['convention missing versions', validateConvention, (() => { const x = first('conventions.jsonl'); delete x.versions; return x; })()],
 ['example missing rules/language/versions/approvedBy/date', validateExample, (() => { const x = first('examples.jsonl'); for (const key of ['rules','language','versions','approvedBy','date']) delete x[key]; return x; })()],
 ['decision missing examples/approvedBy/date', validateDecision, (() => { const x = first('decisions.jsonl'); for (const key of ['examples','approvedBy','date']) delete x[key]; return x; })()],
] as const;
for (const [name, validate, value] of cases) {
 try { validate(value, name); console.log(JSON.stringify({name, validatorAccepted: true})); }
 catch (error) { console.log(JSON.stringify({name, validatorAccepted: false, message: String(error)})); }
}
