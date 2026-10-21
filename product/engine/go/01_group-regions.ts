#!/usr/bin/env bun
/** Finds and reports regions of "contiguous rows that form one table" in a Go target file. */
import      { runAlignCli } from "@/common/align-cli.ts" ;
import      { GO_ALIGNER  } from "@/go/profile.ts"       ;

const result = runAlignCli(GO_ALIGNER, process.argv.slice(2), { groupsOnly: true });
console.log(result.report);
process.exit(result.code);
