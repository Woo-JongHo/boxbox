#!/usr/bin/env bun
/** Rust 대상 파일의 "같은 표로 묶을 연속 행" 구역을 찾아 보고한다. */
import { runAlignCli }  from "../common/align-cli.ts";
import { RUST_ALIGNER } from "./profile.ts";

const result = runAlignCli(RUST_ALIGNER, process.argv.slice(2), { groupsOnly: true });
console.log(result.report);
process.exit(result.code);
