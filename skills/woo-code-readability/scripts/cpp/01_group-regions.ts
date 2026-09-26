#!/usr/bin/env bun
import { runAlignCli } from "../common/align-cli.ts";
import { CPP_ALIGNER } from "./profile.ts";

const result = runAlignCli(CPP_ALIGNER, process.argv.slice(2), { groupsOnly: true });
console.log(result.report);
process.exit(result.code);
