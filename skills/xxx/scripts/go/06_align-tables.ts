#!/usr/bin/env bun
/**
 * Detects tables in a Go target file and reports them. gofmt owns Go layout across the Go ecosystem and the current
 * Go aligner is not gofmt-stable (design §3.5), so Go alignment is off by default: without --enable-go the command
 * only reports, never writes, and never fails. --enable-go --write applies the alignment as before.
 */
import      { runAlignCli } from "../common/align-cli.ts" ;
import      { GO_ALIGNER  } from "./profile.ts"           ;

const args    = process.argv.slice(2)                                                                      ;
const enabled = args.includes("--enable-go")                                                               ;
const passed  = args.filter(argument => argument !== "--enable-go" && (enabled || argument !== "--write")) ;
const result  = runAlignCli(GO_ALIGNER, passed)                                                            ;
console.log(result.report);
if (!enabled) console.log("  go=report-only — gofmt owns Go layout; pass --enable-go to align and write");
process.exit(enabled ? result.code : 0);
