#!/usr/bin/env bun
import      { runAlignCli   } from "../common/align-cli.ts" ;
import      { SWIFT_ALIGNER } from "./profile.ts"           ;

const result = runAlignCli(SWIFT_ALIGNER, process.argv.slice(2), { groupsOnly: true });
console.log(result.report);
process.exit(result.code);
