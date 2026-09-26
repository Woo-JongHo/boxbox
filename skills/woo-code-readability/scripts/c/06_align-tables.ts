#!/usr/bin/env bun
import { runAlignCli } from "../common/align-cli.ts";
import { C_ALIGNER }   from "./profile.ts";

const result = runAlignCli(C_ALIGNER, process.argv.slice(2));
console.log(result.report);
process.exit(result.code);
