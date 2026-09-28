#!/usr/bin/env bun
/** Detects tables in a Rust target file, checks them at minimum width, and aligns them with --write. */
import { runAlignCli }  from "../common/align-cli.ts";
import { RUST_ALIGNER } from "./profile.ts";

const result = runAlignCli(RUST_ALIGNER, process.argv.slice(2));
console.log(result.report);
process.exit(result.code);
