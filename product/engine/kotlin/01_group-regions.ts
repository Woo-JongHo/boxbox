#!/usr/bin/env bun
import      { runAlignCli    } from "@/common/align-cli.ts" ;
import      { KOTLIN_ALIGNER } from "@/kotlin/profile.ts"   ;

const result = runAlignCli(KOTLIN_ALIGNER, process.argv.slice(2), { groupsOnly: true });
console.log(result.report);
process.exit(result.code);
