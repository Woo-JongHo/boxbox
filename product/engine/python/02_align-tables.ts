#!/usr/bin/env bun
import      { runAlignCli    } from "@/common/22_align-cli.ts" ;
import      { PYTHON_ALIGNER } from "@/python/03_profile.ts"   ;

const result = runAlignCli(PYTHON_ALIGNER, process.argv.slice(2));
console.log(result.report);
process.exit(result.code);
