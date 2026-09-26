#!/usr/bin/env bun
import { runAlignCli }    from "../common/align-cli.ts";
import { PYTHON_ALIGNER } from "./profile.ts";

const result = runAlignCli(PYTHON_ALIGNER, process.argv.slice(2));
console.log(result.report);
process.exit(result.code);
