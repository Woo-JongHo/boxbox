#!/usr/bin/env bun
/** Detects tables in a Go target file, checks them at minimum width, and aligns them with --write. */
import      { runAlignCli } from "../common/align-cli.ts" ;
import      { GO_ALIGNER  } from "./profile.ts"           ;

const result = runAlignCli(GO_ALIGNER, process.argv.slice(2));
console.log(result.report);
process.exit(result.code);
