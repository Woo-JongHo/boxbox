#!/usr/bin/env bun
/** Go 대상 파일의 표를 감지해 최소 폭으로 검사하고 --write로 맞춘다. */
import { runAlignCli } from "../common/align-cli.ts";
import { GO_ALIGNER }  from "./profile.ts";

const result = runAlignCli(GO_ALIGNER, process.argv.slice(2));
console.log(result.report);
process.exit(result.code);
