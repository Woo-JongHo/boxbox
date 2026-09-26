#!/usr/bin/env bun
import { runAlignCli }  from "../common/align-cli.ts";
import { JAVA_ALIGNER } from "./profile.ts";

const result = runAlignCli(JAVA_ALIGNER, process.argv.slice(2), { groupsOnly: true });
console.log(result.report);
process.exit(result.code);
