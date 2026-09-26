#!/usr/bin/env bun
import { runAlignCli } from "../common/align-cli.ts";
import { JAVASCRIPT_ALIGNER } from "./profile.ts";

const result = runAlignCli(JAVASCRIPT_ALIGNER, process.argv.slice(2), { groupsOnly: true });
console.log(result.report);
process.exit(result.code);
