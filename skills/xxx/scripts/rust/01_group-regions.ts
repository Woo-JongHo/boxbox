#!/usr/bin/env bun
/** Finds and reports regions of "contiguous rows that form one table" in a Rust target file. */
import      { runAlignCli  } from "../common/align-cli.ts" ;
import      { RUST_ALIGNER } from "./profile.ts"           ;

const result = runAlignCli(RUST_ALIGNER, process.argv.slice(2), { groupsOnly: true });
console.log(result.report);
process.exit(result.code);
